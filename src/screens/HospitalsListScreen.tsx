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
  bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717', muted: '#737373',
  border: '#E5E5E5', teal: '#0B7E8A', tealLight: '#E6F5F5',
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
      let query = supabase.from('hospitals')
        .select('id,name,type,city,state,rating,total_reviews,emergency_services,services,latitude,longitude')
        .eq('is_active', true)
        .ilike('name', `%${text}%`)
        .order('rating', { ascending: false })
        .limit(30);
      const t = type ?? activeType;
      if (t !== 'All') query = query.eq('type', t);
      const { data } = await query;
      const mapped = (data || []).map((h: any) => {
        let distance = `${h.city || h.state || ''}`;
        if (userLocation && h.latitude && h.longitude) {
          const d = locationService.calculateDistance(
            userLocation.latitude, userLocation.longitude, h.latitude, h.longitude,
          );
          distance = `${d.toFixed(1)} km away`;
        }
        return { ...h, distance };
      });
      setHospitals(mapped);
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
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <View style={s.headerBranding}>
          <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={s.headerIconWrap}>
            <MaterialCommunityIcons name="hospital-building" size={28} color="#ffffff" />
          </View>
          <View style={s.headerTitles}>
            <Text style={s.headerTitle}>Find Hospitals</Text>
            <Text style={s.headerSubtitle}>Browse nearby healthcare facilities</Text>
          </View>
        </View>
      </View>

      {/* White Card */}
      <View style={s.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Toggle */}
          <View style={s.toggleWrap}>
            <View style={s.toggle}>
              <View style={[s.toggleBtn, s.toggleBtnActive]}>
                <Text style={s.toggleTextActive}>Hospitals</Text>
              </View>
              <TouchableOpacity style={s.toggleBtn} onPress={() => navigation.replace('DoctorsList')}>
                <Text style={s.toggleTextInactive}>Doctors</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search hospitals..."
                placeholderTextColor={C.muted}
                value={search}
                onChangeText={onSearchChange}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Type chips */}
          <View style={s.chipsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsContainer}>
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
          </View>

          {/* Results header */}
          <View style={s.resultsHeader}>
            <Text style={s.resultsTitle}>Nearby Hospitals</Text>
            <Text style={s.resultsCount}>{hospitals.length} found</Text>
          </View>

          {/* List */}
          <View style={s.cardsList}>
            {loading ? (
              <ActivityIndicator size="large" color={C.teal} style={{ marginTop: 32 }} />
            ) : hospitals.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="business-outline" size={40} color={C.muted} />
                <Text style={s.emptyText}>No hospitals found</Text>
              </View>
            ) : (
              hospitals.map(h => (
                <View key={h.id} style={s.hospCard}>
                  <View style={s.cardImg}>
                    <MaterialCommunityIcons name="hospital-building" size={36} color={C.teal} />
                    <View style={s.imgBadge}>
                      <Text style={s.imgBadgeText}>
                        {h.type ? h.type.charAt(0).toUpperCase() + h.type.slice(1) : 'Hospital'}
                      </Text>
                    </View>
                    {h.emergency_services && (
                      <View style={s.emergencyBadge}>
                        <Ionicons name="flash" size={10} color="#ffffff" />
                        <Text style={s.emergencyText}>24hr</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.cardContent}>
                    <View style={s.cardRow}>
                      <Text style={s.cardName} numberOfLines={1}>{h.name}</Text>
                      <View style={s.ratingRow}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={s.ratingText}>{(h.rating || 0).toFixed(1)}</Text>
                      </View>
                    </View>
                    <View style={s.metaRow}>
                      <View style={s.metaItem}>
                        <Ionicons name="location" size={12} color={C.muted} />
                        <Text style={s.metaText}>{h.distance}</Text>
                      </View>
                      <View style={s.metaItem}>
                        <Ionicons name="time" size={12} color={C.muted} />
                        <Text style={s.metaText}>{h.emergency_services ? 'Open 24hrs' : 'Check hours'}</Text>
                      </View>
                    </View>
                    {h.services && h.services.length > 0 && (
                      <View style={s.metaItem}>
                        <MaterialCommunityIcons name="stethoscope" size={12} color={C.muted} />
                        <Text style={s.metaText} numberOfLines={1}>{h.services.slice(0, 3).join(', ')}</Text>
                      </View>
                    )}
                    <View style={s.btnRow}>
                      <TouchableOpacity
                        style={s.outlineBtn}
                        onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}`)}
                      >
                        <Ionicons name="navigate-outline" size={13} color={C.teal} />
                        <Text style={s.outlineBtnText}>Directions</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.darkBtn}
                        onPress={() => navigation.navigate('HospitalDetail', { hospitalId: h.id })}
                      >
                        <Text style={s.darkBtnText}>View Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B7E8A',
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  headerBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // White card
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  // Toggle
  toggleWrap: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  toggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: C.teal },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  toggleTextInactive: { fontSize: 13, fontWeight: '500', color: C.muted },

  // Search
  searchWrap: { paddingHorizontal: 24, paddingBottom: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1.5, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text, paddingVertical: 0 },

  // Chips
  chipsWrap: { paddingBottom: 16 },
  chipsContainer: { paddingHorizontal: 24, gap: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.bg,
  },
  chipActive: { backgroundColor: C.teal, borderColor: C.teal },
  chipText: { fontSize: 11, color: C.text },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },

  // Results header
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 12,
  },
  resultsTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  resultsCount: { fontSize: 11, color: C.muted },

  // Cards list
  cardsList: { paddingHorizontal: 24, gap: 16 },
  hospCard: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bg,
  },
  cardImg: {
    height: 120, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  imgBadge: {
    position: 'absolute', top: 8, left: 8,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: C.teal,
  },
  imgBadgeText: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
  emergencyBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#EF4444',
  },
  emergencyText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  cardContent: { padding: 16, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontWeight: '500', color: C.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: C.muted },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  outlineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: C.teal, borderRadius: 10, paddingVertical: 9,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '600', color: C.teal },
  darkBtn: {
    flex: 1, backgroundColor: C.teal,
    borderRadius: 10, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  darkBtnText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 13, color: C.muted },
});
