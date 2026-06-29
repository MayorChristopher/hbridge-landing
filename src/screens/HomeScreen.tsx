import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingLogo from '../components/LoadingLogo';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { locationService } from '../services/locationService';
import { useScreenTracking, useInteractionTracking } from '../hooks/useAnalytics';

const C = {
  bg: '#FFFFFF',
  surface: '#F5F7FA',
  surfaceHigh: '#FFFFFF',
  text: '#0A0A0A',
  muted: '#555F6D',
  mutedLight: '#9AA3AE',
  border: '#E2E8EF',
  teal: '#0B7E8A',
  tealLight: '#E6F5F5',
  gold: '#D4A843',
};

// Navbar is floating: bottom:18 + height:64 + gap = ~100
const NAV_BOTTOM_PAD = 110;

interface User { id: string; full_name: string; user_type: string; profile_image?: string; }
interface Doctor { id: string; full_name: string; specialization: string; profile_image?: string; is_available: boolean; rating?: number; }
interface Hospital { id: string; name: string; address?: string; city?: string; state?: string; distance?: string; rating?: number; latitude?: number; longitude?: number; }

function Stars({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <Ionicons key={i} name="star" size={10} color={i < Math.round(count) ? C.gold : C.border} />
      ))}
      <Text style={{ fontSize: 11, color: C.mutedLight, marginLeft: 4 }}>{count.toFixed(1)}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<any>(null);

  useScreenTracking();
  const { trackFeatureUse } = useInteractionTracking();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUser(), loadDoctors(), loadHospitals()]);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, profile_image')
        .eq('id', authUser.id)
        .maybeSingle();
      if (error) console.warn('[Home] loadUser:', error.message);
      setUser(data || { id: authUser.id, full_name: authUser.user_metadata?.full_name || 'User', user_type: 'patient' });
    } catch (e: any) { console.warn('[Home] loadUser exception:', e.message); }
  };

  const loadDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, full_name, specialization, profile_image, is_available, average_rating')
        .eq('verification_status', 'verified')
        .eq('is_available', true)
        .order('average_rating', { ascending: false })
        .limit(6);
      if (error) console.warn('[Home] loadDoctors:', error.message);
      if (data && data.length > 0) setDoctors(data);
    } catch (e: any) { console.warn('[Home] loadDoctors exception:', e.message); }
  };

  const loadHospitals = async () => {
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('id, name, address, city, state, rating, latitude, longitude')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6);
      if (error) console.warn('[Home] loadHospitals:', error.message);
      if (!data || data.length === 0) return;
      const withLabel = data.map((h: any) => ({ ...h, distance: h.city ? `${h.city}, ${h.state}` : h.state || '' }));
      setHospitals(withLabel.slice(0, 3));
      tryApplyLocation(data);
    } catch (e: any) { console.warn('[Home] loadHospitals exception:', e.message); }
  };

  const tryApplyLocation = async (data: any[]) => {
    try {
      const location = await locationService.getCurrentLocation();
      const { latitude, longitude } = location.coords;
      const withDistance = data.map((h: any) => {
        if (h.latitude && h.longitude) {
          const dist = locationService.calculateDistance(latitude, longitude, h.latitude, h.longitude);
          return { ...h, distance: `${dist.toFixed(1)} km away` };
        }
        return { ...h, distance: h.city ? `${h.city}, ${h.state}` : '' };
      });
      withDistance.sort((a: any, b: any) => {
        const da = parseFloat(a.distance), db = parseFloat(b.distance);
        if (!isNaN(da) && !isNaN(db)) return da - db;
        return 0;
      });
      setHospitals(withDistance.slice(0, 3));
    } catch { /* no-op */ }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const onSearchChange = (text: string) => {
    setQuery(text);
    if (!text.trim()) { setSearchResults([]); setShowResults(false); return; }
    setShowResults(true);
    setSearching(true);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => runSearch(text), 400);
  };

  const runSearch = async (text: string) => {
    try {
      const [{ data: hosp }, { data: docs }] = await Promise.all([
        supabase.from('hospitals').select('id, name, city, state, type').ilike('name', `%${text}%`).limit(4),
        supabase.from('doctors').select('id, full_name, specialization, profile_image').ilike('full_name', `%${text}%`).eq('verification_status', 'verified').limit(4),
      ]);
      setSearchResults([
        ...(hosp || []).map((h: any) => ({ ...h, _type: 'hospital' })),
        ...(docs || []).map((d: any) => ({ ...d, _type: 'doctor' })),
      ]);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const onResultPress = (item: any) => {
    setQuery(''); setShowResults(false);
    if (item._type === 'hospital') navigation.navigate('HospitalDetail', { hospitalId: item.id });
    else navigation.navigate('DoctorDetail', { doctor: item });
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Dear';

  const QUICK_ACTIONS = [
    { label: 'Find Doctor', icon: <MaterialCommunityIcons name="stethoscope" size={24} color={C.teal} />, onPress: () => navigation.navigate('Explore', { tab: 'doctors' }) },
    { label: 'Find Hospital', icon: <MaterialCommunityIcons name="hospital-building" size={24} color={C.teal} />, onPress: () => navigation.navigate('Explore', { tab: 'hospitals' }) },
    { label: 'Records', icon: <Ionicons name="document-text" size={24} color={C.teal} />, onPress: () => navigation.navigate('MedicalRecords') },
    { label: 'Book', icon: <MaterialCommunityIcons name="calendar-plus" size={24} color={C.teal} />, onPress: () => navigation.navigate('Appointments') },
  ];

  if (loading) return <LoadingLogo />;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: NAV_BOTTOM_PAD }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ gap: 4 }}>
            <Text style={s.helloText}>Hello, {firstName} 👋</Text>
            <Text style={s.subText}>How are you feeling today?</Text>
          </View>
          <TouchableOpacity style={s.avatarCircle} onPress={() => navigation.navigate('Profile')}>
            {user?.profile_image
              ? <Image source={{ uri: user.profile_image }} style={s.avatarImg} />
              : <Ionicons name="person" size={22} color={C.muted} />}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrapper}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={C.mutedLight} />
            <TextInput
              style={s.searchInput}
              placeholder="Search doctors, hospitals..."
              placeholderTextColor={C.mutedLight}
              value={query}
              onChangeText={onSearchChange}
              returnKeyType="search"
              onFocus={() => query.trim() && setShowResults(true)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setShowResults(false); }}>
                <Ionicons name="close-circle" size={16} color={C.mutedLight} />
              </TouchableOpacity>
            )}
          </View>
          {showResults && (
            <View style={s.dropdown}>
              {searching ? (
                <ActivityIndicator size="small" color={C.teal} style={{ padding: 16 }} />
              ) : searchResults.length === 0 ? (
                <Text style={s.noResults}>No results found</Text>
              ) : (
                searchResults.map((item) => (
                  <TouchableOpacity key={`${item._type}-${item.id}`} style={s.resultRow} onPress={() => onResultPress(item)}>
                    <View style={s.resultIcon}>
                      {item._type === 'hospital'
                        ? <MaterialCommunityIcons name="hospital-building" size={18} color={C.teal} />
                        : <MaterialCommunityIcons name="stethoscope" size={18} color={C.teal} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{item._type === 'doctor' ? `Dr. ${item.full_name}` : item.name}</Text>
                      <Text style={s.resultSub}>{item._type === 'doctor' ? item.specialization : `${item.city || ''}, ${item.state || ''}`}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={C.mutedLight} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={s.quickSection}>
          <Text style={s.quickSectionTitle}>Quick Actions</Text>
          <View style={s.quickGrid}>
            {QUICK_ACTIONS.map((a) => (
              <TouchableOpacity key={a.label} style={s.quickItem} onPress={a.onPress} activeOpacity={0.7}>
                <View style={s.quickIconBox}>{a.icon}</View>
                <Text style={s.quickLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nearby Hospitals */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Nearby Hospitals</Text>
          {hospitals.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="business-outline" size={32} color={C.mutedLight} />
              <Text style={s.emptyText}>No hospitals found</Text>
              <Text style={s.emptyHint}>Pull down to refresh</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {hospitals.map((h) => (
                <TouchableOpacity key={h.id} style={s.card}
                  onPress={() => navigation.navigate('HospitalDetail', { hospitalId: h.id })}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.cardTitle}>{h.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="location" size={12} color={C.teal} />
                      <Text style={s.cardSub}>{h.distance || h.address || 'Nearby'}</Text>
                    </View>
                    <Stars count={h.rating || 4.0} />
                  </View>
                  <MaterialCommunityIcons name="hospital-building" size={22} color={C.teal} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Top Rated Doctors */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Rated Doctors</Text>
          {doctors.length === 0 ? (
            <View style={s.emptyCard}>
              <MaterialCommunityIcons name="stethoscope" size={32} color={C.mutedLight} />
              <Text style={s.emptyText}>No doctors available</Text>
              <Text style={s.emptyHint}>Pull down to refresh</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              {doctors.map((d) => (
                <TouchableOpacity key={d.id} style={s.doctorCard}
                  onPress={() => navigation.navigate('DoctorDetail', { doctor: d })}>
                  <View style={s.doctorAvatar}>
                    {d.profile_image
                      ? <Image source={{ uri: d.profile_image }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                      : <MaterialCommunityIcons name="stethoscope" size={28} color={C.teal} />}
                  </View>
                  <Text style={s.doctorName}>Dr. {d.full_name}</Text>
                  <Text style={s.doctorSpec}>{d.specialization}</Text>
                  <Stars count={(d as any).average_rating || d.rating || 4.5} />
                  <View style={s.badge}><Text style={s.badgeText}>Available</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  helloText: { fontSize: 24, fontWeight: '700', color: C.text },
  subText: { fontSize: 14, color: C.muted },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: C.surface },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  searchWrapper: { marginHorizontal: 24, marginVertical: 12, zIndex: 100 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  dropdown: { position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: C.surfaceHigh, borderRadius: 12, borderWidth: 1, borderColor: C.border, zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  resultIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  resultName: { fontSize: 14, fontWeight: '600', color: C.text },
  resultSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  noResults: { fontSize: 14, color: C.muted, textAlign: 'center', padding: 16 },
  section: { paddingHorizontal: 24, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  quickSection: { marginTop: 20, marginHorizontal: 24, backgroundColor: C.teal, borderRadius: 16, padding: 20 },
  quickSectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', gap: 8, flex: 1 },
  quickIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  cardSub: { fontSize: 12, color: C.muted },
  cardIconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  doctorCard: { alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16, minWidth: 160 },
  doctorAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  doctorName: { fontSize: 14, fontWeight: '600', color: C.text, textAlign: 'center' },
  doctorSpec: { fontSize: 12, color: C.muted, textAlign: 'center' },
  badge: { backgroundColor: C.teal, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#FFFFFF' },
  emptyCard: { alignItems: 'center', paddingVertical: 32, gap: 8, backgroundColor: C.surface, borderRadius: 12 },
  emptyText: { fontSize: 14, fontWeight: '600', color: C.muted },
  emptyHint: { fontSize: 12, color: C.mutedLight },
});
