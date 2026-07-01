import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import LoadingLogo from '../components/LoadingLogo';

const TEAL = '#0B7E8A';
const GOLD  = '#D4A843';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PatientDetailScreen({ navigation, route }: any) {
  const { patient } = route.params;
  const [consultations, setConsultations] = useState<any[]>([]);
  const [sharedRecords, setSharedRecords] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [myUserId, setMyUserId]           = useState<string | null>(null);
  const [doctorId, setDoctorId]           = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (doc) setDoctorId(doc.id);

      const { data: cons } = await supabase
        .from('consultations')
        .select('id, scheduled_at, status, consultation_type, diagnosis, symptoms')
        .eq('patient_id', patient.id)
        .eq('doctor_id', doc?.id)
        .order('scheduled_at', { ascending: false })
        .limit(5);
      setConsultations(cons || []);

      if (doc) {
        const { data: recs } = await supabase
          .from('medical_record_access')
          .select('id, granted_at, is_active, medical_records(id, title, record_type, file_url)')
          .eq('doctor_id', doc.id)
          .eq('patient_id', patient.id)
          .eq('is_active', true)
          .order('granted_at', { ascending: false });
        setSharedRecords(recs || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openChat = async () => {
    if (!doctorId || !myUserId) return;
    try {
      const { data: existing } = await supabase.from('conversations').select('id').eq('patient_id', patient.id).eq('doctor_id', doctorId).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: newConv, error } = await supabase.from('conversations').insert({ patient_id: patient.id, doctor_id: doctorId }).select().single();
        if (error) throw error;
        convId = newConv.id;
      }
      navigation.navigate('Conversation', {
        conversationId: convId,
        other: { id: patient.id, full_name: patient.full_name, avatar_url: patient.profile_image },
        currentUserId: myUserId,
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <LoadingLogo />;

  const statusColor = (st: string) => st === 'completed' ? TEAL : st === 'cancelled' ? '#EF4444' : GOLD;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{patient.full_name}</Text>
          <Text style={s.headerSub}>Patient Details</Text>
        </View>
        <TouchableOpacity style={s.chatBtn} onPress={openChat}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.card}>

          {/* Avatar + Info */}
          <View style={s.heroSection}>
            <View style={s.avatarBox}>
              {patient.profile_image
                ? <Image source={{ uri: patient.profile_image }} style={s.avatarImg} />
                : <View style={s.avatarFallback}><Ionicons name="person" size={36} color="#fff" /></View>}
            </View>
            <Text style={s.heroName}>{patient.full_name}</Text>
            <Text style={s.heroEmail}>{patient.email}</Text>
            {patient.phone && <Text style={s.heroPhone}>{patient.phone}</Text>}

            {/* Gold Patient badge */}
            <View style={s.badge}>
              <Ionicons name="person" size={11} color="#fff" />
              <Text style={s.badgeText}>Patient</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionBtn} onPress={openChat}>
              <View style={[s.actionIcon, { backgroundColor: '#E6F5F5' }]}>
                <Ionicons name="chatbubble-outline" size={20} color={TEAL} />
              </View>
              <Text style={s.actionLabel}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => {
              if (patient.phone) Linking.openURL(`tel:${patient.phone}`);
              else Alert.alert('No phone', 'Patient has no phone number on file.');
            }}>
              <View style={[s.actionIcon, { backgroundColor: '#E6F5F5' }]}>
                <Ionicons name="call-outline" size={20} color={TEAL} />
              </View>
              <Text style={s.actionLabel}>Call</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Shared Records */}
          <Text style={s.sectionTitle}>Shared Records ({sharedRecords.length})</Text>
          {sharedRecords.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="documents-outline" size={24} color="#a3a3a3" />
              <Text style={s.emptyText}>No records shared with you yet</Text>
            </View>
          ) : sharedRecords.map(r => (
            <View key={r.id} style={s.recCard}>
              <View style={s.recIcon}><Ionicons name="document-text" size={18} color={TEAL} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.recTitle}>{r.medical_records?.title ?? 'Record'}</Text>
                <Text style={s.recMeta}>Shared {formatDate(r.granted_at)}</Text>
              </View>
              {r.medical_records?.file_url && (
                <TouchableOpacity onPress={() => Linking.openURL(r.medical_records.file_url)}>
                  <Ionicons name="eye-outline" size={18} color={TEAL} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={s.divider} />

          {/* Consultation History */}
          <Text style={s.sectionTitle}>Consultation History ({consultations.length})</Text>
          {consultations.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={24} color="#a3a3a3" />
              <Text style={s.emptyText}>No consultations yet</Text>
            </View>
          ) : consultations.map(c => (
            <View key={c.id} style={s.conCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.conDate}>{formatDate(c.scheduled_at)} · {c.consultation_type?.replace('_', ' ')}</Text>
                {c.symptoms && <Text style={s.conSub} numberOfLines={2}>Symptoms: {c.symptoms}</Text>}
                {c.diagnosis && <Text style={[s.conSub, { color: TEAL }]} numberOfLines={2}>Diagnosis: {c.diagnosis}</Text>}
              </View>
              <View style={[s.statusBadge, { backgroundColor: statusColor(c.status) + '20', borderColor: statusColor(c.status) + '40' }]}>
                <Text style={[s.statusText, { color: statusColor(c.status) }]}>{c.status}</Text>
              </View>
            </View>
          ))}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: TEAL },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, padding: 24, minHeight: '100%' },
  heroSection: { alignItems: 'center', gap: 6, marginBottom: 24 },
  avatarBox: { marginBottom: 4 },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: TEAL },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: TEAL },
  heroName: { fontSize: 20, fontWeight: '700', color: '#171717' },
  heroEmail: { fontSize: 13, color: '#737373' },
  heroPhone: { fontSize: 13, color: '#737373' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 20 },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#404040' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#171717', marginBottom: 10 },
  emptyCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  emptyText: { fontSize: 13, color: '#a3a3a3' },
  recCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9f9f9', borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', padding: 12, marginBottom: 8 },
  recIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E6F5F5', alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontSize: 14, fontWeight: '600', color: '#171717' },
  recMeta: { fontSize: 11, color: '#737373', marginTop: 2 },
  conCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f9f9f9', borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', padding: 12, marginBottom: 8, gap: 10 },
  conDate: { fontSize: 13, fontWeight: '600', color: '#171717', textTransform: 'capitalize' },
  conSub: { fontSize: 12, color: '#737373', marginTop: 3, lineHeight: 17 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
