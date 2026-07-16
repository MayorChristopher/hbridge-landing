import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  ink: '#083236',
};

const FILTERS = [
  { key: 'all',           label: 'All' },
  { key: 'consultation',  label: 'Consultations' },
  { key: 'message',       label: 'Messages' },
] as const;
type FilterKey = typeof FILTERS[number]['key'];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  if (d < 30)  return `${Math.floor(d / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ name, image, size = 48 }: { name?: string; image?: string; size?: number }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (image) return <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.35, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>{initials}</Text>
    </View>
  );
}

function statusLabel(source: string, status: string): string {
  if (source === 'message') return 'Messaged';
  const map: Record<string, string> = {
    completed: 'Consultation completed',
    pending: 'Consultation pending',
    confirmed: 'Consultation confirmed',
    cancelled: 'Consultation cancelled',
  };
  return map[status] ?? status?.replace(/_/g, ' ');
}

function statusColor(source: string, status: string): string {
  if (source === 'message') return '#6366f1';
  if (status === 'completed') return C.teal;
  if (status === 'cancelled') return '#EF4444';
  if (status === 'confirmed') return '#1E9E5A';
  return '#F59E0B';
}

export default function DoctorPatientsScreen({ navigation }: any) {
  const toast = useToast();
  const [patients, setPatients]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<FilterKey>('all');
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

      const [{ data: consultData }, { data: convData }] = await Promise.all([
        supabase.from('consultations')
          .select('patient_id, status, scheduled_at, profiles!patient_id(id, full_name, profile_image, email, hbridge_id)')
          .eq('doctor_id', doc.id)
          .order('scheduled_at', { ascending: false }),
        supabase.from('conversations')
          .select('patient_id, updated_at, profiles!patient_id(id, full_name, profile_image, email, hbridge_id)')
          .eq('doctor_id', doc.id)
          .order('updated_at', { ascending: false }),
      ]);

      const map = new Map<string, any>();
      (consultData || []).forEach((c: any) => {
        if (!c.profiles) return;
        const existing = map.get(c.patient_id);
        if (!existing) {
          map.set(c.patient_id, { ...c.profiles, lastStatus: c.status, lastDate: c.scheduled_at, source: 'consultation' });
        }
      });
      (convData || []).forEach((c: any) => {
        if (!c.profiles) return;
        if (!map.has(c.patient_id)) {
          map.set(c.patient_id, { ...c.profiles, lastStatus: 'messaged', lastDate: c.updated_at, source: 'message' });
        }
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
    } catch (e: any) { toast.showError('Error', e.message); }
  };

  const filtered = patients.filter(p => {
    if (filter !== 'all' && p.source !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.hbridge_id?.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />

      <View style={s.header}>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>My Patients</Text>
          <Text style={s.headerSub}>{patients.length} patient{patients.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={s.paperCard}>
        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput
            style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search by name, email or HB-ID..." placeholderTextColor={C.muted}
            autoCorrect={false}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <View style={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, filter === f.key && s.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>
                {f.label}
                {f.key !== 'all' && ` (${patients.filter(p => p.source === f.key).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1, marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="people-outline" size={36} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>{search || filter !== 'all' ? 'No results' : 'No patients yet'}</Text>
                <Text style={s.emptySub}>
                  {search || filter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Patients appear here once they book a consultation or message you.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const color = statusColor(item.source, item.lastStatus);
              const label = statusLabel(item.source, item.lastStatus);
              return (
                <TouchableOpacity
                  style={s.patCard}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('PatientDetail', { patient: item })}
                >
                  <Avatar name={item.full_name} image={item.profile_image} size={50} />

                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{item.full_name}</Text>
                    {item.hbridge_id ? (
                      <Text style={s.hbId}>{item.hbridge_id}</Text>
                    ) : (
                      <Text style={s.hbId}>{item.email}</Text>
                    )}
                    <View style={s.statusRow}>
                      <View style={[s.statusDot, { backgroundColor: color }]} />
                      <Text style={[s.statusText, { color }]} numberOfLines={1}>{label}</Text>
                      <Text style={s.dateText}>· {relativeTime(item.lastDate)}</Text>
                    </View>
                  </View>

                  <View style={s.actions}>
                    <TouchableOpacity style={s.chatBtn} onPress={() => openChat(item)}>
                      <Ionicons name="chatbubble-outline" size={17} color={C.teal} />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={17} color={C.muted} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.ink },

  header:      { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28 },
  headerTitles:{ },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  filterRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  chipActive:   { backgroundColor: C.tealLight, borderColor: C.teal },
  chipText:     { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  chipTextActive:{ fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  patCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10, gap: 14 },
  name:      { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.text },
  hbId:      { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText:{ fontSize: 11, fontFamily: 'Montserrat_600SemiBold', flexShrink: 1 },
  dateText:  { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },

  empty:        { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub:     { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
