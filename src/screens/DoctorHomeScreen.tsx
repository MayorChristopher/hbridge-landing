import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

const C = { bg:'#FFFFFF', surface:'#F5F7FA', text:'#171717', muted:'#555F6D', border:'#E2E8EF', teal:'#0B7E8A', tealLight:'#E6F5F5' };

const CONSULT_ICONS: Record<string, string> = {
  audio: 'call-outline',
  video: 'videocam-outline',
  in_person: 'walk-outline',
  follow_up: 'refresh-outline',
  online: 'globe-outline',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'}) +
    ' · ' + new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

export default function DoctorHomeScreen({ navigation }: any) {
  const [profile, setProfile]       = useState<any>(null);
  const [doctor, setDoctor]         = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats]           = useState({ today:0, upcoming:0, completed:0, patients:0 });
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingAvail, setTogglingAvail] = useState(false);

  // Spring animation for the toggle
  const toggleScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);

      let { data: doc } = await supabase.from('doctors').select('*').eq('user_id', user.id).maybeSingle();
      if (!doc) {
        const { data: created } = await supabase.from('doctors').insert({
          user_id: user.id,
          full_name: prof?.full_name || '',
          specialization: prof?.specialization || 'General Practice',
          medical_license: prof?.medical_license || 'PENDING',
          verification_status: 'verified',
          is_available: true,
          average_rating: 0,
          total_reviews: 0,
        }).select().single();
        doc = created;
      }
      setDoctor(doc);
      setIsAvailable(doc?.is_available ?? true);
      if (!doc) return;

      const { data: appts } = await supabase
        .from('consultations')
        .select('id, scheduled_at, status, consultation_type, symptoms, profiles!patient_id(id, full_name, profile_image)')
        .eq('doctor_id', doc.id)
        .order('scheduled_at', { ascending: true });

      const all = appts || [];
      const today = new Date().toDateString();
      const todayAppts = all.filter(a => new Date(a.scheduled_at).toDateString() === today && a.status === 'scheduled');
      const upcoming = all.filter(a => a.status === 'scheduled');
      const completed = all.filter(a => a.status === 'completed');
      const uniquePatients = new Set(all.map((a:any) => a.profiles?.id).filter(Boolean));
      setStats({ today: todayAppts.length, upcoming: upcoming.length, completed: completed.length, patients: uniquePatients.size });
      setAppointments(upcoming.slice(0, 5));
    } catch(e) { console.error(e); }
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
    { key: 'patients',  label: 'Patients',  onPress: () => navigation.navigate('Patients') },
  ];

  if (loading) return <LoadingLogo />;

  const firstName = profile?.full_name?.split(' ')[0] || 'Doctor';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
        contentContainerStyle={{ paddingBottom: 110 }}>

        {/* Teal Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Good day,</Text>
            <Text style={s.name}>Dr. {firstName}</Text>
          </View>

          {/* Online/Offline toggle */}
          <Animated.View style={{ transform: [{ scale: toggleScale }], marginRight: 12 }}>
            <TouchableOpacity
              style={[s.availToggle, isAvailable ? s.availOn : s.availOff]}
              onPress={toggleAvailability}
              activeOpacity={0.8}
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
                ? <Image source={{uri:profile.profile_image}} style={s.avatar} />
                : <View style={s.avatarFallback}>
                    <MaterialCommunityIcons name="stethoscope" size={24} color="#fff" />
                  </View>}
            </View>
          </TouchableOpacity>
        </View>

        {/* White card */}
        <View style={s.contentCard}>

        {/* Stats — all tappable */}
        <View style={s.statsRow}>
          {STAT_ACTIONS.map((st) => (
            <TouchableOpacity key={st.key} style={s.statCard} onPress={st.onPress} activeOpacity={0.75}>
              <Text style={s.statVal}>{(stats as any)[st.key]}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionsContainer}>
            {[
              { icon:'calendar-outline',  label:'Appointments', onPress:()=>navigation.navigate('DoctorAppointmentRequests') },
              { icon:'people-outline',    label:'My Patients',  onPress:()=>navigation.navigate('Patients') },
              { icon:'documents-outline', label:'Records',      onPress:()=>navigation.navigate('DoctorCaseFiles') },
              { icon:'chatbubble-ellipses-outline', label:'Messages', onPress:()=>navigation.navigate('DoctorMessages') },
            ].map((a,i) => (
              <TouchableOpacity key={i} style={s.actionCard} onPress={a.onPress}>
                <View style={s.actionIcon}>
                  <Ionicons name={a.icon as any} size={22} color={C.teal} />
                </View>
                <Text style={s.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Appointments */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={()=>navigation.navigate('DoctorAppointmentRequests')}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {appointments.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={40} color={C.muted} />
              <Text style={s.emptyTitle}>No upcoming appointments</Text>
              <Text style={s.emptySub}>Patients will appear here when they book</Text>
            </View>
          ) : (
            appointments.map(a => (
              <TouchableOpacity key={a.id} style={s.apptCard}
                onPress={()=>navigation.navigate('DoctorAppointmentRequests')}>
                <View style={s.apptAvatar}>
                  {a.profiles?.profile_image
                    ? <Image source={{uri:a.profiles.profile_image}} style={{width:44,height:44,borderRadius:22}} />
                    : <Ionicons name="person" size={20} color={C.muted} />}
                </View>
                <View style={{flex:1}}>
                  <Text style={s.apptName}>{a.profiles?.full_name || 'Patient'}</Text>
                  <Text style={s.apptTime}>{formatDate(a.scheduled_at)}</Text>
                  <View style={s.apptTypeRow}>
                    <Ionicons name={(CONSULT_ICONS[a.consultation_type] || 'medical-outline') as any} size={12} color={C.teal} />
                    <Text style={s.apptType}>{a.consultation_type?.replace('_',' ')}</Text>
                  </View>
                </View>
                <View style={s.apptBadge}>
                  <Text style={s.apptBadgeText}>Scheduled</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        </View>{/* end contentCard */}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#0B7E8A' },
  header:{ flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingTop:16, paddingBottom:24, backgroundColor:'transparent' },
  greeting:{ fontSize:13, color:'rgba(255,255,255,0.75)' },
  name:{ fontSize:22, fontWeight:'700', color:'#ffffff' },
  availToggle:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:7, borderRadius:20 },
  availOn:{ backgroundColor:C.teal },
  availOff:{ backgroundColor:C.surface, borderWidth:1, borderColor:C.border },
  availDot:{ width:7, height:7, borderRadius:4 },
  availText:{ fontSize:12, fontWeight:'700' },
  avatarBtn:{},
  avatarRing:{ width:54, height:54, borderRadius:27, borderWidth:2.5, borderColor:C.teal, alignItems:'center', justifyContent:'center', backgroundColor:C.bg },
  avatar:{ width:48, height:48, borderRadius:24 },
  avatarFallback:{ width:48, height:48, borderRadius:24, backgroundColor:C.teal, alignItems:'center', justifyContent:'center' },
  contentCard:{ backgroundColor:'#ffffff', borderTopLeftRadius:28, borderTopRightRadius:28, paddingTop:24, minHeight:600 },
  statsRow:{ flexDirection:'row', marginHorizontal:24, gap:8, marginBottom:24 },
  statCard:{ flex:1, backgroundColor:C.teal, borderRadius:14, padding:12, alignItems:'center', gap:3 },
  statVal:{ fontSize:20, fontWeight:'800', color:'#fff' },
  statLabel:{ fontSize:11, color:'rgba(255,255,255,0.75)', textAlign:'center' },
  section:{ paddingHorizontal:24, marginBottom:24 },
  sectionRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  sectionTitle:{ fontSize:16, fontWeight:'700', color:C.text, marginBottom:14 },
  seeAll:{ fontSize:13, color:C.teal, fontWeight:'600' },
  actionsContainer:{ flexDirection:'row', flexWrap:'wrap', gap:12 },
  actionCard:{ width:'47%', backgroundColor:C.bg, borderRadius:14, padding:16, gap:10, borderWidth:1, borderColor:C.border },
  actionIcon:{ width:44, height:44, borderRadius:22, backgroundColor:C.tealLight, alignItems:'center', justifyContent:'center' },
  actionLabel:{ fontSize:14, fontWeight:'600', color:C.text },
  apptCard:{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:C.surface, borderRadius:14, padding:14, marginBottom:10 },
  apptAvatar:{ width:44, height:44, borderRadius:22, backgroundColor:C.bg, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  apptName:{ fontSize:14, fontWeight:'600', color:C.text },
  apptTime:{ fontSize:12, color:C.muted, marginTop:2 },
  apptTypeRow:{ flexDirection:'row', alignItems:'center', gap:4, marginTop:3 },
  apptType:{ fontSize:11, color:C.teal, textTransform:'capitalize' },
  apptBadge:{ backgroundColor:C.tealLight, borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  apptBadgeText:{ fontSize:11, fontWeight:'600', color:C.teal },
  empty:{ alignItems:'center', paddingVertical:32, gap:8 },
  emptyTitle:{ fontSize:14, fontWeight:'600', color:C.text },
  emptySub:{ fontSize:12, color:C.muted, textAlign:'center', maxWidth:260 },
});
