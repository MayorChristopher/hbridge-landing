import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg:'#FFFFFF', surface:'#F5F5F5', text:'#171717', muted:'#737373', border:'#E5E5E5', teal:'#0B7E8A' };

const TYPE_LABELS: any = {
  lab_result:'Lab Result', imaging:'Imaging / Scan', prescription:'Prescription',
  vital_signs:'Vitals', diagnosis:'Diagnosis', other:'Other',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

export default function DoctorIncomingRecordsScreen({ navigation }: any) {
  const [records, setRecords]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<'all'|'active'|'expired'>('all');

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the doctor row for this user
      const { data: doctorRow } = await supabase
        .from('doctors').select('id').eq('user_id', user.id).maybeSingle();

      if (!doctorRow) {
        // Not a doctor — show nothing
        setRecords([]); return;
      }

      const { data, error } = await supabase
        .from('medical_record_access')
        .select(`
          id, access_type, granted_at, expires_at, is_active,
          medical_records(id, title, record_type, created_at, file_url),
          patient:profiles!medical_record_access_patient_id_fkey(id, full_name, email)
        `)
        .eq('doctor_id', doctorRow.id)
        .order('granted_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRecords(); setRefreshing(false); };

  const revokeAccess = async (id: string) => {
    Alert.alert('Revoke Access', 'Remove access to this record?', [
      { text:'Cancel', style:'cancel' },
      { text:'Revoke', style:'destructive', onPress: async () => {
        await supabase.from('medical_record_access').update({ is_active: false }).eq('id', id);
        loadRecords();
      }},
    ]);
  };

  const filtered = records.filter(r => {
    if (filter === 'active') return r.is_active && (!r.expires_at || new Date(r.expires_at) > new Date());
    if (filter === 'expired') return !r.is_active || (r.expires_at && new Date(r.expires_at) <= new Date());
    return true;
  });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerIconCircle}>
          <Ionicons name="arrow-down-circle" size={26} color="#fff" />
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Incoming Records</Text>
          <Text style={s.headerSub}>Records shared with you</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.whiteCard}>
      {/* Filter chips */}
      <View style={s.filterRow}>
        {(['all','active','expired'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.chip, filter===f&&s.chipActive]} onPress={()=>setFilter(f)}>
            <Text style={[s.chipText, filter===f&&s.chipTextActive]}>
              {f==='all'?'All':f==='active'?'Active':'Expired'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={C.teal} style={{flex:1}} /> : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding:16, paddingBottom:40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="documents-outline" size={48} color={C.muted} />
              <Text style={s.emptyTitle}>No records shared with you</Text>
              <Text style={s.emptySub}>When a patient shares a record it will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const rec = item.medical_records;
            const patient = item.patient;
            const isExpired = item.expires_at && new Date(item.expires_at) <= new Date();
            const isActive = item.is_active && !isExpired;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.iconBox, { backgroundColor: isActive ? '#E6F5F5' : C.surface }]}>
                    <Ionicons name="document-text" size={22} color={isActive ? C.teal : C.muted} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.cardTitle}>{rec?.title ?? 'Record'}</Text>
                    <Text style={s.cardMeta}>
                      {TYPE_LABELS[rec?.record_type] ?? rec?.record_type ?? 'Document'} · {rec?.created_at ? formatDate(rec.created_at) : ''}
                    </Text>
                    <Text style={s.cardPatient}>From: {patient?.full_name ?? 'Patient'}</Text>
                    <Text style={s.cardPatient}>{patient?.email ?? ''}</Text>
                  </View>
                  <View style={[s.badge, isActive ? s.badgeActive : s.badgeExpired]}>
                    <Text style={[s.badgeText, isActive ? s.badgeTextActive : s.badgeTextExpired]}>
                      {isActive ? 'Active' : 'Expired'}
                    </Text>
                  </View>
                </View>
                <Text style={s.grantedAt}>Shared {formatDate(item.granted_at)}{item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ''}</Text>
                <View style={s.actions}>
                  {rec?.file_url && isActive && (
                    <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(rec.file_url)}>
                      <Ionicons name="eye-outline" size={14} color={C.teal} />
                      <Text style={[s.actionBtnText, { color:C.teal }]}>View File</Text>
                    </TouchableOpacity>
                  )}
                  {isActive && (
                    <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => revokeAccess(item.id)}>
                      <Ionicons name="close-outline" size={14} color="#EF4444" />
                      <Text style={[s.actionBtnText, { color:'#EF4444' }]}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0B7E8A' },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:12, paddingBottom:20, gap:14 },
  backBtn: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  headerIconCircle: { width:56, height:56, borderRadius:28, backgroundColor:'rgba(255,255,255,0.2)', borderWidth:1, borderColor:'rgba(255,255,255,0.4)', alignItems:'center', justifyContent:'center' },
  headerCenter: { flex:1 },
  headerTitle: { fontSize:26, fontWeight:'700', color:'#fff', letterSpacing:-0.3 },
  headerSub: { fontSize:14, color:'rgba(255,255,255,0.75)', marginTop:2 },
  whiteCard: { flex:1, backgroundColor:'#ffffff', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden' },
  filterRow: { flexDirection:'row', gap:8, paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border },
  chip: { paddingHorizontal:14, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:C.border },
  chipActive: { backgroundColor:C.teal, borderColor:C.teal },
  chipText: { fontSize:13, fontWeight:'500', color:C.muted },
  chipTextActive: { color:'#fff', fontWeight:'600' },
  card: { backgroundColor:C.bg, borderRadius:14, borderWidth:1, borderColor:C.border, padding:14, marginBottom:12 },
  cardTop: { flexDirection:'row', alignItems:'flex-start', gap:12 },
  iconBox: { width:44, height:44, borderRadius:10, alignItems:'center', justifyContent:'center' },
  cardTitle: { fontSize:15, fontWeight:'700', color:C.text },
  cardMeta: { fontSize:12, color:C.muted, marginTop:2 },
  cardPatient: { fontSize:12, color:C.teal, marginTop:1 },
  badge: { paddingHorizontal:8, paddingVertical:3, borderRadius:20, alignSelf:'flex-start' },
  badgeActive: { backgroundColor:'#E6F5F5' },
  badgeExpired: { backgroundColor:C.surface },
  badgeText: { fontSize:11, fontWeight:'600' },
  badgeTextActive: { color:C.teal },
  badgeTextExpired: { color:C.muted },
  grantedAt: { fontSize:11, color:C.muted, marginTop:8 },
  actions: { flexDirection:'row', gap:8, marginTop:10 },
  actionBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, borderWidth:1, borderColor:C.border, borderRadius:8, paddingVertical:7 },
  actionBtnDanger: { borderColor:'#fecaca' },
  actionBtnText: { fontSize:12, fontWeight:'500', color:C.text },
  empty: { alignItems:'center', paddingVertical:60, gap:10 },
  emptyTitle: { fontSize:16, fontWeight:'700', color:C.text },
  emptySub: { fontSize:13, color:C.muted, textAlign:'center', maxWidth:260 },
});
