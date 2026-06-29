import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717', muted: '#737373', border: '#E5E5E5', teal: '#0B7E8A', tealLight: '#E6F5F5' };

export default function DoctorAppointmentRequestsScreen({ navigation }: any) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [currentUser, setCurrentUser]   = useState<any>(null);

  useEffect(() => { loadAppointments(); }, []);

  const loadAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);
      const { data: doctorData } = await supabase.from('doctors').select('id').eq('user_id', user.id).single();
      if (!doctorData) return;
      const { data } = await supabase.from('consultations')
        .select('*, profiles!patient_id(full_name,profile_image)')
        .eq('doctor_id', doctorData.id).order('scheduled_at', { ascending: true });
      setAppointments(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAppointments(); setRefreshing(false); };

  const updateStatus = async (id: string, status: string) => {
    try {
      if (status === 'completed') {
        Alert.alert('Complete Consultation', 'Mark this consultation as completed?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete', onPress: async () => {
              await supabase.from('consultations').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
              Alert.alert('Consultation Completed', 'Marked as completed.', [{ text: 'OK' }]);
              loadAppointments();
            },
          },
        ]);
      } else {
        await supabase.from('consultations').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        loadAppointments();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update appointment status');
    }
  };

  const openChat = async (item: any) => {
    try {
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('patient_id', item.patient_id).eq('doctor_id', item.doctor_id).maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created } = await supabase.from('conversations')
          .insert({ patient_id: item.patient_id, doctor_id: item.doctor_id }).select('id').single();
        conversationId = created?.id;
      }
      if (conversationId) {
        navigation.navigate('Conversation', {
          conversationId,
          other: { id: item.patient_id, full_name: item.profiles?.full_name || 'Patient', avatar_url: item.profiles?.profile_image, isDoctor: false },
          currentUserId: currentUser?.id,
        });
      }
    } catch { Alert.alert('Error', 'Could not open chat'); }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusBg = (status: string) =>
    status === 'scheduled' ? C.tealLight : status === 'in_progress' ? '#FEF3C7' : C.surface;
  const statusColor = (status: string) =>
    status === 'scheduled' ? C.teal : status === 'in_progress' ? '#F59E0B' : C.muted;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerIconWrap}>
          <Ionicons name="calendar" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Appointments</Text>
          <Text style={s.headerSubtitle}>Manage your schedule</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.card}>
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={i => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="calendar-outline" size={36} color={C.teal} />
                </View>
                <Text style={s.emptyText}>No appointments yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={s.apptCard}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.patientName}>{item.profiles?.full_name || 'Patient'}</Text>
                    <Text style={s.dateText}>{formatDate(item.scheduled_at)}</Text>
                    <Text style={s.typeText}>{item.consultation_type?.replace('_', ' ')}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusBg(item.status) }]}>
                    <Text style={[s.statusText, { color: statusColor(item.status) }]}>
                      {item.status === 'in_progress' ? 'In Progress' : item.status}
                    </Text>
                  </View>
                </View>
                {item.symptoms && <Text style={s.symptoms} numberOfLines={2}>Symptoms: {item.symptoms}</Text>}
                {item.status === 'scheduled' && (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus(item.id, 'in_progress')}>
                      <Text style={s.primaryBtnText}>Start Session</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.outlineBtn} onPress={() => updateStatus(item.id, 'cancelled')}>
                      <Text style={s.outlineBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.status === 'in_progress' && (
                  <View style={s.actions}>
                    <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#10B981' }]} onPress={() => updateStatus(item.id, 'completed')}>
                      <Text style={s.primaryBtnText}>Complete Session</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.outlineBtn} onPress={() => openChat(item)}>
                      <Text style={s.outlineBtnText}>Message Patient</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
  backButton:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerTitles:   { flex: 1 },
  headerTitle:    { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // White card
  card: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  // Appointment card
  apptCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16, gap: 10 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  patientName: { fontSize: 15, fontWeight: '600', color: C.text },
  dateText:    { fontSize: 13, color: C.muted, marginTop: 2 },
  typeText:    { fontSize: 12, color: C.teal, textTransform: 'capitalize', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  symptoms:    { fontSize: 13, color: C.muted, lineHeight: 18 },
  actions:     { flexDirection: 'row', gap: 10 },
  primaryBtn:  { flex: 1, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  outlineBtn:  { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  outlineBtnText: { fontSize: 13, fontWeight: '500', color: C.text },

  // Empty
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText:    { fontSize: 16, color: C.muted },
});
