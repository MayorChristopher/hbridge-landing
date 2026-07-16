import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Pressable, Image,
  RefreshControl, ActivityIndicator, TextInput, Dimensions,
  PanResponder, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { locationService } from '../services/locationService';
import { drName } from '../utils/formatters';
import { usePresence } from '../context/PresenceContext';
import LoadingLogo from '../components/LoadingLogo';
import FadeScreen from '../components/FadeScreen';
import { useScreenTracking } from '../hooks/useAnalytics';
import SpotlightTour, { SpotlightStep } from '../components/SpotlightTour';
import FloatingAIChat from '../components/FloatingAIChat';
import { useToast } from '../components/ToastProvider';

const { width: SW, height: SH } = Dimensions.get('window');
const BTN_SIZE = 52;

const C = {
  paper: '#F5F3EE',
  paperDark: '#EDE9E0',
  card: '#FFFFFF',
  cardBorder: '#EAE5DA',
  ink: '#0C2E30',
  teal: '#0B7E8A',
  tealHero1: '#0C6570',
  tealHero2: '#083236',
  deckBack2: '#0B4E56',
  deckBack1: '#0A5B64',
  gold: '#D4A843',
  goldText: '#EBD79A',
  goldBadge: 'rgba(212,168,67,0.9)',
  goldBadgeText: '#3a2c07',
  muted: '#7A8785',
  muted2: '#97A2A0',
  textPrimary: '#16211F',
  green: '#1E9E5A',
};

const NAV_PAD = 110;

const SPEC_COLORS: Record<string, string> = {
  cardiology: '#EF4444', neurology: '#6366F1', pediatrics: '#8B5CF6',
  dermatology: '#EC4899', orthopedics: '#F97316', obstetrics: '#F43F5E',
  gynecology: '#F43F5E', psychiatry: '#7C3AED', ophthalmology: '#0EA5E9',
  ent: '#14B8A6', dentistry: '#22C55E', pharmacy: '#10B981',
  nursing: '#06B6D4', physiotherapy: '#84CC16', radiology: '#F59E0B',
  oncology: '#DC2626', urology: '#2563EB', gastro: '#D97706',
};
function specColor(sp: string): string {
  const s = (sp || '').toLowerCase();
  for (const [k, v] of Object.entries(SPEC_COLORS)) { if (s.includes(k)) return v; }
  return '#0B7E8A';
}

interface User { id: string; full_name: string; user_type: string; profile_image?: string; }
interface Doctor { id: string; user_id: string; full_name: string; title?: string; specialization: string; profile_image?: string; is_available: boolean; average_rating?: number; total_reviews?: number; consultation_fee?: number; }
interface Hospital { id: string; name: string; address?: string; city?: string; state?: string; distance?: string; rating?: number; latitude?: number; longitude?: number; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// â"€â"€ Swipeable appointment card deck â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function SwipeableDeck({ appointments, navigation }: { appointments: any[]; navigation: any }) {
  const [idx, setIdx] = React.useState(0);
  const swipeX = React.useRef(new Animated.Value(0)).current;
  const idxRef  = React.useRef(0);
  const apptsRef = React.useRef<any[]>([]);

  React.useEffect(() => { apptsRef.current = appointments; }, [appointments]);
  React.useEffect(() => { idxRef.current = idx; }, [idx]);
  React.useEffect(() => { setIdx(0); }, [appointments.length]);

  // Physical file stack: back cards peek below front card at rest, rise as front card swipes away
  const secondTranslateY = swipeX.interpolate({
    inputRange: [-SW, 0, SW], outputRange: [0, 10, 0], extrapolate: 'clamp',
  });
  const thirdTranslateY = swipeX.interpolate({
    inputRange: [-SW, 0, SW], outputRange: [10, 18, 10], extrapolate: 'clamp',
  });

  const go = React.useCallback((dir: 'next' | 'prev') => {
    const len = apptsRef.current.length;
    if (len <= 1) return;
    const toX = dir === 'next' ? -SW : SW;
    Animated.timing(swipeX, { toValue: toX, duration: 650, useNativeDriver: false }).start(() => {
      const next = dir === 'next'
        ? (idxRef.current + 1) % len
        : (idxRef.current - 1 + len) % len;
      setIdx(next);
      swipeX.setValue(0);
    });
  }, []);

