import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { locationService } from '../services/locationService';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
};

const TYPE_FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'Private', value: 'private' },
  { label: 'Teaching', value: 'teaching' },
  { label: 'Government', value: 'government' },
  { label: 'Specialist', value: 'specialist' },
  { label: 'State', value: 'state' },
  { label: 'Federal', value: 'federal' },
];

export default function HospitalsListScreen({ navigation }: any) {
  const [search, setSearch]           = useState('');
  const [hospitals, setHospitals]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeType, setActiveType]   = useState<string>('All');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const searchTimeout = useRef<any>(null);

  useEffect(() => { getUserLocation(); loadHospitals(''); }, []);

  const getUserLocation = async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {}
  };

  const loadHospitals = async (text: string, type?: string) => {
    setLoading(true);
    try {
      const t = type ?? activeType;
      let query = supabase.from('hospitals')
        .select('id,name,type,city,state,rating,total_reviews,emergency_services,services,latitude,longitude')
        .eq('is_active', true)
        .ilike('name', `%${text}%`)
        .order('rating', { ascending: false })
        .limit(30);
      if (t !== 'All') query = query.eq('type', t);
      const { data: hospRows } = await query;

      const results: any[] = (hospRows || []).map((h: any) => {
        let distance = h.city || h.state || '';
        if (userLocation && h.latitude && h.longitude) {
          const d = locationService.calculateDistance(
            userLocation.latitude, userLocation.longitude, h.latitude, h.longitude,
          );
          distance = `${d.toFixed(1)} km away`;
        }
        return { ...h, distance };
      });

      // Fallback: also look in profiles for hospital_name (covers accounts without a hospitals row)
      if (t === 'All') {
        let profileQuery = supabase.from('profiles')
          .select('hospital_name')
          .not('hospital_name', 'is', null);
        if (text.trim()) {
          profileQuery = profileQuery.ilike('hospital_name', `%${text}%`);
        }
        const { data: profRows } = await profileQuery.limit(20);
        for (const prof of profRows || []) {
          const hospName = (prof.hospital_name || '').trim();
          if (!hospName) continue;
          const alreadyIn = results.some(r => r.name.toLowerCase() === hospName.toLowerCase());
          if (!alreadyIn) {
            results.push({
              id: null, name: hospName, type: null, city: null,
              state: null, rating: 0, total_reviews: 0,
              emergency_services: false, services: [], distance: 'Nigeria',
            });
          }
        }
      }

      setHospitals(results);
    } catch { setHospitals([]); }
    finally { setLoading(false); }
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadHospitals(text), 400);
  };

  const onTypePress = (value: string) => { setActiveType(value); loadHospitals(search, value); };
  const onRefresh   = async () => { setRefreshing(true); await loadHospitals(search); setRefreshing(false); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Deep teal header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Find Hospitals</Text>
          <Text style={s.headerSubtitle}>Browse nearby facilities</Text>
        </View>
      </View>

      {/* Paper card */}
      <View style={s.paperCard}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Toggle â€” Hospitals / Doctors */}
          <View style={s.toggleWrap}>
            <View style={s.toggle}>
              <View style={[s.toggleBtn, s.toggleBtnActive]}>
                <MaterialCommunityIcons name="hospital-building" size={13} color="#fff" />
                <Text style={s.toggleTextActive}>Hospitals</Text>
              </View>
              <TouchableOpacity style={s.toggleBtn} onPress={() => navigation.replace('DoctorsList')}>
                <MaterialCommunityIcons name="stethoscope" size={13} color={C.muted} />
                <Text style={s.toggleTextInactive}>Doctors</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={17} color={C.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search hospitals by name or city..."
              placeholderTextColor={C.muted}
              value={search}
              onChangeText={onSearchChange}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); loadHospitals(''); }}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Type chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            {TYPE_FILTERS.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[s.chip, activeType === t.value && s.chipActive]}
                onPress={() => onTypePress(t.value)}
              >
                <Text style={[s.chipText, activeType === t.value && s.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Results count */}
          <View style={s.resultsBar}>
            <Text style={s.resultsLabel}>
              {loading ? 'Searching...' : `${hospitals.length} hospital${hospitals.length !== 1 ? 's' : ''} found`}
            </Text>
          </View>

          {/* Hospital list */}
          <View style={s.list}>
            {loading ? (
              <ActivityIndicator size="large" color={C.teal} style={{ marginTop: 40 }} />
            ) : hospitals.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <MaterialCommunityIcons name="hospital-building" size={32} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>No hospitals found</Text>
                <Text style={s.emptyHint}>Try adjusting the filter or search</Text>
              </View>
            ) : (
              hospitals.map(h => {
                const navParams = h.id ? { hospitalId: h.id } : { hospitalName: h.name };
                return (
                <TouchableOpacity key={h.id || h.name} style={s.hospCard} activeOpacity={0.92}
                  onPress={() => navigation.navigate('HospitalDetail', navParams)}>

                  {/* Icon + badges */}
                  <View style={s.hospCardTop}>
                    <View style={s.hospIconWrap}>
                      <MaterialCommunityIcons name="hospital-building" size={28} color={C.teal} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.hospName} numberOfLines={1}>{h.name}</Text>
                      <Text style={s.hospLocation} numberOfLines={1}>
                        {h.city && h.state ? `${h.city}, ${h.state}` : h.city || h.state || h.distance}
                      </Text>
                    </View>
                    <View style={s.ratingPill}>
                      <Ionicons name="star" size={11} color="#F59E0B" />
                      <Text style={s.ratingText}>{(h.rating || 0).toFixed(1)}</Text>
                    </View>
                  </View>

                  {/* Tags row */}
                  <View style={s.tagsRow}>
                    {h.type && (
                      <View style={s.tag}>
                        <Text style={s.tagText}>{h.type.charAt(0).toUpperCase() + h.type.slice(1)}</Text>
                      </View>
                    )}
                    {h.emergency_services && (
                      <View style={[s.tag, s.tagRed]}>
                        <Ionicons name="flash" size={10} color="#EF4444" />
                        <Text style={[s.tagText, { color: '#EF4444' }]}>24hr Emergency</Text>
                      </View>
                    )}
                    <View style={s.tag}>
                      <Ionicons name="location-outline" size={11} color={C.muted} />
                      <Text style={s.tagText}>{h.distance}</Text>
                    </View>
                  </View>

                  {h.services && h.services.length > 0 && (
                    <Text style={s.servicesText} numberOfLines={1}>
                      {h.services.slice(0, 3).join(' · ')}
                    </Text>
                  )}

                  {/* Buttons */}
                  <View style={s.btnRow}>
                    <TouchableOpacity
                      style={s.outlineBtn}
                      onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`)}
                    >
                      <Ionicons name="navigate-outline" size={14} color={C.teal} />
                      <Text style={s.outlineBtnText}>Directions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.primaryBtn}
                      onPress={() => navigation.navigate('HospitalDetail', navParams)}
                    >
                      <Text style={s.primaryBtnText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 2 },

  // Paper card
  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  // Toggle
  toggleWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  toggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: C.teal },
  toggleTextActive: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
  toggleTextInactive: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.muted },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  // Filter chips
  chipsRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  chipActive: { backgroundColor: C.tealLight, borderColor: C.teal },
  chipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  chipTextActive: { fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },

  // Results count
  resultsBar: { paddingHorizontal: 20, paddingBottom: 10 },
  resultsLabel: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  // List
  list: { paddingHorizontal: 16, gap: 12 },

  // Hospital card
  hospCard: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  hospCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hospIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hospName: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.text },
  hospLocation: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#D97706' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface, borderRadius: 999 },
  tagRed: { backgroundColor: 'rgba(239,68,68,0.08)' },
  tagText: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  servicesText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: 8 },
  outlineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, paddingVertical: 10 },
  outlineBtnText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  primaryBtn: { flex: 1.2, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptyHint: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
});
