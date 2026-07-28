import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import SpotlightTour, { SpotlightStep } from '../components/SpotlightTour';
import { getOrCreateHospitalRow, isHospitalSetupComplete } from '../utils/hospitalSetup';
import { shadows, borderRadius } from '../utils/design';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)', ink: '#083236',
  gold: '#D4A843', green: '#1E9E5A',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HospitalHomeScreen({ navigation }: any) {
  const toast = useToast();
  const tabNav = useNavigation<any>(); // tab navigator's navigation — use for same-tab screen switches
  const [profile, setProfile]       = useState<any>(null);
  const [hospital, setHospital]     = useState<any>(null);
  const [stats, setStats]           = useState({ records: 0, doctors: 0, patients: 0 });
  const [recent, setRecent]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  const bellRef      = useRef<any>(null);
  const actionsRef   = useRef<any>(null);
  const statsRef     = useRef<any>(null);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Trigger spotlight tour after new account creation
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const pending = await AsyncStorage.getItem('hospital_spotlight_pending');
      if (pending === 'true') {
        await AsyncStorage.removeItem('hospital_spotlight_pending');
        setTimeout(() => setShowSpotlight(true), 800);
      }
    })();
  }, [profile]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, profile_image, hospital_name')
        .eq('id', user.id)
        .maybeSingle();
      setProfile(prof);

      // Find matching hospital record by name
      const hospitalName = prof?.hospital_name || prof?.full_name;
      let hospitalId: string | null = null;
      if (hospitalName) {
        let hosp: any = null;
        try {
          hosp = await getOrCreateHospitalRow(hospitalName);
        } catch (e) { console.warn('Hospital row creation failed', e); }
        setHospital(hosp);
        hospitalId = hosp?.id ?? null;
      }

      if (hospitalId) {
        const [
          { data: records },
          { data: doctors },
          { data: patients },
        ] = await Promise.all([
          supabase.from('medical_record_access')
            .select('id, granted_at, access_type, medical_records(title, record_type), profiles!patient_id(full_name, profile_image)')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .order('granted_at', { ascending: false })
            .limit(20),
          supabase.from('hospital_staff')
            .select('doctor_id')
            .eq('hospital_id', hospitalId)
            .eq('status', 'active'),
          supabase.from('medical_record_access')
            .select('patient_id')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true),
        ]);

        const uniqueDoctors  = new Set((doctors  || []).map((r: any) => r.doctor_id).filter(Boolean));
        const uniquePatients = new Set((patients || []).map((r: any) => r.patient_id).filter(Boolean));

        setStats({ records: (records || []).length, doctors: uniqueDoctors.size, patients: uniquePatients.size });
        setRecent((records || []).slice(0, 8));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const hospitalName = profile?.hospital_name || 'Your Hospital';
  const initial = hospitalName[0]?.toUpperCase() || 'H';

  const QUICK_ACTIONS = [
    { icon: 'folder-open-outline', label: 'Records',  onPress: () => navigation.navigate('HospitalIncomingRecords') },
    { icon: 'people-outline',      label: 'Staff',    onPress: () => tabNav.navigate('HospitalStaff') },
    { icon: 'chatbubble-outline',  label: 'Messages', onPress: () => tabNav.navigate('HospitalMessages') },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />

      {/* Header */}
      <View style={s.header}>
        {/* Brand row */}
        <View style={s.brandRow}>
          <View style={s.brandLeft}>
            <Image source={require('../../assets/hbridge3.png')} style={s.brandLogo} />
            <Text style={s.brandName}>Hbridge</Text>
          </View>
          <View style={s.brandRight}>
            <View ref={bellRef} collapsable={false}>
              <TouchableOpacity style={s.notifBtn} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {hospital?.logo_url
              ? <Image source={{ uri: hospital.logo_url }} style={s.avatar} />
              : <View style={s.avatarFallback}><Ionicons name="business" size={20} color="#fff" /></View>}
          </View>
        </View>

        {/* Greeting row */}
        <View style={s.greetingRow}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.hospitalName} numberOfLines={1}>{hospitalName}</Text>
        </View>

        {/* Facility location strip — same slot DoctorHomeScreen uses for credentials */}
        {hospital && (
          <View style={s.credStrip}>
            <Ionicons name="business-outline" size={12} color="rgba(255,255,255,0.65)" />
            <Text style={s.credText} numberOfLines={1}>
              {hospital.type ? `${hospital.type[0].toUpperCase()}${hospital.type.slice(1)} Hospital` : 'Hospital'}
            </Text>
            <View style={s.credDot} />
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.65)" />
            <Text style={s.credText} numberOfLines={1}>
              {isHospitalSetupComplete(hospital) ? `${hospital.city}, ${hospital.state}` : 'Location pending'}
            </Text>
            {hospital.rating > 0 && (
              <>
                <View style={s.credDot} />
                <Ionicons name="star" size={12} color={C.gold} />
                <Text style={s.credText}>{hospital.rating.toFixed(1)}</Text>
              </>
            )}
          </View>
        )}

        {/* Stats — inside the header, right after location, matching DoctorHomeScreen */}
        <View ref={statsRef} style={s.headerStatsRow}>
          <TouchableOpacity style={s.headerStatCard} activeOpacity={0.75} onPress={() => navigation.navigate('HospitalIncomingRecords')}>
            <Text style={s.headerStatVal}>{stats.records}</Text>
            <Text style={s.headerStatLabel}>Records</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerStatCard} activeOpacity={0.75} onPress={() => tabNav.navigate('HospitalStaff')}>
            <Text style={s.headerStatVal}>{stats.doctors}</Text>
            <Text style={s.headerStatLabel}>Practitioners</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerStatCard} activeOpacity={0.75} onPress={() => navigation.navigate('HospitalIncomingRecords')}>
            <Text style={s.headerStatVal}>{stats.patients}</Text>
            <Text style={s.headerStatLabel}>Patients</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.paper}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 60 }} />
        ) : (
          <>
            {!profile?.hospital_name ? (
              <TouchableOpacity style={s.linkBanner} activeOpacity={0.8} onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="warning-outline" size={18} color={C.gold} />
                <Text style={s.linkBannerText}>
                  Hospital name not set. Tap here → go to Profile → Edit to enter your hospital name.
                </Text>
              </TouchableOpacity>
            ) : !isHospitalSetupComplete(hospital) && (
              <TouchableOpacity style={s.setupBanner} activeOpacity={0.85} onPress={() => navigation.navigate('Profile')}>
                <View style={s.setupBannerIcon}>
                  <Ionicons name="business-outline" size={19} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.setupBannerTitle}>Complete Your Facility Profile</Text>
                  <Text style={s.setupBannerSub}>
                    Add your address so practitioners can find and join your hospital
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.gold} />
              </TouchableOpacity>
            )}

            {/* Quick actions — boxless list rows, matching DoctorHomeScreen */}
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View ref={actionsRef} collapsable={false} style={s.actionsContainer}>
              {QUICK_ACTIONS.map((a, i) => (
                <TouchableOpacity
                  key={a.label}
                  style={[s.actionRow, i === QUICK_ACTIONS.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={a.onPress}
                  activeOpacity={0.75}
                >
                  <View style={[s.actionIcon, { backgroundColor: 'rgba(11,126,138,0.1)' }]}>
                    <Ionicons name={a.icon as any} size={20} color={C.teal} />
                  </View>
                  <Text style={s.actionLabel}>{a.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.muted} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent records */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent Incoming Records</Text>
              {recent.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('HospitalIncomingRecords')}>
                  <Text style={s.seeAll}>See all</Text>
                </TouchableOpacity>
              )}
            </View>

            {recent.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="folder-open-outline" size={40} color={C.muted} />
                <Text style={s.emptyText}>No records received yet</Text>
                <Text style={s.emptySubText}>Records shared with your hospital will appear here</Text>
              </View>
            ) : (
              recent.map((rec: any) => {
                const patient = rec.profiles;
                const record  = rec.medical_records;
                return (
                  <TouchableOpacity
                    key={rec.id}
                    style={s.recordCard}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('HospitalIncomingRecords')}
                  >
                    <View style={s.recordIcon}>
                      <Ionicons name="document-text-outline" size={20} color={C.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recordTitle} numberOfLines={1}>{record?.title || 'Medical Record'}</Text>
                      <Text style={s.recordMeta} numberOfLines={1}>
                        From {patient?.full_name || 'Patient'} · {relTime(rec.granted_at)}
                      </Text>
                    </View>
                    <View style={s.recordTypeBadge}>
                      <Text style={s.recordTypeText}>{(record?.record_type || 'record').replace(/_/g, ' ')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <SpotlightTour
        visible={showSpotlight}
        steps={[
          {
            title: 'Notifications',
            desc: 'Tap the bell to see incoming record alerts, staff requests, and important hospital updates.',
            targetRef: bellRef,
            tooltipSide: 'below',
            icon: 'notifications',
            accent: C.teal,
          },
          {
            title: 'Your facility stats',
            desc: 'See incoming records, active practitioners, and patients reached — all at a glance.',
            targetRef: statsRef,
            tooltipSide: 'below',
            icon: 'stats-chart',
            accent: C.teal,
          },
          {
            title: 'Quick Actions',
            desc: 'Jump to Records, Staff, Messages, or Alerts in one tap — your most-used tools are right here.',
            targetRef: actionsRef,
            tooltipSide: 'below',
            padding: 12,
            icon: 'grid',
            accent: C.teal,
          },
          {
            title: 'Navigate your dashboard',
            desc: 'Use the tab bar at the bottom to switch between Home, Staff, Records, and your Profile.',
            staticTarget: { x: 0, y: SH - 90, width: SW, height: 90 },
            tooltipSide: 'above',
            icon: 'apps',
            accent: C.teal,
          },
        ] as SpotlightStep[]}
        onComplete={() => {
          setShowSpotlight(false);
          const name = profile?.full_name?.split(' ')[0] || 'there';
          setTimeout(() => toast.showSuccess(`Welcome to Hbridge, ${name}!`), 300);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.ink },

  header:      { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24 },
  brandRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLeft:   { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLogo:   { width: 32, height: 32, borderRadius: 16 },
  brandName:   { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: '#ffffff', letterSpacing: -0.3 },
  brandRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:         { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  notifBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  greetingRow:    { marginTop: 14 },
  greeting:       { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.6)' },
  hospitalName:   { fontSize: 20, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.4, marginTop: 1 },

  credStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  credText:  { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', maxWidth: 150 },
  credDot:   { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },

  headerStatsRow:   { flexDirection: 'row', marginTop: 16 },
  headerStatCard:   { flex: 1, alignItems: 'center', gap: 2 },
  headerStatVal:    { fontSize: 19, fontFamily: 'Montserrat_800ExtraBold', color: '#fff' },
  headerStatLabel:  { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', textAlign: 'center' },

  paper: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  linkBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(212,168,67,0.10)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)', borderRadius: borderRadius.xl, padding: 12, marginBottom: 16, ...shadows.sm },
  linkBannerText: { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#8A6A1F', lineHeight: 18 },

  setupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(212,168,67,0.10)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
    borderRadius: borderRadius.xl, padding: 13, marginBottom: 16,
    ...shadows.sm,
  },
  setupBannerIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(212,168,67,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  setupBannerTitle: { fontSize: 13.5, fontFamily: 'Montserrat_600SemiBold', color: '#8A6A1F' },
  setupBannerSub: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#8A6A1F', opacity: 0.85, marginTop: 1, lineHeight: 15 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:  { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 10 },
  seeAll:        { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  actionsContainer: {
    flexDirection: 'column', backgroundColor: C.card,
    borderRadius: borderRadius.xl, paddingHorizontal: 14, marginBottom: 24,
    ...shadows.sm,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  actionIcon:  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text },

  recordCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: borderRadius.xl, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, ...shadows.sm },
  recordIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  recordTitle: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text, marginBottom: 3 },
  recordMeta:  { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  recordTypeBadge: { backgroundColor: C.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  recordTypeText:  { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: C.muted, textTransform: 'capitalize' },

  empty:       { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  emptySubText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 260 },
});