  // Medium-speed auto cycle (5 seconds)
  React.useEffect(() => {
    if (appointments.length <= 1) return;
    const t = setInterval(() => go('next'), 8000);
    return () => clearInterval(t);
  }, [appointments.length, go]);

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: Animated.event([null, { dx: swipeX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) > 55 && apptsRef.current.length > 1) {
          go(dx < 0 ? 'next' : 'prev');
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: false, tension: 200, friction: 22 }).start();
        }
      },
    })
  ).current;

  if (appointments.length === 0) {
    return (
      <View style={s.deck}>
        <View style={s.deckBack2} />
        <View style={s.deckBack1} />
        <View style={s.deckFrontWrap}>
          <View style={[s.deckFront, { backgroundColor: C.tealHero2 }]}>
            <View style={s.deckOrb} />
            <View style={[s.deckTopRow]}>
              <Text style={s.deckLabel}>Next appointment</Text>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, marginBottom: 6 }}>
              <MaterialCommunityIcons name="calendar-plus" size={26} color="rgba(255,255,255,0.6)" />
              <Text style={[s.deckDocName, { opacity: 0.7, fontSize: 13 }]}>No upcoming appointments</Text>
            </View>
            <TouchableOpacity style={[s.deckBtnSolid, { marginTop: 10 }]} onPress={() => navigation.navigate('Explore', { tab: 'doctors' })}>
              <Text style={s.deckBtnSolidText}>Book now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const appt = appointments[idx];
  return (
    <View style={s.deck}>
      {/* Physical file stack: back cards peek from below, rise as front card swipes away */}
      {appointments.length > 2 && (
        <Animated.View style={[s.deckBack2, { transform: [{ translateY: thirdTranslateY }] }]} />
      )}
      {appointments.length > 1 && (
        <Animated.View style={[s.deckBack1, { transform: [{ translateY: secondTranslateY }] }]} />
      )}

      <Animated.View
        style={[s.deckFrontWrap, { transform: [{ translateX: swipeX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[s.deckFront, { backgroundColor: C.tealHero2 }]}>
          <View style={s.deckOrb} />
          <View style={s.deckTopRow}>
            <View style={s.deckBadge}>
              <Ionicons name="calendar" size={11} color="#D4A843" />
              <Text style={s.deckBadgeText}>
                {appt?.scheduled_at
                  ? new Date(appt.scheduled_at).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })
                  : 'Today'}
                {' · '}{appt?.scheduled_at ? new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
            {appointments.length > 1 && (
              <Text style={s.deckLabel}>{idx + 1} of {appointments.length}</Text>
            )}
          </View>
          <View style={s.deckDocRow}>
            <View style={s.deckAvatar}>
              <Text style={s.deckAvatarText}>
                {(appt?.doctor?.full_name || 'Dr').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.deckDocName}>{drName(appt?.doctor?.full_name, appt?.doctor?.title)}</Text>
              <Text style={s.deckDocSpec}>{appt?.doctor?.specialization || ''}{appt?.consultation_type ? ` · ${appt.consultation_type.replace('_', ' ')}` : ''}</Text>
            </View>
          </View>
          <View style={s.deckBtns}>
            <TouchableOpacity style={s.deckBtnOutline} onPress={() => navigation.navigate('Appointments')}>
              <Text style={s.deckBtnOutlineText}>Details</Text>
            </TouchableOpacity>
            {appt?.status === 'pending' ? (
              <View style={[s.deckBtnSolid, { backgroundColor: 'rgba(212,168,67,0.18)', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
                <Ionicons name="time-outline" size={13} color="#D4A843" />
                <Text style={[s.deckBtnSolidText, { color: '#D4A843' }]}>Awaiting Approval</Text>
              </View>
            ) : appt?.status === 'confirmed' ? (
              <TouchableOpacity style={[s.deckBtnSolid, { backgroundColor: '#1E9E5A', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} onPress={() => navigation.navigate('Appointments')}>
                <Ionicons name="card-outline" size={13} color="#fff" />
                <Text style={[s.deckBtnSolidText, { color: '#fff' }]}>Pay Now</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.deckBtnSolid} onPress={() => navigation.navigate('Appointments')}>
                <Ionicons name="videocam" size={14} color={C.teal} />
                <Text style={s.deckBtnSolidText}>Join call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Dot indicators only */}
      {appointments.length > 1 && (
        <View style={s.deckDots}>
          {appointments.map((_, i) => (
            <View key={i} style={[s.deckDot, i === idx && s.deckDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }: any) {
  const tabNav = useNavigation() as any;
  const toast = useToast();
  const onlineUserIds = usePresence();
  const [user, setUser] = useState<User | null>(null);
  const [showSpotlight, setShowSpotlight] = useState(false);

  // Refs for spotlight tour targeting
  const bellRef     = useRef<any>(null);
  const quickRowRef = useRef<any>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<any>(null);
  const [hospIdx, setHospIdx] = useState(0);
  const hospMoveX = useRef(new Animated.Value(0)).current;
  const hospSecondY = useRef(hospMoveX.interpolate({ inputRange: [-SW, 0, SW], outputRange: [0, 10, 0], extrapolate: 'clamp' })).current;
  const hospThirdY  = useRef(hospMoveX.interpolate({ inputRange: [-SW, 0, SW], outputRange: [10, 18, 10], extrapolate: 'clamp' })).current;

  // Keep refs so PanResponder closures always see current values
  const hospitalsRef = useRef<Hospital[]>([]);
  const hospIdxRef  = useRef(0);

  useEffect(() => { hospitalsRef.current = hospitals; }, [hospitals]);
  useEffect(() => { hospIdxRef.current = hospIdx; }, [hospIdx]);

  const cycleHosp = React.useCallback((dir: 'next' | 'prev') => {
    const len = hospitalsRef.current.length;
    if (len <= 1) return;
    const toX = dir === 'next' ? -SW : SW;
    Animated.timing(hospMoveX, { toValue: toX, duration: 650, useNativeDriver: false }).start(() => {
      const next = dir === 'next'
        ? (hospIdxRef.current + 1) % len
        : (hospIdxRef.current - 1 + len) % len;
      setHospIdx(next);
      hospMoveX.setValue(0);
    });
  }, []);

  const hospPanResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
    onPanResponderMove: Animated.event([null, { dx: hospMoveX }], { useNativeDriver: false }),
    onPanResponderRelease: (_, { dx }) => {
      if (Math.abs(dx) > 55 && hospitalsRef.current.length > 1) {
        cycleHosp(dx < 0 ? 'next' : 'prev');
      } else {
        Animated.spring(hospMoveX, { toValue: 0, useNativeDriver: false, tension: 180, friction: 22 }).start();
      }
    },
  })).current;

  useScreenTracking();

  useEffect(() => { loadData(); }, []);

  // Reload profile image + top practitioners on focus (catches post-rating updates)
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        const { data } = await supabase.from('profiles').select('profile_image, full_name').eq('id', authUser.id).maybeSingle();
        if (data) setUser(prev => prev ? { ...prev, profile_image: data.profile_image, full_name: data.full_name || prev.full_name } : prev);
      })();
      loadDoctors();
    }, [])
  );

  // Check for post-onboarding spotlight tour — only when screen is actually focused
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      (async () => {
        const pending = await AsyncStorage.getItem('spotlight_pending');
        if (pending === 'true') {
          await AsyncStorage.removeItem('spotlight_pending');
          setTimeout(() => setShowSpotlight(true), 600);
        }
      })();
    }, [user?.id])
  );

  // Realtime profile image sync
  useEffect(() => {
    let channel: any;
    const sub = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      channel = supabase
        .channel(`home-profile-${authUser.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${authUser.id}` },
          (payload: any) => {
            if (payload.new?.profile_image !== undefined) {
              setUser(prev => prev ? { ...prev, profile_image: payload.new.profile_image } : prev);
            }
            if (payload.new?.full_name !== undefined) {
              setUser(prev => prev ? { ...prev, full_name: payload.new.full_name } : prev);
            }
          })
        .subscribe();
    };
    sub();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Auto-cycle hospitals every 9s (only when there are multiple)
  useEffect(() => {
    if (hospitals.length < 2) return;
    const t = setInterval(() => cycleHosp('next'), 9000);
    return () => clearInterval(t);
  }, [hospitals.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUser(), loadDoctors(), loadHospitals(), loadAppointments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, profile_image')
        .eq('id', authUser.id)
        .maybeSingle();
      setUser(data || { id: authUser.id, full_name: authUser.user_metadata?.full_name || 'User', user_type: 'patient' });
    } catch { }
  };

  const loadDoctors = async () => {
    try {
      const { data } = await supabase.rpc('get_top_practitioners', { lim: 8 });
      if (data && data.length > 0) setDoctors(data);
    } catch { }
  };

  const loadHospitals = async () => {
    try {
      const { data } = await supabase
        .from('hospitals')
        .select('id, name, address, city, state, rating, latitude, longitude')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6);
      if (!data || data.length === 0) return;
      const withLabel = data.map((h: any) => ({ ...h, distance: h.city ? `${h.city}, ${h.state}` : h.state || '' }));
      setHospitals(withLabel.slice(0, 4));
      tryApplyLocation(data);
    } catch { }
  };

  const loadAppointments = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase
        .from('consultations')
        .select('id, scheduled_at, status, consultation_type, doctor:doctors(full_name, specialization)')
        .eq('patient_id', authUser.id)
        .in('status', ['scheduled', 'pending', 'confirmed'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5);
      if (data) setAppointments(data);
    } catch { }
  };

  const tryApplyLocation = async (data: any[]) => {
    try {
      const location = await locationService.getCurrentLocation();
      const { latitude, longitude } = location.coords;
      const withDist = data.map((h: any) => {
        if (h.latitude && h.longitude) {
          const dist = locationService.calculateDistance(latitude, longitude, h.latitude, h.longitude);
          return { ...h, distance: `${dist.toFixed(1)} km away` };
        }
        return { ...h, distance: h.city ? `${h.city}, ${h.state}` : '' };
      });
      withDist.sort((a: any, b: any) => { const da = parseFloat(a.distance), db = parseFloat(b.distance); return (!isNaN(da) && !isNaN(db)) ? da - db : 0; });
      setHospitals(withDist.slice(0, 4));
    } catch { }
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
        supabase.from('hospitals').select('id, name, city, state').ilike('name', `%${text}%`).limit(4),
        supabase.from('doctors').select('id, full_name, specialization').ilike('full_name', `%${text}%`).eq('verification_status', 'verified').limit(4),
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

  const firstName = user?.full_name?.split(' ')[0] || 'there';
  const initials = user?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  if (loading) return <LoadingLogo />;

  return (
    <FadeScreen>
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
      >
        {/* â"€â"€ BRAND BAR â"€â"€ */}
        <View style={s.brandBar}>
          <View style={s.brandLeft}>
            <Image source={require('../../assets/hbridge3.png')} style={s.brandLogo} />
            <Text style={s.brandName}>Hbridge</Text>
          </View>
          <View style={s.brandRight}>
            <View ref={bellRef} collapsable={false}>
              <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.userRing} onPress={() => navigation.navigate('Profile')}>
              <View style={s.userRingInner}>
                {user?.profile_image
                  ? <Image source={{ uri: user.profile_image }} style={s.userImg} />
                  : <Text style={s.userInitials}>{initials}</Text>}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* â"€â"€ GREETING â"€â"€ */}
        <View style={s.greetingWrap}>
          <Text style={s.helloName}>Hello, {firstName}</Text>
          <Text style={s.goodMorning}>{getGreeting()}</Text>
        </View>

        {/* â"€â"€ SEARCH â"€â"€ */}
        <View style={s.searchWrap}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={18} color={C.muted2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search doctors, hospitals..."
              placeholderTextColor={C.muted2}
              value={query}
              onChangeText={onSearchChange}
              returnKeyType="search"
              onFocus={() => query.trim() && setShowResults(true)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setShowResults(false); }}>
                <Ionicons name="close-circle" size={16} color={C.muted2} />
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
                        ? <MaterialCommunityIcons name="hospital-building" size={16} color={C.teal} />
                        : <MaterialCommunityIcons name="stethoscope" size={16} color={C.teal} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName}>{item._type === 'doctor' ? drName(item.full_name, item.title) : item.name}</Text>
                      <Text style={s.resultSub}>{item._type === 'doctor' ? item.specialization : `${item.city || ''}, ${item.state || ''}`}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={13} color={C.muted2} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <View style={s.paperCard}>
        {/* â"€â"€ QUICK ACTIONS â"€â"€ */}
        <View ref={quickRowRef} collapsable={false} style={s.quickRow}>
          {[
            { label: 'Practitioners', icon: 'stethoscope', logo: false, onPress: () => navigation.navigate('DoctorsList') },
            { label: 'Hospitals', icon: 'hospital-building', logo: false, onPress: () => navigation.navigate('HospitalsList') },
            { label: 'Records',   icon: 'folder-open-outline', logo: false, onPress: () => tabNav.navigate('Records') },
            { label: 'Book',      icon: 'calendar-plus',  logo: false, onPress: () => navigation.navigate('Appointments') },
          ].map((a) => (
            <Pressable
              key={a.label}
              style={s.qaItem}
              onPress={a.onPress}
            >
              {({ pressed }) => (
                <>
                  <View style={[s.qaIco, pressed && s.qaIcoPressed]}>
                    <MaterialCommunityIcons name={a.icon as any} size={21} color={pressed ? '#fff' : C.teal} />
                  </View>
                  <Text style={[s.qaLabel, pressed && { color: C.teal, fontFamily: 'Montserrat_700Bold' }]}>{a.label}</Text>
                </>
              )}
            </Pressable>
          ))}
        </View>

        {/* â"€â"€ NEXT APPOINTMENTS (swipeable stacked deck) â"€â"€ */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Next appointments</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
            <Text style={s.sectionMuted}>{appointments.length} upcoming</Text>
          </TouchableOpacity>
        </View>

        <SwipeableDeck appointments={appointments} navigation={navigation} />

        {/* ── TOP PRACTITIONERS ── */}
        <View style={[s.sectionHeader, { marginTop: 36 }]}>
          <Text style={s.sectionTitle}>Top Practitioners</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Explore', { tab: 'workers' })}>
            <Text style={s.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>

        {doctors.length === 0 ? (
          <View style={s.emptyCard}>
            <MaterialCommunityIcons name="stethoscope" size={28} color={C.muted2} />
            <Text style={s.emptyText}>No practitioners found</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.topDocScroll}
          >
            {doctors.map((doc: any) => {
              const isOnline = onlineUserIds.has(doc.user_id) && doc.is_available;
              const accent   = specColor(doc.specialization);
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={s.topDocCard}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('DoctorDetail', { doctor: doc })}
                >
                  {/* Top row: avatar + name + presence badge */}
                  <View style={s.topDocCardTop}>
                    <View style={[s.topDocAvatarBox, { backgroundColor: `${accent}18` }]}>
                      {doc.profile_image
                        ? <Image source={{ uri: doc.profile_image }} style={s.topDocAvatarImg} />
                        : <MaterialCommunityIcons name="stethoscope" size={22} color={accent} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={s.topDocNameRow}>
                        <Text style={s.topDocName} numberOfLines={1}>
                          {drName(doc.full_name, doc.title)}
                        </Text>
                        {isOnline && (
                          <View style={s.topDocLiveBadge}>
                            <Text style={s.topDocLiveBadgeText}>● Live</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.topDocSpec, { color: accent }]} numberOfLines={1}>
                        {doc.specialization || 'Medical Practitioner'}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={s.topDocDivider} />

                  {/* Meta row */}
                  <View style={s.topDocMeta}>
                    <View style={s.topDocMetaItem}>
                      <Ionicons name="star" size={12} color={C.gold} />
                      <Text style={s.topDocMetaText}>
                        {doc.average_rating.toFixed(1)}
                        {doc.total_reviews > 0 ? ` (${doc.total_reviews})` : ''}
                      </Text>
                    </View>
                    {doc.consultation_fee > 0 && (
                      <View style={s.topDocMetaItem}>
                        <Ionicons name="cash-outline" size={12} color={C.muted2} />
                        <Text style={s.topDocMetaMuted}>₦{(doc.consultation_fee / 1000).toFixed(0)}k</Text>
                      </View>
                    )}
                    {doc.years_experience > 0 && (
                      <View style={s.topDocMetaItem}>
                        <Ionicons name="time-outline" size={12} color={C.muted2} />
                        <Text style={s.topDocMetaMuted}>{doc.years_experience} yrs</Text>
                      </View>
                    )}
                  </View>

                  {/* Book button */}
                  <View style={s.topDocBookBtn}>
                    <Text style={s.topDocBookBtnText}>Book Consultation</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* â"€â"€ HOSPITALS NEARBY (stacked deck) â"€â"€ */}
        {hospitals.length > 0 && (
          <>
            <View style={[s.sectionHeader, { marginTop: 40 }]}>
              <Text style={s.sectionTitle}>Hospitals nearby</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Explore', { tab: 'hospitals' })}>
                <Text style={s.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.hospDeck} {...hospPanResponder.panHandlers}>
              {hospitals.length > 2 && <Animated.View style={[s.hospDeckBack2, { transform: [{ translateY: hospThirdY }] }]} />}
              {hospitals.length > 1 && <Animated.View style={[s.hospDeckBack1, { transform: [{ translateY: hospSecondY }] }]} />}
              <Animated.View style={[s.hospDeckFrontWrap, { transform: [{ translateX: hospMoveX }] }]}>
                <View style={[s.hospDeckFront, { backgroundColor: C.tealHero2 }]}>
                  <View style={s.hospDeckOrb} />
                  <View style={s.hospDeckTopRow}>
                    <Text style={s.hospDeckLabel}>Nearby hospitals</Text>
                    <View style={s.hospDeckRatingPill}>
                      <Ionicons name="star" size={11} color={C.gold} />
                      <Text style={s.hospDeckRatingVal}>{(hospitals[hospIdx]?.rating || 4.0).toFixed(1)}</Text>
                    </View>
                  </View>
                  <View style={s.hospDeckIconRow}>
                    <View style={s.hospDeckIconBox}>
                      <MaterialCommunityIcons name="hospital-building" size={22} color="#fff" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.hospDeckName} numberOfLines={1}>{hospitals[hospIdx]?.name}</Text>
                      <Text style={s.hospDeckSub} numberOfLines={1}>{hospitals[hospIdx]?.distance || hospitals[hospIdx]?.address || 'Nearby'}</Text>
                    </View>
                  </View>
                  <View style={s.hospDeckBtns}>
                    <TouchableOpacity style={s.hospDeckBtnOutline} onPress={() => navigation.navigate('HospitalDetail', { hospitalId: hospitals[hospIdx]?.id })}>
                      <Text style={s.hospDeckBtnOutlineText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.hospDeckBtnSolid} onPress={() => navigation.navigate('Explore', { tab: 'hospitals' })}>
                      <Text style={s.hospDeckBtnSolidText}>See all {hospitals.length}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
              {hospitals.length > 1 && (
                <View style={s.carouselDots}>
                  {hospitals.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => cycleHosp(i > hospIdxRef.current ? 'next' : 'prev')}>
                      <View style={[s.carouselDot, i === hospIdx && s.carouselDotActive]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
        </View>
      </ScrollView>

      <FloatingAIChat />

      <SpotlightTour
        visible={showSpotlight}
        steps={[
          {
            title: 'Your notifications',
            desc: 'Tap the bell to see booking updates, messages, and health alerts — all in one place.',
            targetRef: bellRef,
            tooltipSide: 'below',
            icon: 'notifications',
            accent: '#0B7E8A',
          },
          {
            title: 'Quick actions',
            desc: 'Jump to doctors, hospitals, medical records, or book a consultation in one tap.',
            targetRef: quickRowRef,
            tooltipSide: 'below',
            padding: 12,
            icon: 'grid',
            accent: '#0B7E8A',
          },
          {
            title: 'AI Health Assistant',
            desc: 'The glowing button in the corner is your 24/7 AI doctor. Tap it any time to describe your symptoms and get guidance.',
            staticTarget: { x: SW - BTN_SIZE - 16, y: SH - 160, width: BTN_SIZE, height: BTN_SIZE },
            tooltipSide: 'above',
            icon: 'chatbubble-ellipses',
            accent: '#D4A843',
            cutoutRadius: 999,
          },
          {
            title: 'Navigate your app',
            desc: 'Use the tab bar at the bottom to switch between Home, Explore, Records, Messages, and more.',
            staticTarget: { x: 0, y: SH - 90, width: SW, height: 90 },
            tooltipSide: 'above',
            icon: 'apps',
            accent: '#0B7E8A',
          },
        ] as SpotlightStep[]}
        onComplete={() => {
          setShowSpotlight(false);
          const name = (user as any)?.full_name?.split(' ')[0] || 'there';
          setTimeout(() => toast.showSuccess(`Welcome to Hbridge, ${name}!`), 300);
        }}
      />
    </SafeAreaView>
    </FadeScreen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },
  paperCard: { backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingBottom: NAV_PAD, flexGrow: 1 },

  // Brand bar
  brandBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLogo: { width: 34, height: 34, borderRadius: 17 },
  brandName: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: '#ffffff', letterSpacing: -0.3 },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: '#D4A843', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  userRing: { width: 40, height: 40, borderRadius: 20, padding: 2, backgroundColor: '#E2C97E' },
  userRingInner: { flex: 1, borderRadius: 18, backgroundColor: '#DCE7E5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userInitials: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#0B7E8A' },
  userImg: { width: '100%', height: '100%' },

  // Greeting
  greetingWrap: { paddingHorizontal: 20, marginTop: 6, marginBottom: 14 },
  helloName: { fontSize: 22, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.5, marginBottom: 0 },
  goodMorning: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.68)', marginTop: 1 },

  // Search
  searchWrap: { marginHorizontal: 20, marginTop: 10, marginBottom: 16, zIndex: 100 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DA', borderRadius: 14, paddingHorizontal: 14, height: 46, shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: '#16211F', paddingVertical: 0 },
  dropdown: { position: 'absolute', top: 54, left: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAE5DA', zIndex: 200, shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0ECE3' },
  resultIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(11,126,138,0.1)', alignItems: 'center', justifyContent: 'center' },
  resultName: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#16211F' },
  resultSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginTop: 1 },
  noResults: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', textAlign: 'center', padding: 16 },

  // Quick actions
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 4 },
  qaItem: { alignItems: 'center', gap: 6, flex: 1 },
  qaIco: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DA', alignItems: 'center', justifyContent: 'center', shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  qaIcoPressed: { backgroundColor: '#0B7E8A', borderColor: '#0B7E8A' },
  qaLabel: { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: '#3D4B49', textAlign: 'center', lineHeight: 13 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#0C2E30' },
  sectionLink: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#0B7E8A' },
  sectionMuted: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#97A2A0' },
  // Top Practitioners — appointment-card style
  topDocScroll: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 12,
  },
  topDocCard: {
    width: 256,
    backgroundColor: '#FFFFFF', borderRadius: 18,
    borderWidth: 1, borderColor: '#EAE5DA',
    padding: 16, gap: 12,
    shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  topDocCardTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  topDocAvatarBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  topDocAvatarImg: { width: 48, height: 48 },
  topDocNameRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 6,
  },
  topDocName: {
    fontSize: 14, fontFamily: 'Montserrat_700Bold',
    color: '#16211F', flex: 1,
  },
  topDocLiveBadge: {
    backgroundColor: 'rgba(30,158,90,0.1)',
    borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0,
  },
  topDocLiveBadgeText: {
    fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: '#1E9E5A',
  },
  topDocSpec: {
    fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 2,
  },
  topDocDivider: { height: 1, backgroundColor: '#EAE5DA' },
  topDocMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  },
  topDocMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topDocMetaText: {
    fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: '#16211F',
  },
  topDocMetaMuted: {
    fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0',
  },
  topDocBookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 38, backgroundColor: '#0C2E30', borderRadius: 11,
  },
  topDocBookBtnText: {
    fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#fff',
  },

  // Physical file stack â€" back cards fixed height peek below front card
  deck: { marginHorizontal: 20, marginTop: 14 },
  deckBack2: { position: 'absolute', left: 8, right: 8, top: 0, height: 188, backgroundColor: '#031316', borderRadius: 20, elevation: 2 },
  deckBack1: { position: 'absolute', left: 4, right: 4, top: 0, height: 188, backgroundColor: '#051E22', borderRadius: 20, elevation: 4 },
  deckFrontWrap: { elevation: 8 },
  deckFront: { borderRadius: 20, padding: 14, overflow: 'hidden', shadowColor: '#083236', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 10 },
  deckOrb: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(212,168,67,0.12)' },
  deckTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deckLabel: { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', color: '#EBD79A' },
  deckBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(212,168,67,0.9)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  deckBadgeText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: '#3a2c07' },
  deckDocRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  deckAvatar: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  deckAvatarText: { fontSize: 14, fontFamily: 'Montserrat_800ExtraBold', color: '#fff' },
  deckDocName: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  deckDocSpec: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  deckBtns: { flexDirection: 'row', gap: 9, marginTop: 13 },
  deckBtnOutline: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  deckBtnOutlineText: { fontSize: 12.5, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  deckBtnSolid: { flex: 1.3, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  deckBtnSolidText: { fontSize: 12.5, fontFamily: 'Montserrat_700Bold', color: '#083236' },

  // Deck dots
  deckDots: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  deckDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C8D4D2' },
  deckDotActive: { width: 14, borderRadius: 3, backgroundColor: '#0B7E8A' },

  // Doctor stacked deck â€" cards peek from below (same pattern as appointment deck)
  docDeck: { marginHorizontal: 20, marginTop: 14 },
  docDeckBack2: { position: 'absolute', left: 8, right: 8, top: 0, height: 182, backgroundColor: '#031316', borderRadius: 20, elevation: 2 },
  docDeckBack1: { position: 'absolute', left: 4, right: 4, top: 0, height: 182, backgroundColor: '#051E22', borderRadius: 20, elevation: 4 },
  docDeckFrontWrap: { elevation: 8 },
  docDeckFront: { borderRadius: 20, padding: 14, overflow: 'hidden', elevation: 10 },
  docDeckOrb: { position: 'absolute', right: -24, top: -24, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212,168,67,0.10)' },
  docDeckTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  docDeckLabel: { fontSize: 9.5, fontFamily: 'Montserrat_600SemiBold', letterSpacing: 1.4, textTransform: 'uppercase', color: '#8BB8C0' },
  docDeckCountBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,168,67,0.15)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  docDeckCountText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: '#D4A843' },
  docDeckDocRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  docDeckAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  docDeckDocName: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  docDeckDocSpec: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  docDeckRatingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(212,168,67,0.2)', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 4 },
  docDeckRatingVal: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#D4A843' },
  docDeckBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  docDeckBtnOutline: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  docDeckBtnOutlineText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  docDeckBtnSolid: { flex: 1.2, backgroundColor: 'rgba(212,168,67,0.9)', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  docDeckBtnSolidText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#2A1A04' },

  // Carousel dots (shared for doctor + hospital decks)
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  carouselDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C8D4D2' },
  carouselDotActive: { width: 16, borderRadius: 3, backgroundColor: '#0B7E8A' },

  // Hospital stacked deck â€" cards peek from below (same pattern as appointment deck)
  hospDeck: { marginHorizontal: 20, marginTop: 14 },
  hospDeckBack2: { position: 'absolute', left: 8, right: 8, top: 0, height: 175, backgroundColor: '#031316', borderRadius: 20, elevation: 2 },
  hospDeckBack1: { position: 'absolute', left: 4, right: 4, top: 0, height: 175, backgroundColor: '#051E22', borderRadius: 20, elevation: 4 },
  hospDeckFrontWrap: { elevation: 8 },
  hospDeckFront: { borderRadius: 20, padding: 14, overflow: 'hidden', elevation: 10 },
  hospDeckOrb: { position: 'absolute', right: -20, top: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(212,168,67,0.12)' },
  hospDeckTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hospDeckLabel: { fontSize: 9.5, fontFamily: 'Montserrat_600SemiBold', letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  hospDeckRatingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(212,168,67,0.2)', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 4 },
  hospDeckRatingVal: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: '#D4A843' },
  hospDeckIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  hospDeckIconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  hospDeckName: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  hospDeckSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.58)', marginTop: 2 },
  hospDeckBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hospDeckBtnOutline: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  hospDeckBtnOutlineText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  hospDeckBtnSolid: { flex: 1.2, backgroundColor: 'rgba(212,168,67,0.88)', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  hospDeckBtnSolidText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#2A1A04' },

  // Generic empty
  emptyCard: { marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAE5DA', padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785' },
});
