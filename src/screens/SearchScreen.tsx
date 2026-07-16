import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, RefreshControl,
  Modal, StatusBar, Dimensions, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { usePresence } from '../context/PresenceContext';

const { width: SW } = Dimensions.get('window');

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  tealHero: '#083236', gold: '#D4A843',
};

const TYPE_COLORS: Record<string, string> = {
  government: '#0B7E8A',
  federal:    '#083236',
  private:    '#C49328',
  state:      '#1E9E5A',
  specialist: '#7C3AED',
};

const NIGERIAN_STATES = [
  'All States', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

const SPECIALTIES = [
  'General Practice', 'Cardiology', 'Dermatology', 'Pediatrics', 'Obstetrics & Gynecology',
  'Orthopedics', 'Ophthalmology', 'ENT', 'Psychiatry', 'Neurology', 'Oncology',
  'Radiology', 'Urology', 'Gastroenterology', 'Endocrinology', 'Nephrology',
  'Nursing', 'Pharmacy', 'Physiotherapy', 'Laboratory Science', 'Dentistry',
];

const HOSPITAL_TYPES = ['Government', 'Private', 'Federal', 'State', 'Specialist'];

// Quick-access specialties shown as chips on the main screen
const QUICK_SPECIALTIES = [
  'General Practice', 'Cardiology', 'Pediatrics', 'Dermatology',
  'Obstetrics & Gynecology', 'Psychiatry', 'Orthopedics', 'Ophthalmology',
  'ENT', 'Neurology', 'Dentistry', 'Pharmacy', 'Nursing', 'Physiotherapy',
];

const RATING_OPTIONS = [
  { label: 'Any',    value: 0   },
  { label: '3+ ★',  value: 3   },
  { label: '4+ ★',  value: 4   },
  { label: '4.5+ ★', value: 4.5 },
];

type Tab      = 'all' | 'workers' | 'hospitals';
type SortMode = 'relevant' | 'top_rated' | 'newest';

function scoreItem(item: any, query: string, sort: SortMode): number {
  let score = 0;
  const q = query.toLowerCase().trim();
  if (q) {
    const name = (item.full_name || item.name || '').toLowerCase();
    const spec = (item.specialization || item.type || '').toLowerCase();
    const bio  = (item.bio || '').toLowerCase();
    if (name === q)               score += 1000;
    else if (name.startsWith(q)) score += 600;
    else if (name.includes(q))   score += 300;
    if (spec.includes(q))        score += 200;
    if (bio.includes(q))         score += 50;
  }
  if (item._type === 'worker') {
    if (item.is_available) score += 30;
    if (item.profile_image) score += 8;
    if (item.bio)           score += 8;
    score += (item.average_rating || 0) * (sort === 'top_rated' ? 100 : 10);
    if (sort === 'newest') {
      const ageDays = (Date.now() - new Date(item.created_at || 0).getTime()) / 86400000;
      score += Math.max(0, 200 - ageDays * 2);
    }
  } else {
    score += (item.rating || 0) * (sort === 'top_rated' ? 100 : 10);
  }
  return score;
}

export default function SearchScreen({ route, navigation }: any) {
  // Search
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimeout               = useRef<any>(null);

  // Tab + sort
  const [tab, setTab]   = useState<Tab>('workers');
  const [sort, setSort] = useState<SortMode>('relevant');

  // Applied filters (live — drive the query)
  const [selectedState, setSelectedState]           = useState('All States');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedHospTypes, setSelectedHospTypes]   = useState<string[]>([]);
  const [minRating, setMinRating]                   = useState(0);
  const [availableOnly, setAvailableOnly]           = useState(false);
  const [emergencyOnly, setEmergencyOnly]           = useState(false);

  // Filter sheet staged state (pending apply)
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [stagedState, setStagedState]               = useState('All States');
  const [stagedSpecialties, setStagedSpecialties]   = useState<string[]>([]);
  const [stagedHospTypes, setStagedHospTypes]       = useState<string[]>([]);
  const [stagedMinRating, setStagedMinRating]       = useState(0);
  const [stagedAvailable, setStagedAvailable]       = useState(false);
  const [stagedEmergency, setStagedEmergency]       = useState(false);
  const [showStatePicker, setShowStatePicker]       = useState(false);

  const [totalWorkers, setTotalWorkers]     = useState<number | null>(null);
  const [totalHospitals, setTotalHospitals] = useState<number | null>(null);

  const [currentUserDoctorId, setCurrentUserDoctorId] = useState<string | null>(null);
  const onlineUserIds = usePresence();

  const activeFilterCount =
    (selectedState !== 'All States' ? 1 : 0) +
    selectedSpecialties.length +
    selectedHospTypes.length +
    (minRating > 0 ? 1 : 0) +
    (availableOnly ? 1 : 0) +
    (emergencyOnly ? 1 : 0);

  const stagedFilterCount =
    (stagedState !== 'All States' ? 1 : 0) +
    stagedSpecialties.length +
    stagedHospTypes.length +
    (stagedMinRating > 0 ? 1 : 0) +
    (stagedAvailable ? 1 : 0) +
    (stagedEmergency ? 1 : 0);

  // Serialize applied state to detect changes in effect
  const filterKey = [
    tab, sort, selectedState,
    selectedSpecialties.join(','),
    selectedHospTypes.join(','),
    minRating, availableOnly, emergencyOnly,
  ].join('|');

  useEffect(() => {
    const paramTab = route?.params?.tab;
    if (paramTab === 'doctors') setTab('workers');
    else if (paramTab === 'hospitals') setTab('hospitals');
    const paramSpecialty = route?.params?.specialty;
    if (paramSpecialty) {
      setSelectedSpecialties([paramSpecialty]);
      setTab('workers');
    }
    getCurrentUser();
  }, []);

  useEffect(() => { loadResults(query); }, [filterKey]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
    if (data) setCurrentUserDoctorId(data.id);
  };

  const searchById = async (id: string) => {
    setLoading(true);
    try {
      const upper = id.trim().toUpperCase();
      // Check profiles first
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, profile_image, hbridge_id')
        .eq('hbridge_id', upper)
        .maybeSingle();

      if (profile) {
        if (profile.user_type === 'doctor') {
          const { data: doc } = await supabase.from('doctors').select('*').eq('user_id', profile.id).maybeSingle();
          if (doc) { navigation.navigate('DoctorDetail', { doctor: { ...doc, profile_image: profile.profile_image } }); return; }
        } else {
          // Patient or hospital admin — show results list
          setResults([{ ...profile, _type: 'profile' }]);
          setLoading(false);
          return;
        }
      }

      // Check hospitals
      const { data: hosp } = await supabase
        .from('hospitals')
        .select('id, name, type, city, state, rating, address, hbridge_id')
        .eq('hbridge_id', upper)
        .maybeSingle();

      if (hosp) { navigation.navigate('HospitalDetail', { hospitalId: hosp.id }); return; }

      setResults([]);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const loadResults = async (text: string) => {
    // HBridge ID pattern — direct lookup
    if (/^HB[MPH]-[A-Z0-9]{6}$/i.test(text.trim())) {
      searchById(text.trim());
      return;
    }
    setLoading(true);
    try {
      // State filter for workers: profiles table holds state, not doctors table
      let doctorUserIds: string[] | null = null;
      if (tab !== 'hospitals' && selectedState !== 'All States') {
        const { data: sp } = await supabase
          .from('profiles').select('id')
          .eq('state', selectedState).eq('user_type', 'doctor');
        doctorUserIds = (sp || []).map((p: any) => p.id);
      }

      const skipWorkers = tab === 'hospitals' || (doctorUserIds !== null && doctorUserIds.length === 0);
      const skipHospitals = tab === 'workers';

      // Apply worker filters to any query builder
      const applyWorkerFilters = (q: any) => {
        if (text.trim()) q = q.or(`full_name.ilike.%${text}%,specialization.ilike.%${text}%`);
        if (availableOnly) q = q.eq('is_available', true);
        if (minRating > 0) q = q.gte('average_rating', minRating);
        if (selectedSpecialties.length > 0)
          q = q.or(selectedSpecialties.map((s: string) => `specialization.ilike.%${s}%`).join(','));
        if (doctorUserIds !== null) q = q.in('user_id', doctorUserIds);
        return q;
      };

      // Apply hospital filters to any query builder
      const applyHospitalFilters = (q: any) => {
        if (text.trim()) q = q.or(`name.ilike.%${text}%,city.ilike.%${text}%`);
        if (selectedState !== 'All States') q = q.ilike('state', `%${selectedState}%`);
        if (selectedHospTypes.length > 0) q = q.in('type', selectedHospTypes.map((t: string) => t.toLowerCase()));
        if (emergencyOnly) q = q.eq('emergency_services', true);
        return q;
      };

      // Run count + data queries in parallel (4 queries at once)
      const [workerCountRes, workerDataRes, hospCountRes, hospDataRes] = await Promise.all([
        skipWorkers
          ? Promise.resolve({ count: 0, error: null })
          : applyWorkerFilters(
              supabase.from('doctors')
                .select('id', { count: 'exact', head: true })
                .eq('verification_status', 'verified')
            ),
        skipWorkers
          ? Promise.resolve({ data: [], error: null })
          : applyWorkerFilters(
              supabase.from('doctors')
                .select('id, user_id, full_name, specialization, average_rating, total_reviews, profile_image, is_available, consultation_fee, bio, title, created_at, profiles!user_id(hbridge_id)')
                .eq('verification_status', 'verified')
            ).limit(60),
        skipHospitals
          ? Promise.resolve({ count: 0, error: null })
          : applyHospitalFilters(
              supabase.from('hospitals')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true)
            ),
        skipHospitals
          ? Promise.resolve({ data: [], error: null })
          : applyHospitalFilters(
              supabase.from('hospitals')
                .select('id, name, type, city, state, rating, address, emergency_services')
                .eq('is_active', true)
            ).limit(30),
      ]);

      setTotalWorkers(tab !== 'hospitals' ? (workerCountRes.count ?? 0) : null);
      setTotalHospitals(tab !== 'workers' ? (hospCountRes.count ?? 0) : null);

      const allResults: any[] = [
        ...(workerDataRes.data || []).map((d: any) => ({
          ...d,
          hbridge_id: (d.profiles as any)?.hbridge_id ?? null,
          _type: 'worker',
        })),
        ...(hospDataRes.data || []).map((h: any) => ({ ...h, _type: 'hospital' })),
      ];

      setResults(
        allResults
          .map(item => ({ item, score: scoreItem(item, text, sort) }))
          .sort((a, b) => b.score - a.score)
          .map(x => x.item)
      );
    } catch {
      setResults([]);
      setTotalWorkers(null);
      setTotalHospitals(null);
    } finally {
      setLoading(false);
    }
  };

  const onSearchChange = (text: string) => {
    setQuery(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadResults(text), 350);
  };

  const openFilterSheet = () => {
    setStagedState(selectedState);
    setStagedSpecialties([...selectedSpecialties]);
    setStagedHospTypes([...selectedHospTypes]);
    setStagedMinRating(minRating);
    setStagedAvailable(availableOnly);
    setStagedEmergency(emergencyOnly);
    setShowFilterSheet(true);
  };

  const applyFilters = () => {
    setSelectedState(stagedState);
    setSelectedSpecialties([...stagedSpecialties]);
    setSelectedHospTypes([...stagedHospTypes]);
    setMinRating(stagedMinRating);
    setAvailableOnly(stagedAvailable);
    setEmergencyOnly(stagedEmergency);
    setShowFilterSheet(false);
  };

  const resetStaged = () => {
    setStagedState('All States');
    setStagedSpecialties([]);
    setStagedHospTypes([]);
    setStagedMinRating(0);
    setStagedAvailable(false);
    setStagedEmergency(false);
  };

  const removeFilter = (type: string, value?: string) => {
    if (type === 'state')     setSelectedState('All States');
    else if (type === 'sp' && value)  setSelectedSpecialties(p => p.filter(s => s !== value));
    else if (type === 'ht' && value)  setSelectedHospTypes(p => p.filter(t => t !== value));
    else if (type === 'rating')       setMinRating(0);
    else if (type === 'available')    setAvailableOnly(false);
    else if (type === 'emergency')    setEmergencyOnly(false);
  };

  // Direct toggle on applied state (instant re-query, no sheet needed)
  const quickToggleSp = (sp: string) =>
    setSelectedSpecialties(p => p.includes(sp) ? p.filter(s => s !== sp) : [...p, sp]);

  const toggleSp = (sp: string) =>
    setStagedSpecialties(p => p.includes(sp) ? p.filter(s => s !== sp) : [...p, sp]);

  const toggleHt = (t: string) =>
    setStagedHospTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const clearAllFilters = () => {
    setSelectedState('All States'); setSelectedSpecialties([]);
    setSelectedHospTypes([]); setMinRating(0);
    setAvailableOnly(false); setEmergencyOnly(false);
  };

  const SORT_ORDER: SortMode[] = ['relevant', 'top_rated', 'newest'];
  const SORT_META: Record<SortMode, { icon: string; label: string }> = {
    relevant:  { icon: 'swap-vertical-outline', label: 'Relevant'  },
    top_rated: { icon: 'star',                  label: 'Top Rated' },
    newest:    { icon: 'time-outline',           label: 'Newest'   },
  };
  const cycleSortMode = () =>
    setSort(prev => SORT_ORDER[(SORT_ORDER.indexOf(prev) + 1) % SORT_ORDER.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadResults(query);
    setRefreshing(false);
  };

  const onViewPress = (item: any) => {
    if (item._type === 'hospital') navigation.navigate('HospitalDetail', { hospitalId: item.id });
    else navigation.navigate('DoctorDetail', { doctor: item });
  };

  const drLabel = (item: any) => {
    const name = (item.full_name || '').trim();
    if (/^(dr\.?|prof\.?|nurse\.?|pharm\.?|physio\.?|rad\.?)\s/i.test(name)) return name;
    const t = (item.title || 'Dr.').trim();
    return `${t.endsWith('.') ? t : t + '.'} ${name}`;
  };

  const TABS = [
    { key: 'all' as Tab,       label: 'All' },
    { key: 'workers' as Tab,   label: 'Practitioners' },
    { key: 'hospitals' as Tab, label: 'Hospitals' },
  ];

  const workers   = results.filter(r => r._type === 'worker');
  const hospitals = results.filter(r => r._type === 'hospital');

  const showPractitionerFilters = tab !== 'hospitals';
  const showHospitalFilters     = tab !== 'workers';

  type Chip = { key: string; label: string; onRemove: () => void };
  const activeChips: Chip[] = [
    ...(selectedState !== 'All States'
      ? [{ key: 'state', label: `📍 ${selectedState}`, onRemove: () => removeFilter('state') }] : []),
    ...selectedSpecialties.map(s => ({ key: `sp-${s}`, label: s, onRemove: () => removeFilter('sp', s) })),
    ...selectedHospTypes.map(t => ({ key: `ht-${t}`, label: t, onRemove: () => removeFilter('ht', t) })),
    ...(minRating > 0 ? [{ key: 'rating', label: `★ ${minRating}+`, onRemove: () => removeFilter('rating') }] : []),
    ...(availableOnly ? [{ key: 'available', label: 'Open for consult', onRemove: () => removeFilter('available') }] : []),
    ...(emergencyOnly ? [{ key: 'emergency', label: 'Emergency', onRemove: () => removeFilter('emergency') }] : []),
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealHero} />

      {/* Teal header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Explore</Text>
          <Text style={s.headerSub}>Find medical practitioners & hospitals</Text>
        </View>
        <TouchableOpacity style={s.filterToggle} onPress={openFilterSheet}>
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? C.gold : '#fff'} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Paper card */}
      <View style={s.paperCard}>

        {/* Search */}
        <View style={s.searchRow}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={C.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by name, specialty or HBridge ID..."
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={onSearchChange}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); loadResults(''); }}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Type tabs */}
        <View style={s.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Combined filter bar: sort pill + specialty chips in one scrollable row */}
        <View style={s.filterBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBarRow}>
            {/* Sort pill — always first, tapping cycles sort mode */}
            <TouchableOpacity style={s.sortChip} onPress={cycleSortMode}>
              <Ionicons name={SORT_META[sort].icon as any} size={12} color="#fff" />
              <Text style={s.sortChipText}>{SORT_META[sort].label}</Text>
              <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>

            {/* Separator */}
            {tab !== 'hospitals' && <View style={s.filterBarSep} />}

            {/* Specialty chips */}
            {tab !== 'hospitals' && QUICK_SPECIALTIES.map(sp => {
              const active = selectedSpecialties.includes(sp);
              return (
                <TouchableOpacity
                  key={sp}
                  style={[s.filterChip, active && s.filterChipActive]}
                  onPress={() => quickToggleSp(sp)}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{sp}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active filter chips — shown only when sheet filters are applied */}
        {activeChips.length > 0 && (
          <View style={s.activeChipWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeChipRow}>
              {activeChips.map(chip => (
                <TouchableOpacity key={chip.key} style={s.activeChip} onPress={chip.onRemove}>
                  <Text style={s.activeChipText}>{chip.label}</Text>
                  <Ionicons name="close" size={11} color={C.teal} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={clearAllFilters} style={{ justifyContent: 'center' }}>
                <Text style={s.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Count */}
        <View style={s.countRow}>
          <Text style={s.countText}>
            {loading ? 'Searching...' : (() => {
              if (tab === 'workers') {
                const total = totalWorkers ?? workers.length;
                const loaded = workers.length;
                if (total === 0) return 'No practitioners found';
                const base = `${total.toLocaleString()} practitioner${total !== 1 ? 's' : ''}${query ? ` for "${query}"` : ''}`;
                return loaded < total ? `Showing ${loaded.toLocaleString()} of ${base}` : base;
              }
              if (tab === 'hospitals') {
                const total = totalHospitals ?? hospitals.length;
                const loaded = hospitals.length;
                if (total === 0) return 'No hospitals found';
                const base = `${total.toLocaleString()} hospital${total !== 1 ? 's' : ''}${query ? ` for "${query}"` : ''}`;
                return loaded < total ? `Showing ${loaded.toLocaleString()} of ${base}` : base;
              }
              // All tab
              const wp = totalWorkers ?? workers.length;
              const hp = totalHospitals ?? hospitals.length;
              const parts = [];
              if (wp > 0) parts.push(`${wp.toLocaleString()} practitioner${wp !== 1 ? 's' : ''}`);
              if (hp > 0) parts.push(`${hp.toLocaleString()} hospital${hp !== 1 ? 's' : ''}`);
              return parts.length ? parts.join(' · ') : 'No results found';
            })()}
          </Text>
        </View>

        {/* Results */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
        >
          {loading ? (
            <ActivityIndicator size="large" color={C.teal} style={{ marginTop: 40 }} />
          ) : results.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={44} color={C.muted} />
              <Text style={s.emptyTitle}>No results found</Text>
              <Text style={s.emptyHint}>Try a different name, specialty, or adjust your filters</Text>
            </View>
          ) : (
            <>
              {workers.length > 0 && tab !== 'hospitals' && (
                <>
                  {tab === 'all' && (
                    <View style={s.sectionHeader}>
                      <MaterialCommunityIcons name="stethoscope" size={14} color={C.teal} />
                      <Text style={s.sectionTitle}>Medical Practitioners</Text>
                      <Text style={s.sectionCount}>{workers.length}</Text>
                    </View>
                  )}
                  {workers.map(item => {
                    const isOnline = onlineUserIds.has(item.user_id);
                    const isAvailable = !!item.is_available;
                    const showGreenDot = isOnline && isAvailable;
                    const showOfflineAvail = isAvailable && !isOnline;
                    return (
                    <TouchableOpacity key={`w-${item.id}`} style={s.card} onPress={() => onViewPress(item)} activeOpacity={0.8}>
                      <View style={s.iconBox}>
                        {item.profile_image
                          ? <Image source={{ uri: item.profile_image }} style={s.avatar} />
                          : <MaterialCommunityIcons name="stethoscope" size={22} color={C.teal} />}
                        {showGreenDot && <View style={s.availDot} />}
                      </View>
                      <View style={s.cardInfo}>
                        <View style={s.cardNameRow}>
                          <Text style={s.cardName} numberOfLines={1}>{drLabel(item)}</Text>
                          {currentUserDoctorId === item.id && (
                            <View style={s.youBadge}><Text style={s.youBadgeText}>You</Text></View>
                          )}
                        </View>
                        <Text style={s.cardSub} numberOfLines={1}>{item.specialization || 'Medical Practitioner'}</Text>
                        {item.hbridge_id && (
                          <Text style={s.cardId}>{item.hbridge_id}</Text>
                        )}
                        <View style={s.cardMeta}>
                          {showGreenDot && (
                            <Text style={s.onlineText}>● Online</Text>
                          )}
                          {showOfflineAvail && (
                            <Text style={s.availText}>Open for consult</Text>
                          )}
                          {(showGreenDot || showOfflineAvail) && (item.average_rating > 0 || item.consultation_fee > 0) && (
                            <Text style={s.metaDot}>·</Text>
                          )}
                          {item.average_rating > 0 && item.total_reviews > 0 && (
                            <>
                              <Ionicons name="star" size={11} color={C.gold} />
                              <Text style={s.metaText}>{item.average_rating.toFixed(1)} ({item.total_reviews})</Text>
                              {item.consultation_fee > 0 && <Text style={s.metaDot}>·</Text>}
                            </>
                          )}
                          {item.consultation_fee > 0 && (
                            <Text style={s.metaText}>₦{item.consultation_fee.toLocaleString()}</Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={C.muted} />
                    </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {hospitals.length > 0 && tab !== 'workers' && (
                <>
                  {tab === 'all' && workers.length > 0 && <View style={s.divider} />}
                  {tab === 'all' && (
                    <View style={s.sectionHeader}>
                      <Ionicons name="business-outline" size={14} color={C.teal} />
                      <Text style={s.sectionTitle}>Hospitals</Text>
                      <Text style={s.sectionCount}>{hospitals.length}</Text>
                    </View>
                  )}
                  {hospitals.map(item => {
                    const typeColor = TYPE_COLORS[item.type] || C.teal;
                    return (
                    <TouchableOpacity key={`h-${item.id}`} style={s.card} onPress={() => onViewPress(item)} activeOpacity={0.8}>
                      <View style={[s.iconBox, { backgroundColor: typeColor + '18' }]}>
                        <Ionicons name="business" size={22} color={typeColor} />
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                        <View style={s.cardTagRow}>
                          <View style={[s.typeTag, { backgroundColor: typeColor + '15', borderColor: typeColor + '35' }]}>
                            <Text style={[s.typeTagText, { color: typeColor }]}>
                              {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Hospital'}
                            </Text>
                          </View>
                          {item.emergency_services && (
                            <View style={s.emergencyTag}>
                              <Text style={s.emergencyTagText}>Emergency</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.cardMeta}>
                          <Ionicons name="location-outline" size={11} color={C.muted} />
                          <Text style={s.metaText} numberOfLines={1}>
                            {item.city ? `${item.city}, ${item.state}` : item.state || 'Nigeria'}
                          </Text>
                          {item.rating > 0 && (
                            <>
                              <Text style={s.metaDot}>·</Text>
                              <Ionicons name="star" size={11} color={C.gold} />
                              <Text style={s.metaText}>{item.rating.toFixed(1)}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={C.muted} />
                    </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      </View>

      {/* ── Filter bottom sheet ── */}
      <Modal visible={showFilterSheet} transparent animationType="slide" onRequestClose={() => setShowFilterSheet(false)}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFilterSheet(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={resetStaged}>
                <Text style={s.resetText}>Reset all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetScroll}>

              {/* Location */}
              <Text style={s.filterSectionLabel}>LOCATION</Text>
              <TouchableOpacity style={s.statePickerBtn} onPress={() => setShowStatePicker(true)}>
                <Ionicons name="location-outline" size={16} color={stagedState !== 'All States' ? C.teal : C.muted} />
                <Text style={[s.statePickerText, stagedState !== 'All States' && s.statePickerTextActive]}>
                  {stagedState === 'All States' ? 'All States' : stagedState}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </TouchableOpacity>

              {/* Practitioner filters */}
              {showPractitionerFilters && (
                <>
                  <View style={s.filterDivider} />
                  <Text style={s.filterSectionLabel}>
                    SPECIALTY{'  '}
                    <Text style={s.multiHint}>(select multiple)</Text>
                  </Text>
                  <View style={s.chipGrid}>
                    {SPECIALTIES.map(sp => (
                      <TouchableOpacity
                        key={sp}
                        style={[s.fChip, stagedSpecialties.includes(sp) && s.fChipActive]}
                        onPress={() => toggleSp(sp)}
                      >
                        {stagedSpecialties.includes(sp) && (
                          <Ionicons name="checkmark" size={11} color="#fff" />
                        )}
                        <Text style={[s.fChipText, stagedSpecialties.includes(sp) && s.fChipTextActive]}>{sp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={s.filterDivider} />
                  <Text style={s.filterSectionLabel}>MINIMUM RATING</Text>
                  <View style={s.chipRow}>
                    {RATING_OPTIONS.map(r => (
                      <TouchableOpacity
                        key={r.value}
                        style={[s.fChip, stagedMinRating === r.value && s.fChipActive]}
                        onPress={() => setStagedMinRating(r.value)}
                      >
                        <Text style={[s.fChipText, stagedMinRating === r.value && s.fChipTextActive]}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={s.filterDivider} />
                  <View style={s.toggleRow}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={s.toggleLabel}>Open for consultations</Text>
                      <Text style={s.toggleSub}>Only show practitioners who accept new consultations</Text>
                    </View>
                    <Switch
                      value={stagedAvailable}
                      onValueChange={setStagedAvailable}
                      trackColor={{ false: C.border, true: C.teal }}
                      thumbColor="#fff"
                    />
                  </View>
                </>
              )}

              {/* Hospital filters */}
              {showHospitalFilters && (
                <>
                  <View style={s.filterDivider} />
                  <Text style={s.filterSectionLabel}>
                    HOSPITAL TYPE{'  '}
                    <Text style={s.multiHint}>(select multiple)</Text>
                  </Text>
                  <View style={s.chipRow}>
                    {HOSPITAL_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[s.fChip, stagedHospTypes.includes(t) && s.fChipActive]}
                        onPress={() => toggleHt(t)}
                      >
                        {stagedHospTypes.includes(t) && (
                          <Ionicons name="checkmark" size={11} color="#fff" />
                        )}
                        <Text style={[s.fChipText, stagedHospTypes.includes(t) && s.fChipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={s.filterDivider} />
                  <View style={s.toggleRow}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={s.toggleLabel}>Emergency services</Text>
                      <Text style={s.toggleSub}>Only show hospitals with 24/7 emergency care</Text>
                    </View>
                    <Switch
                      value={stagedEmergency}
                      onValueChange={setStagedEmergency}
                      trackColor={{ false: C.border, true: C.teal }}
                      thumbColor="#fff"
                    />
                  </View>
                </>
              )}
            </ScrollView>

            {/* Apply */}
            <View style={s.sheetFooter}>
              <TouchableOpacity style={s.applyBtn} onPress={applyFilters}>
                <Text style={s.applyBtnText}>
                  {stagedFilterCount > 0 ? `Apply  ·  ${stagedFilterCount} filter${stagedFilterCount !== 1 ? 's' : ''} active` : 'Apply Filters'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* State picker (opens over filter sheet) */}
      <Modal visible={showStatePicker} transparent animationType="slide">
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowStatePicker(false)} />
          <View style={[s.sheet, { maxHeight: '70%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.stateList}>
              {NIGERIAN_STATES.map(state => (
                <TouchableOpacity
                  key={state}
                  style={[s.stateRow, stagedState === state && s.stateRowActive]}
                  onPress={() => { setStagedState(state); setShowStatePicker(false); }}
                >
                  <Text style={[s.stateRowText, stagedState === state && s.stateRowTextActive]}>{state}</Text>
                  {stagedState === state && <Ionicons name="checkmark" size={16} color={C.teal} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.tealHero },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
  },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.4 },
  headerSub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  filterToggle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute', top: -3, right: -3,
    width: 17, height: 17, borderRadius: 9,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.tealHero,
  },
  filterBadgeText: { fontSize: 9, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Paper card
  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16 },

  // Search
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 0 },
  tab: { flex: 1, backgroundColor: C.surface, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.teal },
  tabText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  tabTextActive: { color: '#fff' },

  // Combined filter bar
  filterBarWrap: { paddingTop: 8, paddingBottom: 2 },
  filterBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  filterBarSep: { width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 2 },

  // Sort pill (always teal, cycles on tap)
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.teal, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  sortChipText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  // Specialty filter chips
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
  },
  filterChipActive: { backgroundColor: C.teal, borderColor: C.teal },
  filterChipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: C.text },
  filterChipTextActive: { color: '#fff', fontFamily: 'SpaceGrotesk_600SemiBold' },

  // Active filter chips (from sheet — shown below filter bar when applied)
  activeChipWrap: { paddingBottom: 2 },
  activeChipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4, alignItems: 'center' },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(11,126,138,0.1)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(11,126,138,0.25)',
  },
  activeChipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },
  clearAllText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.muted, textDecorationLine: 'underline' },

  // Count row
  countRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  countText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  // Results
  listContent: { gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C.text, flex: 1 },
  sectionCount: {
    fontSize: 11, color: '#fff', fontFamily: 'SpaceGrotesk_400Regular',
    backgroundColor: C.teal, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14,
    shadowColor: C.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: C.tealLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatar: { width: 48, height: 48, borderRadius: 12 },
  cardInfo: { flex: 1, gap: 3 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text, flex: 1 },
  cardSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  cardId:  { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: C.teal, letterSpacing: 0.8, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3, flexWrap: 'wrap' },
  metaText: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  metaDot: { fontSize: 11, color: C.muted },
  youBadge: { backgroundColor: C.teal, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  youBadgeText: { fontSize: 9, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  onlineText: { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#1E9E5A' },
  availText: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  // Hospital type badge
  cardTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  typeTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  typeTagText: { fontSize: 10, fontFamily: 'Montserrat_600SemiBold' },
  emergencyTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  emergencyTagText: { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: '#EF4444' },
  availDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1E9E5A',
    borderWidth: 2, borderColor: C.card,
  },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptyHint: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', paddingHorizontal: 24 },

  // Filter bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(8,50,54,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sheetTitle: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: C.text },
  resetText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  sheetScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sheetFooter: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: C.border },
  applyBtn: { backgroundColor: C.teal, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  applyBtnText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Filter sections
  filterSectionLabel: {
    fontSize: 10, fontFamily: 'Montserrat_700Bold', color: C.muted,
    letterSpacing: 1.2, marginBottom: 10,
  },
  multiHint: {
    fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular',
    color: C.muted, letterSpacing: 0, textTransform: 'none',
  },
  filterDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },

  // Chip grid (wraps — for specialties)
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Chip row (inline — for ratings, hospital types)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  fChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface,
  },
  fChipActive: { backgroundColor: C.teal, borderColor: C.teal },
  fChipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: C.text },
  fChipTextActive: { color: '#fff', fontFamily: 'SpaceGrotesk_600SemiBold' },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text, marginBottom: 3 },
  toggleSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, lineHeight: 16 },

  // State picker button (inside sheet)
  statePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: C.border,
  },
  statePickerText: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  statePickerTextActive: { color: C.teal, fontFamily: 'SpaceGrotesk_600SemiBold' },

  // State picker modal list
  stateList: { paddingVertical: 8, paddingBottom: 40 },
  stateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  stateRowActive: { backgroundColor: 'rgba(11,126,138,0.07)' },
  stateRowText: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  stateRowTextActive: { fontFamily: 'SpaceGrotesk_600SemiBold', color: C.teal },
});
