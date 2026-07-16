import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, TextInput, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF',
  text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA',
  teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)', ink: '#083236',
};

const TYPE_ICONS: Record<string, string> = {
  lab_result: 'flask-outline', imaging: 'scan-outline', prescription: 'medkit-outline',
  vital_signs: 'pulse-outline', diagnosis: 'document-text-outline', other: 'document-outline',
};

const TYPE_COLORS: Record<string, string> = {
  lab_result: '#7C3AED', imaging: '#0B7E8A', prescription: '#1E9E5A',
  vital_signs: '#F59E0B', diagnosis: '#EF4444', other: '#6B7E7F',
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'lab_result', label: 'Lab Results' },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'diagnosis', label: 'Diagnosis' },
];

export default function HospitalIncomingRecordsScreen({ navigation }: any) {
  const [records, setRecords]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');

  useFocusEffect(useCallback(() => { loadRecords(); }, []));

  const loadRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, hospital_name')
        .eq('id', user.id)
        .maybeSingle();

      const hospitalName = prof?.hospital_name || prof?.full_name;
      if (!hospitalName) { setLoading(false); setRefreshing(false); return; }

      let { data: hosp } = await supabase
        .from('hospitals')
        .select('id')
        .ilike('name', `%${hospitalName}%`)
        .maybeSingle();

      if (!hosp?.id) {
        const { data: created } = await supabase.from('hospitals')
          .insert({ name: hospitalName.trim(), is_active: true, rating: 0, total_reviews: 0 })
          .select('id').maybeSingle();
        hosp = created;
      }
      if (!hosp?.id) { setLoading(false); setRefreshing(false); return; }

      const { data } = await supabase
        .from('medical_record_access')
        .select(`
          id, granted_at, access_type, is_active,
          medical_records(id, title, record_type, file_url, created_at),
          profiles!patient_id(id, full_name, profile_image)
        `)
        .eq('hospital_id', hosp.id)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      setRecords(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = records.filter(r => {
    const record  = r.medical_records;
    const patient = r.profiles;
    if (filter !== 'all' && record?.record_type !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      record?.title?.toLowerCase().includes(q) ||
      patient?.full_name?.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />

      <View style={s.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Incoming Records</Text>
          <Text style={s.headerSub}>{records.length} record{records.length !== 1 ? 's' : ''} received</Text>
        </View>
      </View>

      <View style={s.paper}>
        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput
            style={s.searchInput}
            value={search} onChangeText={setSearch}
            placeholder="Search by record or patient name…"
            placeholderTextColor={C.muted}
            autoCorrect={false}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Type filters */}
        <View style={s.chipRow}>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={f => f.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6, alignItems: 'center' }}
            renderItem={({ item: f }) => (
              <TouchableOpacity
                style={[s.chip, filter === f.key && s.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1, marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRecords(); }} tintColor={C.teal} colors={[C.teal]} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="folder-open-outline" size={36} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>{search || filter !== 'all' ? 'No results' : 'No records yet'}</Text>
                <Text style={s.emptySub}>
                  {search || filter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Records shared with your hospital will appear here.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const record  = item.medical_records;
              const patient = item.profiles;
              const rType   = record?.record_type || 'other';
              const color   = TYPE_COLORS[rType] || C.muted;
              const icon    = TYPE_ICONS[rType]  || 'document-outline';

              return (
                <TouchableOpacity
                  style={s.card}
                  activeOpacity={0.75}
                  onPress={() => record?.id && navigation.navigate('RecordDetail', { recordId: record.id })}
                >
                  <View style={[s.typeIcon, { backgroundColor: color + '18' }]}>
                    <Ionicons name={icon as any} size={22} color={color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.recTitle} numberOfLines={1}>{record?.title || 'Medical Record'}</Text>
                    <View style={s.patientRow}>
                      {patient?.profile_image
                        ? <Image source={{ uri: patient.profile_image }} style={s.patAvatar} />
                        : <View style={[s.patAvatar, { backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 9, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>
                              {(patient?.full_name || '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                            </Text>
                          </View>}
                      <Text style={s.patName} numberOfLines={1}>{patient?.full_name || 'Patient'}</Text>
                      <Text style={s.dot}>·</Text>
                      <Text style={s.recTime}>{relTime(item.granted_at)}</Text>
                    </View>
                  </View>

                  <View style={[s.typeBadge, { backgroundColor: color + '18' }]}>
                    <Text style={[s.typeBadgeText, { color }]}>{rType.replace(/_/g, ' ')}</Text>
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
  root:  { flex: 1, backgroundColor: C.ink },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28, gap: 12 },
  backBtn:    { padding: 4 },
  headerTitle:{ fontSize: 24, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  headerSub:  { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  paper: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 4, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: C.border },
  chipRow:     { height: 34 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  chip:          { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  chipActive:    { backgroundColor: C.tealLight, borderColor: C.teal },
  chipText:      { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  chipTextActive:{ fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  card:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10, gap: 12 },
  typeIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text, marginBottom: 5 },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  patAvatar:  { width: 18, height: 18, borderRadius: 9 },
  patName:    { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, flexShrink: 1 },
  dot:        { fontSize: 11, color: C.muted },
  recTime:    { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  typeBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  typeBadgeText:  { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', textTransform: 'capitalize' },

  empty:        { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub:     { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
