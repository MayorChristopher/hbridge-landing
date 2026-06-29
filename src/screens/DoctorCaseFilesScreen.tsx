import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg:'#FFFFFF', surface:'#F5F5F5', text:'#171717', muted:'#737373', border:'#E5E5E5', teal:'#0B7E8A' };

const TYPE_LABELS: any = {
  lab_result:'Lab Result', imaging:'Imaging', prescription:'Prescription',
  vital_signs:'Vitals', diagnosis:'Diagnosis', other:'Other',
};
const TYPE_ICONS: any = {
  lab_result:'flask-outline', imaging:'scan-outline', prescription:'medkit-outline',
  vital_signs:'pulse-outline', diagnosis:'document-text-outline', other:'document-outline',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

export default function DoctorCaseFilesScreen({ navigation }: any) {
  const [records, setRecords]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<'all'|'active'|'expired'>('all');

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doc) { setRecords([]); return; }

      const { data, error } = await supabase
        .from('medical_record_access')
        .select(`
          id, access_type, granted_at, expires_at, is_active,
          medical_records(id, title, record_type, created_at, file_url),
          patient:profiles!medical_record_access_patient_id_fkey(id, full_name, email)
        `)
        .eq('doctor_id', doc.id)
        .order('granted_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRecords(); setRefreshing(false); };

  const isExpired = (item: any) => !item.is_active || (item.expires_at && new Date(item.expires_at) <= new Date());

  const filtered = records.filter(r => {
    if (filter === 'active') return !isExpired(r);
    if (filter === 'expired') return isExpired(r);
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
          <Ionicons name="documents" size={26} color="#fff" />
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Case Files</Text>
          <Text style={s.headerSub}>Shared medical records</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.whiteCard}>
        {/* Filter */}
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
              <Text style={s.emptySub}>When a patient shares a medical record with you it will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const rec = item.medical_records;
            const expired = isExpired(item);
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.iconBox, {backgroundColor: expired ? C.surface : '#E6F5F5'}]}>
                    <Ionicons name={(TYPE_ICONS[rec?.record_type] || 'document-outline') as any}
                      size={20} color={expired ? C.muted : C.teal} />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={s.cardTitle}>{rec?.title ?? 'Record'}</Text>
                    <Text style={s.cardMeta}>
                      {TYPE_LABELS[rec?.record_type] ?? 'Document'} · {rec?.created_at ? formatDate(rec.created_at) : ''}
                    </Text>
                    <Text style={s.cardPatient}>Patient: {item.patient?.full_name ?? 'Unknown'}</Text>
                    <Text style={s.cardPatientSub}>{item.patient?.email ?? ''}</Text>
                  </View>
                  <View style={[s.badge, expired ? s.badgeExp : s.badgeActive]}>
                    <Text style={[s.badgeText, expired ? s.badgeTextExp : s.badgeTextActive]}>
                      {expired ? 'Expired' : 'Active'}
                    </Text>
                  </View>
                </View>
                <Text style={s.grantedAt}>
                  Shared {formatDate(item.granted_at)}
                  {item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ''}
                </Text>
                {!expired && rec?.file_url && (
                  <TouchableOpacity style={s.viewBtn} onPress={() => Linking.openURL(rec.file_url)}>
                    <Ionicons name="eye-outline" size={14} color={C.teal} />
                    <Text style={s.viewBtnText}>View Document</Text>
                  </TouchableOpacity>
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
  container:{ flex:1, backgroundColor:'#0B7E8A' },
  header:{ flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:12, paddingBottom:20, gap:14 },
  backBtn:{ width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  headerIconCircle:{ width:56, height:56, borderRadius:28, backgroundColor:'rgba(255,255,255,0.2)', borderWidth:1, borderColor:'rgba(255,255,255,0.4)', alignItems:'center', justifyContent:'center' },
  headerCenter:{ flex:1 },
  headerTitle:{ fontSize:26, fontWeight:'700', color:'#fff', letterSpacing:-0.3 },
  headerSub:{ fontSize:14, color:'rgba(255,255,255,0.75)', marginTop:2 },
  whiteCard:{ flex:1, backgroundColor:'#ffffff', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden' },
  filterRow:{ flexDirection:'row', gap:8, paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border },
  chip:{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:C.border },
  chipActive:{ backgroundColor:C.teal, borderColor:C.teal },
  chipText:{ fontSize:13, fontWeight:'500', color:C.muted },
  chipTextActive:{ color:'#fff', fontWeight:'600' },
  card:{ backgroundColor:C.bg, borderRadius:14, borderWidth:1, borderColor:C.border, padding:14, marginBottom:12 },
  cardTop:{ flexDirection:'row', alignItems:'flex-start', gap:12 },
  iconBox:{ width:44, height:44, borderRadius:10, alignItems:'center', justifyContent:'center' },
  cardTitle:{ fontSize:15, fontWeight:'700', color:C.text },
  cardMeta:{ fontSize:12, color:C.muted, marginTop:2 },
  cardPatient:{ fontSize:12, color:C.teal, marginTop:3, fontWeight:'600' },
  cardPatientSub:{ fontSize:11, color:C.muted },
  badge:{ paddingHorizontal:8, paddingVertical:3, borderRadius:20, alignSelf:'flex-start' },
  badgeActive:{ backgroundColor:'#E6F5F5' },
  badgeExp:{ backgroundColor:C.surface },
  badgeText:{ fontSize:11, fontWeight:'600' },
  badgeTextActive:{ color:C.teal },
  badgeTextExp:{ color:C.muted },
  grantedAt:{ fontSize:11, color:C.muted, marginTop:8 },
  viewBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, borderWidth:1, borderColor:C.teal+'50', borderRadius:8, paddingVertical:8, marginTop:10, backgroundColor:'#E6F5F5' },
  viewBtnText:{ fontSize:13, fontWeight:'600', color:C.teal },
  empty:{ alignItems:'center', paddingVertical:60, gap:10 },
  emptyTitle:{ fontSize:16, fontWeight:'700', color:C.text },
  emptySub:{ fontSize:13, color:C.muted, textAlign:'center', maxWidth:280 },
});
