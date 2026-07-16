import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Animated, StatusBar,
  Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingLogo from '../components/LoadingLogo';
import FadeScreen from '../components/FadeScreen';
import { useChatBadge } from '../context/ChatBadgeContext';
import { useRecordsBadge } from '../context/RecordsBadgeContext';
import SpotlightTour, { SpotlightStep } from '../components/SpotlightTour';
import { useToast } from '../components/ToastProvider';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  tealHero1: '#0C6570', tealHero2: '#083236', gold: '#D4A843',
};

const CONSULT_ICONS: Record<string, string> = {
  audio: 'call-outline', video: 'videocam-outline',
  in_person: 'walk-outline', follow_up: 'refresh-outline', online: 'globe-outline',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// â”€â”€ Appointment card deck â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ApptDeck({ appointments, navigation }: { appointments: any[]; navigation: any }) {
  const [idx, setIdx] = React.useState(0);
  const swipeX = React.useRef(new Animated.Value(0)).current;
  const idxRef  = React.useRef(0);
  const apptsRef = React.useRef<any[]>([]);
  React.useEffect(() => { apptsRef.current = appointments; }, [appointments]);
  React.useEffect(() => { idxRef.current = idx; }, [idx]);
  React.useEffect(() => { setIdx(0); }, [appointments.length]);

  const secondY = swipeX.interpolate({
    inputRange: [-SW, 0, SW], outputRange: [0, 10, 0], extrapolate: 'clamp',
  });

  const go = useCallback((dir: 'next' | 'prev') => {
    const len = apptsRef.current.length;
    if (len <= 1) return;
    const toX = dir === 'next' ? -SW : SW;
    // Must use useNativeDriver: false â€” PanResponder tracking requires JS thread
    Animated.timing(swipeX, { toValue: toX, duration: 300, useNativeDriver: false }).start(() => {
      const next = dir === 'next'
        ? (idxRef.current + 1) % len
        : (idxRef.current - 1 + len) % len;
      setIdx(next);
      swipeX.setValue(0);
    });
  }, []);

  const pan = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
    onPanResponderMove: Animated.event([null, { dx: swipeX }], { useNativeDriver: false }),
    onPanResponderRelease: (_, { dx }) => {
      if (Math.abs(dx) > 55 && apptsRef.current.length > 1) go(dx < 0 ? 'next' : 'prev');
      else Animated.spring(swipeX, { toValue: 0, useNativeDriver: false, tension: 400, friction: 22 }).start();
    },
  })).current;

  // Medium-speed auto cycle
  React.useEffect(() => {
    if (appointments.length <= 1) return;
    const t = setInterval(() => go('next'), 5000);
    return () => clearInterval(t);
  }, [appointments.length, go]);

  if (appointments.length === 0) {
    return (
      <View style={ds.deck}>
        <View style={ds.deckBack2} />
        <View style={ds.deckBack1} />
        <View style={[ds.deckFront, ds.deckFrontWrap]}>
          <View style={ds.deckOrb} />
          <Text style={ds.deckLabel}>NEXT APPOINTMENT</Text>
          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
            <Ionicons name="calendar-outline" size={28} color="rgba(255,255,255,0.45)" />
            <Text style={[ds.apptName, { color: 'rgba(255,255,255,0.7)', marginTop: 4 }]}>No upcoming appointments</Text>
          </View>
          <TouchableOpacity style={ds.deckBtn} onPress={() => navigation.navigate('DoctorAppointmentRequests')}>
            <Text style={ds.deckBtnText}>View Requests</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const a = appointments[idx];
  const next2 = appointments[(idx + 1) % appointments.length];
  const next3 = appointments[(idx + 2) % appointments.length];

  return (
    <View style={ds.deck}>
      {appointments.length > 2 && <View style={ds.deckBack2} />}
      {appointments.length > 1 && (
        <Animated.View style={[ds.deckBack1, { transform: [{ translateY: secondY }] }]} />
      )}
      <Animated.View style={[ds.deckFrontWrap, { transform: [{ translateX: swipeX }] }]} {...pan.panHandlers}>
        <View style={ds.deckFront}>
          <View style={ds.deckOrb} />
          <View style={ds.deckTopRow}>
            <Text style={ds.deckLabel}>NEXT APPOINTMENT</Text>
            {appointments.length > 1 && (
              <Text style={ds.deckCount}>{idx + 1}/{appointments.length}</Text>
            )}
          </View>
          <View style={ds.apptRow}>
            <View style={ds.apptAvatar}>
              {a.profiles?.profile_image
                ? <Image source={{ uri: a.profiles.profile_image }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                : <Ionicons name="person" size={22} color="rgba(255,255,255,0.8)" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ds.apptName}>{a.profiles?.full_name || 'Patient'}</Text>
              <Text style={ds.apptTime}>{formatDate(a.scheduled_at)}</Text>
              <View style={ds.apptTypeRow}>
                <Ionicons name={(CONSULT_ICONS[a.consultation_type] || 'medical-outline') as any} size={11} color="rgba(255,255,255,0.7)" />
                <Text style={ds.apptTypeText}>{(a.consultation_type || 'consultation').replace('_', ' ')}</Text>
              </View>
            </View>
            <View style={[ds.apptStatusBadge, {
              backgroundColor: a.status === 'pending' ? 'rgba(212,168,67,0.18)' : a.status === 'confirmed' ? 'rgba(30,158,90,0.15)' : 'rgba(255,255,255,0.12)',
            }]}>
              <Text style={[ds.apptStatusText, {
                color: a.status === 'pending' ? '#D4A843' : a.status === 'confirmed' ? '#1E9E5A' : '#fff',
              }]}>
                {a.status === 'pending' ? 'Awaiting' : a.status === 'confirmed' ? 'Approved' : 'Scheduled'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={ds.deckBtn} onPress={() => navigation.navigate('DoctorAppointmentRequests')}>
            <Text style={ds.deckBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      {appointments.length > 1 && (
        <View style={ds.deckDots}>
          {appointments.map((_, i) => (
            <View key={i} style={[ds.deckDot, i === idx && ds.deckDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function DoctorHomeScreen({ navigation }: any) {
  // useNavigation() gives us the TAB navigator context â€” needed to switch tabs WITH the navbar visible
  const tabNav = useNavigation() as any;
  const [profile, setProfile]       = useState<any>(null);
  const [doctor, setDoctor]         = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats]           = useState({ today: 0, upcoming: 0, completed: 0, patients: 0 });
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const { unreadCount } = useChatBadge();
  const { newRecordsCount } = useRecordsBadge();
  const [showSpotlight, setShowSpotlight] = useState(false);

  const toggleScale = useRef(new Animated.Value(1)).current;
  const availRef    = useRef<any>(null);
  const statsRef    = useRef<any>(null);
  const quickRef    = useRef<any>(null);

  useFocusEffect(
    React.useCallback(() => { loadData(); }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const pending = await AsyncStorage.getItem('doctor_spotlight_pending');
        if (pending === 'true') {
          await AsyncStorage.removeItem('doctor_spotlight_pending');
          setTimeout(() => setShowSpotlight(true), 700);
        }
      })();
    }, [])
  );

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);

      let { data: doc } = await supabase.from('doctors').select('*').eq('user_id', user.id).maybeSingle();
      if (!doc) {
        const { data: created } = await supabase.from('doctors').insert({
          user_id: user.id, full_name: prof?.full_name || '',
          specialization: prof?.specialization || 'General Practice',
          medical_license: prof?.medical_license || 'PENDING',
          verification_status: 'verified', is_available: true, average_rating: 0, total_reviews: 0,
        }).select().single();
        doc = created;
      }
      setDoctor(doc);
      setIsAvailable(doc?.is_available ?? true);
      if (!doc) return;

      const [{ data: appts }, { data: convs }] = await Promise.all([
        supabase
          .from('consultations')
          .select('id, scheduled_at, status, consultation_type, symptoms, patient_id')
          .eq('doctor_id', doc.id)
          .in('status', ['pending', 'confirmed', 'scheduled', 'in_progress'])
          .gte('scheduled_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('conversations')
          .select('patient_id')
          .eq('doctor_id', doc.id),
      ]);

      const patientIds = [...new Set((appts || []).map((a: any) => a.patient_id).filter(Boolean))];
      const { data: patientProfiles } = patientIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, profile_image').in('id', patientIds)
        : { data: [] };
      const patientMap = new Map((patientProfiles || []).map((p: any) => [p.id, p]));
      const withProfiles = (appts || []).map((a: any) => ({ ...a, profiles: patientMap.get(a.patient_id) || null }));

      const today = new Date().toDateString();
      const activeStatuses = ['scheduled', 'confirmed', 'pending'];
      const todayAppts  = withProfiles.filter(a => new Date(a.scheduled_at).toDateString() === today && activeStatuses.includes(a.status));
      const upcoming    = withProfiles.filter(a => activeStatuses.includes(a.status) && new Date(a.scheduled_at) >= new Date());
      const completed   = withProfiles.filter(a => a.status === 'completed');

      const allPatientIds = new Set([
        ...withProfiles.map((a: any) => a.patient_id),
        ...(convs || []).map((c: any) => c.patient_id),
      ].filter(Boolean));
      setStats({ today: todayAppts.length, upcoming: upcoming.length, completed: completed.length, patients: allPatientIds.size });
      setAppointments(upcoming.slice(0, 8));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const toggleAvailability = async () => {
    if (!doctor || togglingAvail) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(toggleScale, { toValue: 0.88, tension: 300, friction: 10, useNativeDriver: true }),
      Animated.spring(toggleScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    setTogglingAvail(true);
    const next = !isAvailable;
    setIsAvailable(next);
    await supabase.from('doctors').update({ is_available: next }).eq('id', doctor.id);
    setTogglingAvail(false);
  };

  const STAT_ACTIONS = [
    { key: 'today',     label: 'Today',     onPress: () => navigation.navigate('DoctorAppointmentRequests') },
    { key: 'upcoming',  label: 'Upcoming',  onPress: () => navigation.navigate('DoctorAppointmentRequests') },
    { key: 'completed', label: 'Completed', onPress: () => navigation.navigate('DoctorAppointmentRequests') },
    { key: 'patients',  label: 'Patients',  onPress: () => tabNav.navigate('Patients') },
  ];

  if (loading) return <LoadingLogo />;


  const firstName = (profile?.full_name || '')
    .replace(/^(dr\.?|prof\.?|nurse\.?|pharm\.?|physio\.?|rad\.?)\s+/i, '')
    .split(' ')[0] || 'Doctor';
  const workerTitleShort = (doctor?.title || 'Dr.').replace(/\.$/, '');

  const QUICK_ACTIONS = [
    {
      icon: 'calendar-outline', label: 'Appointments',
      badge: stats.today > 0 ? stats.today : undefined,
      onPress: () => navigation.navigate('DoctorAppointmentRequests'),
    },
    {
      icon: 'people-outline', label: 'My Patients',
      badge: undefined,
      onPress: () => tabNav.navigate('Patients'),
    },
    {
      icon: 'folder-open-outline', label: 'Records',
      badge: newRecordsCount > 0 ? newRecordsCount : undefined,
      // tabNav switches to the DoctorCaseFiles TAB so the navbar stays visible
      onPress: () => tabNav.navigate('DoctorCaseFiles'),
    },
    {
      icon: 'chatbubble-ellipses-outline', label: 'Messages',
      badge: unreadCount > 0 ? unreadCount : undefined,
      onPress: () => tabNav.navigate('DoctorMessages'),
    },
  ];

  return (
    <FadeScreen>
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
      >
        {/* Teal Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>{getGreeting()}</Text>
              <Text style={s.name}>{workerTitleShort}. {firstName}</Text>
            </View>

            <Animated.View ref={availRef} style={{ transform: [{ scale: toggleScale }], marginRight: 12 }}>
              <TouchableOpacity
                style={[s.availToggle, isAvailable ? s.availOn : s.availOff]}
                onPress={toggleAvailability} activeOpacity={0.8}
              >
                <View style={[s.availDot, { backgroundColor: isAvailable ? '#FFFFFF' : '#9AA3AE' }]} />
                <Text style={[s.availText, { color: isAvailable ? '#FFFFFF' : '#9AA3AE' }]}>
                  {isAvailable ? 'Online' : 'Offline'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={s.avatarBtn} onPress={() => navigation.navigate('Profile')}>
              <View style={s.avatarRing}>
                {profile?.profile_image
                  ? <Image source={{ uri: profile.profile_image }} style={s.avatar} />
                  : <View style={s.avatarFallback}>
                      <MaterialCommunityIcons name="stethoscope" size={24} color="#fff" />
                    </View>}
              </View>
            </TouchableOpacity>
          </View>

          {doctor && (
            <View style={s.credStrip}>
              <MaterialCommunityIcons name="certificate-outline" size={12} color="rgba(255,255,255,0.65)" />
              <Text style={s.credText} numberOfLines={1}>
                {doctor.medical_license && doctor.medical_license !== 'PENDING' ? doctor.medical_license : 'License pending'}
              </Text>
              <View style={s.credDot} />
              <MaterialCommunityIcons name="stethoscope" size={12} color="rgba(255,255,255,0.65)" />
              <Text style={s.credText} numberOfLines={1}>{doctor.specialization || 'General Practice'}</Text>
            </View>
          )}
        </View>

        {/* White card area */}
        <View style={s.contentCard}>
          <View style={s.handle} />

          {/* Payout nudge banner */}
          {doctor && !doctor.paystack_subaccount && (
            <TouchableOpacity
              style={s.payoutBanner}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
            >
              <View style={s.payoutBannerIcon}>
                <Ionicons name="wallet-outline" size={18} color="#D4A843" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.payoutBannerTitle}>Set up your payout account</Text>
                <Text style={s.payoutBannerSub}>Add your bank details to receive automatic payment splits</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D4A843" />
            </TouchableOpacity>
          )}

          {/* Stats */}
          <View ref={statsRef} style={s.statsRow}>
            {STAT_ACTIONS.map(st => (
              <TouchableOpacity key={st.key} style={s.statCard} onPress={st.onPress} activeOpacity={0.75}>
                <Text style={s.statVal}>{(stats as any)[st.key]}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Actions */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View ref={quickRef} style={s.actionsContainer}>
              {QUICK_ACTIONS.map((a, i) => (
                <TouchableOpacity key={i} style={s.actionCard} onPress={a.onPress} activeOpacity={0.75}>
                  <View style={{ position: 'relative' }}>
                    <View style={s.actionIcon}>
                      <Ionicons name={a.icon as any} size={22} color={C.teal} />
                    </View>
                    {!!a.badge && (
                      <View style={s.actionBadge}>
                        <Text style={s.actionBadgeText}>{a.badge > 99 ? '99+' : a.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Upcoming Appointments Deck */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Upcoming Appointments</Text>
              <TouchableOpacity onPress={() => navigation.navigate('DoctorAppointmentRequests')}>
                <Text style={s.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ApptDeck appointments={appointments} navigation={navigation} />
          </View>
        </View>
      </ScrollView>

      <SpotlightTour
        visible={showSpotlight}
        steps={[
          {
            title: 'Your availability',
            desc: "Toggle Online/Offline to control whether patients can book you. Go offline when you're unavailable.",
            targetRef: availRef,
            tooltipSide: 'below',
            icon: 'radio-button-on',
            accent: '#D4A843',
          },
          {
            title: 'Your daily stats',
            desc: "See today's appointments, upcoming sessions, completed consultations and total patients — all at a glance.",
            targetRef: statsRef,
            tooltipSide: 'below',
            icon: 'stats-chart',
            accent: '#0B7E8A',
          },
          {
            title: 'Quick actions',
            desc: 'Jump to appointments, patients, shared records, or messages in one tap.',
            targetRef: quickRef,
            tooltipSide: 'below',
            padding: 12,
            icon: 'grid',
            accent: '#0B7E8A',
          },
          {
            title: 'Navigate your app',
            desc: 'Use the tab bar below to switch between Home, Patients, Records, Messages and your Profile.',
            staticTarget: { x: 0, y: SH - 90, width: SW, height: 90 },
            tooltipSide: 'above',
            icon: 'apps',
            accent: '#0B7E8A',
          },
        ] as SpotlightStep[]}
        onComplete={() => setShowSpotlight(false)}
      />
    </SafeAreaView>
    </FadeScreen>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },
  header: { flexDirection: 'column', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, backgroundColor: '#083236' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  credStrip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  credText: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', maxWidth: 150 },
  credDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  greeting: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginBottom: -2 },
  name: { fontSize: 22, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.4 },
  availToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  availOn: { backgroundColor: 'rgba(212,168,67,0.25)', borderWidth: 1.5, borderColor: 'rgba(212,168,67,0.5)' },
  availOff: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 12, fontFamily: 'Montserrat_700Bold' },
  avatarBtn: {},
  avatarRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  contentCard: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 110, minHeight: SH * 0.82 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },

  payoutBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 16, padding: 14,
    backgroundColor: 'rgba(212,168,67,0.10)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,168,67,0.30)',
  },
  payoutBannerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(212,168,67,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  payoutBannerTitle: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#0C2E30' },
  payoutBannerSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', marginTop: 2 },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 8, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#0C2E30', borderRadius: 14, padding: 12, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 20, fontFamily: 'Montserrat_800ExtraBold', color: '#fff' },
  statLabel: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', textAlign: 'center' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 14 },
  seeAll: { fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },
  actionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '47%', backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: C.border },
  actionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  actionBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 2, borderColor: C.card,
  },
  actionBadgeText: { fontSize: 9, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});

// Appointment deck styles
const ds = StyleSheet.create({
  deck: { minHeight: 200 },
  deckBack2: {
    position: 'absolute', left: 8, right: 8, top: 0, height: 172,
    backgroundColor: '#031316', borderRadius: 20, elevation: 2,
  },
  deckBack1: {
    position: 'absolute', left: 4, right: 4, top: 0, height: 172,
    backgroundColor: '#051E22', borderRadius: 20, elevation: 4,
  },
  deckFrontWrap: { elevation: 8 },
  deckFront: { borderRadius: 20, padding: 16, overflow: 'hidden', backgroundColor: '#083236' },
  deckOrb: { position: 'absolute', right: -24, top: -24, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212,168,67,0.10)' },
  deckTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  deckLabel: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2 },
  deckCount: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: 'rgba(255,255,255,0.5)' },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  apptAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  apptName: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  apptTime: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  apptTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  apptTypeText: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' },
  apptStatusBadge: { backgroundColor: 'rgba(212,168,67,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,168,67,0.35)' },
  apptStatusText: { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: '#D4A843' },
  deckBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  deckBtnText: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  deckDots: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  deckDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C8D4D2' },
  deckDotActive: { width: 14, borderRadius: 3, backgroundColor: C.teal },
});
