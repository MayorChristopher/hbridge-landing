import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, StatusBar,
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

export default function TransferredRecordsScreen({ navigation }: any) {
  const [records, setRecords]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState<'sent'|'received'>('sent');

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch records I shared (sent) — I am the patient
      const { data: sent } = await supabase
        .from('medical_record_access')
        .select(`
          id, access_type, granted_at, expires_at, is_active,
          medical_records(id, title, record_type, created_at, file_url),
          doctor:doctors!medical_record_access_doctor_id_fkey(id, full_name, specialization),
          hospital:hospitals!medical_record_access_hospital_id_fkey(id, name, city, state)
        `)
        .eq('patient_id', user.id)
        .order('granted_at', { ascending: false });

      // Fetch records shared with me as a doctor (received)
      const { data: doctorRow } = await supabase
        .from('doctors').select('id').eq('user_id', user.id).maybeSingle();

      let received: any[] = [];
      if (doctorRow) {
        const { data } = await supabase
          .from('medical_record_access')
          .select(`
            id, access_type, granted_at, expires_at, is_active,
            medical_records(id, title, record_type, created_at, file_url),
            patient:profiles!medical_record_access_patient_id_fkey(id, full_name, email)
          `)
          .eq('doctor_id', doctorRow.id)
          .order('granted_at', { ascending: false });
        received = data || [];
      }

      setRecords(tab === 'sent' ? (sent || []) : received);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Re-load when tab changes
  useEffect(() => { loadRecords(); }, [tab]);

  const onRefresh = async () => { setRefreshing(true); await loadRecords(); setRefreshing(false); };

  const revokeAccess = (id: string) => {
    Alert.alert('Revoke Access', 'Remove access to this record?', [
      { text:'Cancel', style:'cancel' },
      { text:'Revoke', style:'destructive', onPress: async () => {
        await supabase.from('medical_record_access').update({ is_active: false }).eq('id', id);
        loadRecords();
      }},
    ]);
  };

  const getRecipientLabel = (item: any) => {
    if (tab === 'sent') {
      if (item.doctor) return `Dr. ${item.doctor.full_name ?? ''} · ${item.doctor.specialization ?? ''}`;
      if (item.hospital) return `${item.hospital.name ?? ''} · ${item.hospital.city ?? ''}`;
      return 'Unknown recipient';
    }
    return item.patient?.full_name ?? 'Patient';
  };

  const isExpired = (item: any) => !item.is_active || (item.expires_at && new Date(item.expires_at) <= new Date());

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerIconCircle}>
          <Ionicons name="swap-horizontal" size={26} color="#fff" />
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Transferred Records</Text>
          <Text style={s.headerSub}>Sent & received records</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.whiteCard}>
      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab==='sent'&&s.tabActive]} onPress={()=>setTab('sent')}>
          <Text style={[s.tabText, tab==='sent'&&s.tabTextActive]}>Sent by Me</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab==='received'&&s.tabActive]} onPress={()=>setTab('received')}>
          <Text style={[s.tabText, tab==='received'&&s.tabTextActive]}>Received</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={C.teal} style={{flex:1}} /> : (
        <FlatList
          data={records}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding:16, paddingBottom:40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="share-outline" size={48} color={C.muted} />
              <Text style={s.emptyTitle}>{tab==='sent' ? 'No records shared yet' : 'No received records'}</Text>
              <Text style={s.emptySub}>
                {tab==='sent'
                  ? 'Records you share with doctors or hospitals appear here'
                  : 'Records shared with you by patients appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const rec = item.medical_records;
            const expired = isExpired(item);
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.iconBox, { backgroundColor: expired ? C.surface : '#E6F5F5' }]}>
                    <Ionicons name="document-text" size={22} color={expired ? C.muted : C.teal} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.cardTitle}>{rec?.title ?? 'Record'}</Text>
                    <Text style={s.cardMeta}>
                      {TYPE_LABELS[rec?.record_type] ?? rec?.record_type ?? ''} · {rec?.created_at ? formatDate(rec.created_at) : ''}
                    </Text>
                    <Text style={s.cardRecipient}>
                      {tab==='sent' ? 'Shared with: ' : 'From: '}
                      <Text style={{ color: C.TEAL  }}>{getRecipientLabel(item)}</Text>
                    </Text>
                  </View>
                  <View style={[s.statusBadge, expired ? s.statusExpired : s.statusActive]}>
                    <Text style={[s.statusText, expired ? s.statusTextExpired : s.statusTextActive]}>
                      {expired ? 'Expired' : 'Active'}
                    </Text>
                  </View>
                </View>
                <Text style={s.dateRow}>
                  Shared {formatDate(item.granted_at)}
                  {item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ''}
                </Text>
                {tab === 'sent' && !expired && (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.revokeBtn} onPress={() => revokeAccess(item.id)}>
                      <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                      <Text style={s.revokeBtnText}>Revoke Access</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  tabRow: { flexDirection:'row', marginHorizontal:16, marginVertical:12, backgroundColor:'#F5F5F5', borderRadius:10, padding:4 },
  tab: { flex:1, paddingVertical:9, borderRadius:8, alignItems:'center' },
  tabActive: { backgroundColor:C.TEAL  },
  tabText: { fontSize:14, fontWeight:'600', color:C.muted },
  tabTextActive: { color:'#fff' },
  card: { backgroundColor:C.bg, borderRadius:14, borderWidth:1, borderColor:'#E5E5E5', padding:14, marginBottom:12 },
  cardTop: { flexDirection:'row', alignItems:'flex-start', gap:12 },
  iconBox: { width:44, height:44, borderRadius:10, alignItems:'center', justifyContent:'center' },
  cardTitle: { fontSize:15, fontWeight:'700', color:C.text },
  cardMeta: { fontSize:12, color:C.muted, marginTop:2 },
  cardRecipient: { fontSize:12, color:C.muted, marginTop:3 },
  statusBadge: { paddingHorizontal:8, paddingVertical:3, borderRadius:20, alignSelf:'flex-start' },
  statusActive: { backgroundColor:'#E6F5F5' },
  statusExpired: { backgroundColor:C.surface },
  statusText: { fontSize:11, fontWeight:'600' },
  statusTextActive: { color:C.TEAL  },
  statusTextExpired: { color:C.muted },
  dateRow: { fontSize:11, color:C.muted, marginTop:8 },
  actions: { marginTop:10 },
  revokeBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, borderWidth:1, borderColor:'#fecaca', borderRadius:8, paddingVertical:8 },
  revokeBtnText: { fontSize:12, fontWeight:'600', color:'#EF4444' },
  empty: { alignItems:'center', paddingVertical:60, gap:10 },
  emptyTitle: { fontSize:16, fontWeight:'700', color:C.text },
  emptySub: { fontSize:13, color:C.muted, textAlign:'center', maxWidth:280 },
});
