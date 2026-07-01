import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, TextInput, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717', muted: '#737373', border: '#E5E5E5', teal: '#0B7E8A', tealLight: '#E6F5F5' };

export default function DoctorPatientsScreen({ navigation }: any) {
  const [patients, setPatients]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [doctorId, setDoctorId]     = useState<string | null>(null);
  const [myUserId, setMyUserId]     = useState<string | null>(null);

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);
      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doc) { setLoading(false); return; }
      setDoctorId(doc.id);

      const { data: consultData } = await supabase
        .from('consultations')
        .select('patient_id, status, scheduled_at, profiles!patient_id(id, full_name, profile_image, email, phone)')
        .eq('doctor_id', doc.id).order('scheduled_at', { ascending: false });

      const { data: convData } = await supabase
        .from('conversations')
        .select('patient_id, updated_at, profiles!patient_id(id, full_name, profile_image, email)')
        .eq('doctor_id', doc.id).order('updated_at', { ascending: false });

      const map = new Map<string, any>();
      (consultData || []).forEach((c: any) => {
        if (c.profiles && !map.has(c.patient_id))
          map.set(c.patient_id, { ...c.profiles, lastStatus: c.status, lastDate: c.scheduled_at, source: 'consultation' });
      });
      (convData || []).forEach((c: any) => {
        if (c.profiles && !map.has(c.patient_id))
          map.set(c.patient_id, { ...c.profiles, lastStatus: 'messaged', lastDate: c.updated_at, source: 'message' });
      });
      setPatients(Array.from(map.values()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadPatients(); setRefreshing(false); };

  const openChat = async (patient: any) => {
    if (!doctorId || !myUserId) return;
    try {
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('patient_id', patient.id).eq('doctor_id', doctorId).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: newConv, error } = await supabase.from('conversations')
          .insert({ patient_id: patient.id, doctor_id: doctorId }).select().single();
        if (error) throw error;
        convId = newConv.id;
      }
      navigation.navigate('Conversation', {
        conversationId: convId,
        other: { id: patient.id, full_name: patient.full_name, avatar_url: patient.profile_image, isDoctor: false },
        currentUserId: myUserId,
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const filtered = search.trim()
    ? patients.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase()))
    : patients;

  const statusColor = (st: string) =>
    st === 'completed' ? C.teal : st === 'cancelled' ? '#EF4444' : st === 'messaged' ? '#6366f1' : '#F59E0B';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <View style={s.headerIconWrap}>
          <Ionicons name="people" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>My Patients</Text>
          <Text style={s.headerSubtitle}>{patients.length} total</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.card}>
        <View style={s.searchWrap}>
          <View style={s.searchBar}>
            <Ionicons name="search" size={15} color={C.muted} />
            <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
              placeholder="Search by name or email..." placeholderTextColor={C.muted} />
          </View>
        </View>

        {loading ? <ActivityIndicator color={C.teal} style={{ flex: 1 }} /> : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <MaterialCommunityIcons name="stethoscope" size={36} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>No patients yet</Text>
                <Text style={s.emptySub}>
                  Patients appear here once they book a consultation or message you.{'\n'}
                  They find you via the Find Doctors section.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={s.patCard} onPress={() => navigation.navigate('PatientDetail', { patient: item })}>
                <View style={s.avatarBox}>
                  {item.profile_image
                    ? <Image source={{ uri: item.profile_image }} style={s.avatarImg} />
                    : <View style={s.avatarFallback}><Ionicons name="person" size={22} color="#fff" /></View>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.full_name}</Text>
                  <Text style={s.email}>{item.email}</Text>
                  <View style={s.statusRow}>
                    <View style={[s.dot, { backgroundColor: statusColor(item.lastStatus) }]} />
                    <Text style={s.statusText}>{item.lastStatus?.replace('_', ' ')}</Text>
                    <Text style={s.dateText}>· {new Date(item.lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                </View>
                <TouchableOpacity style={s.chatBtn} onPress={() => openChat(item)}>
                  <Ionicons name="chatbubble-outline" size={18} color={C.teal} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  headerIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerTitles:   { flex: 1 },
  headerTitle:    { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // White card
  card:       { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  searchWrap: { padding: 16, paddingBottom: 8 },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  searchInput:{ flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },

  // Patient card
  patCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10, gap: 12 },
  avatarBox:    {},
  avatarImg:    { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  name:         { fontSize: 15, fontWeight: '600', color: C.text },
  email:        { fontSize: 12, color: C.muted, marginTop: 2 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  dot:          { width: 7, height: 7, borderRadius: 4 },
  statusText:   { fontSize: 11, color: C.muted, textTransform: 'capitalize' },
  dateText:     { fontSize: 11, color: C.muted },
  chatBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },

  // Empty
  empty:        { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub:     { fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
