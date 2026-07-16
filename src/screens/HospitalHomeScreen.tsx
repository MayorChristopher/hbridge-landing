import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, StatusBar, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import SpotlightTour, { SpotlightStep } from '../components/SpotlightTour';

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
        let { data: hosp } = await supabase
          .from('hospitals')
          .select('id, name, type, city, state, rating')
          .ilike('name', `%${hospitalName}%`)
          .maybeSingle();
        if (!hosp) {
          const { data: created } = await supabase.from('hospitals')
            .insert({ name: hospitalName.trim(), is_active: true, rating: 0, total_reviews: 0 })
            .select('id, name, type, city, state, rating').maybeSingle();
          hosp = created;
        }
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
          supabase.from('medical_record_access')
            .select('doctor_id')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .not('doctor_id', 'is', null),
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
            {profile?.profile_image
              ? <Image source={{ uri: profile.profile_image }} style={s.avatar} />
              : <View style={s.avatarFallback}><Ionicons name="business" size={20} color="#fff" /></View>}
          </View>
        </View>

        {/* Greeting row */}
        <View style={s.greetingRow}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.hospitalName} numberOfLines={1}>{hospitalName}</Text>
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
            {/* Hospital badge */}
            {hospital && (
              <View style={s.hospitalBadge}>
                <Ionicons name="business" size={15} color={C.teal} />
                <Text style={s.hospitalBadgeText}>{hospital.type ? `${hospital.type} Hospital` : 'Hospital'} · {hospital.city || hospital.state || 'Nigeria'}</Text>
                {hospital.rating > 0 && (
                  <View style={s.ratingPill}>
                    <Ionicons name="star" size={11} color={C.gold} />
                    <Text style={s.ratingText}>{hospital.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            )}

            {!profile?.hospital_name && (
              <TouchableOpacity style={s.linkBanner} activeOpacity={0.8} onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="warning-outline" size={18} color={C.gold} />
                <Text style={s.linkBannerText}>
                  Hospital name not set. Tap here → go to Profile → Edit to enter your hospital name.
                </Text>
              </TouchableOpacity>
            )}

            {/* Web dashboard nudge */}
            <TouchableOpacity
              style={s.dashboardBanner}
              activeOpacity={0.8}
              onPress={() => Linking.openURL('https://hbridge.ng/hospital')}
            >
              <View style={s.dashboardBannerLeft}>
                <Ionicons name="desktop-outline" size={18} color={C.teal} />
                <View>
                  <Text style={s.dashboardBannerTitle}>Full Dashboard Available</Text>
                  <Text style={s.dashboardBannerSub}>Visit hbridge.ng/hospital for analytics & reporting</Text>
                </View>
              </View>
              <Ionicons name="open-outline" size={15} color={C.teal} />
            </TouchableOpacity>

            {/* Stats */}
            <View style={s.statsRow}>
              {[
                { label: 'Records',  value: stats.records,  icon: 'folder-open', mat: false },
                { label: 'Practitioners', value: stats.doctors, icon: 'stethoscope', mat: true },
                { label: 'Patients', value: stats.patients, icon: 'people',      mat: false },
              ].map(stat => (
                <View key={stat.label} style={s.statCard}>
                  <View style={[s.statIcon, { backgroundColor: 'rgba(11,126,138,0.1)' }]}>
                    {stat.mat
                      ? <MaterialCommunityIcons name={stat.icon as any} size={20} color={C.teal} />
                      : <Ionicons name={stat.icon as any} size={20} color={C.teal} />}
                  </View>
                  <Text style={s.statValue}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Quick actions */}
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View ref={actionsRef} collapsable={false} style={s.actionsGrid}>
              {QUICK_ACTIONS.map(a => (
                <TouchableOpacity key={a.label} style={s.actionCard} onPress={a.onPress} activeOpacity={0.75}>
                  <View style={[s.actionIcon, { backgroundColor: 'rgba(11,126,138,0.1)' }]}>
                    <Ionicons name={a.icon as any} size={22} color={C.teal} />
                  </View>
                  <Text style={s.actionLabel}>{a.label}</Text>
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

  paper: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  hospitalBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.tealLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(11,126,138,0.2)' },
  hospitalBadgeText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, flex: 1 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(212,168,67,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.gold },

  linkBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(212,168,67,0.10)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)', borderRadius: 12, padding: 12, marginBottom: 16 },
  linkBannerText: { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#8A6A1F', lineHeight: 18 },

  dashboardBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(11,126,138,0.07)', borderWidth: 1, borderColor: 'rgba(11,126,138,0.18)', borderRadius: 12, padding: 12, marginBottom: 16 },
  dashboardBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dashboardBannerTitle: { fontSize: 12.5, fontFamily: 'Montserrat_600SemiBold', color: C.teal, marginBottom: 1 },
  dashboardBannerSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.border },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 22, fontFamily: 'Montserrat_800ExtraBold', color: C.text },
  statLabel: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:  { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 10 },
  seeAll:        { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionCard:  { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border },
  actionIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.text, textAlign: 'center' },

  recordCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  recordIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  recordTitle: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text, marginBottom: 3 },
  recordMeta:  { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  recordTypeBadge: { backgroundColor: C.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  recordTypeText:  { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: C.muted, textTransform: 'capitalize' },

  empty:       { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  emptySubText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 260 },
});
