import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, StatusBar, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = { bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30', muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)' };

export default function DoctorAppointmentRequestsScreen({ navigation }: any) {
  const toast = useToast();
  const [appointments, setAppointments]   = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [currentUser, setCurrentUser]     = useState<any>(null);
  const [confirmId, setConfirmId]         = useState<string | null>(null);
  const [postCallId, setPostCallId]       = useState<string | null>(null);
  const [rescheduleId, setRescheduleId]   = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());

  useFocusEffect(useCallback(() => { loadAppointments(); }, []));

  const loadAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);
      const { data: doctorData } = await supabase.from('doctors').select('id').eq('user_id', user.id).single();
      if (!doctorData) return;

      const { data: appts } = await supabase.from('consultations')
        .select('*')
        .eq('doctor_id', doctorData.id)
        .order('scheduled_at', { ascending: true });

      const patientIds = [...new Set((appts || []).map((a: any) => a.patient_id).filter(Boolean))];
      const { data: profilesData } = patientIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, profile_image').in('id', patientIds)
        : { data: [] };
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      setAppointments((appts || []).map((a: any) => ({ ...a, profiles: profileMap.get(a.patient_id) || null })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAppointments(); setRefreshing(false); };

  const confirmComplete = (id: string) => setConfirmId(id);

  const doComplete = async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      const appt = appointments.find(a => a.id === id);
      await supabase.from('consultations').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
      if (appt?.patient_id) {
        await supabase.from('notifications').insert({
          user_id: appt.patient_id,
          title: 'Consultation Completed',
          message: 'Your consultation has been marked as completed by your doctor.',
          type: 'system',
          is_read: false,
        });
      }
      toast.showSuccess('Completed', 'Consultation marked as completed.');
      loadAppointments();
    } catch {
      toast.showError('Error', 'Failed to update status');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === 'completed') { confirmComplete(id); return; }
    try {
      await supabase.from('consultations').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      const appt = appointments.find(a => a.id === id);
      if (appt?.patient_id) {
        const notifMap: Record<string, { title: string; message: string }> = {
          confirmed: {
            title: 'Consultation Approved!',
            message: `Your ${appt.consultation_type} consultation on ${formatDate(appt.scheduled_at)} has been approved. Please pay to confirm your slot.`,
          },
          cancelled: {
            title: 'Consultation Declined',
            message: 'Your consultation request was declined by the practitioner. You can book a new time.',
          },
        };
        if (notifMap[status]) {
          await supabase.from('notifications').insert({
            user_id: appt.patient_id, ...notifMap[status], type: 'booking', is_read: false,
          });
        }
      }
      toast.showSuccess('Updated', status === 'confirmed' ? 'Approved. Patient notified to pay.' : `Status set to ${status}.`);
      loadAppointments();
    } catch {
      toast.showError('Error', 'Failed to update appointment status');
    }
  };

  const rescheduleAppt = async (id: string, newDate: string) => {
    try {
      await supabase.from('consultations').update({
        scheduled_at: newDate, status: 'pending', updated_at: new Date().toISOString(),
      }).eq('id', id);
      const appt = appointments.find(a => a.id === id);
      if (appt?.patient_id) {
        await supabase.from('notifications').insert({
          user_id: appt.patient_id,
          title: 'Consultation Rescheduled',
          message: `Your practitioner has proposed a new time: ${formatDate(newDate)}. Please pay to confirm.`,
          type: 'booking', is_read: false,
        });
      }
      toast.showSuccess('Rescheduled', 'Patient notified of the new time.');
      setRescheduleId(null);
      loadAppointments();
    } catch { toast.showError('Error', 'Failed to reschedule'); }
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
    } catch { toast.showError('Error', 'Could not open chat'); }
  };

  const joinCall = async (id: string, type: string) => {
    // Mark in_progress + record start time
    await supabase.from('consultations')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'completed');
    loadAppointments();
    const icon = type === 'audio' ? '#config.startWithVideoMuted=true' : '';
    await WebBrowser.openBrowserAsync(
      `https://meet.jit.si/hbridge-${id.replace(/-/g, '').slice(0, 16)}${icon}`
    );
    // Browser closed — prompt doctor to mark complete
    setPostCallId(id);
  };

  const doPostCall = async (completed: boolean) => {
    const id = postCallId;
    setPostCallId(null);
    if (!id) return;
    if (completed) {
      try {
        const appt = appointments.find(a => a.id === id);
        await supabase.from('consultations').update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        }).eq('id', id);
        if (appt?.patient_id) {
          await supabase.from('notifications').insert({
            user_id: appt.patient_id,
            title: 'Consultation Completed',
            message: 'Your consultation has been marked as completed by your doctor.',
            type: 'system',
            is_read: false,
          });
        }
        toast.showSuccess('Done', 'Consultation marked as completed.');
      } catch {
        toast.showError('Error', 'Failed to update status');
      }
    }
    loadAppointments();
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusBg = (s: string) => ({
    pending:     '#FEF3C7',
    confirmed:   'rgba(11,126,138,0.09)',
    scheduled:   'rgba(11,126,138,0.09)',
    in_progress: '#FEF3C7',
    completed:   'rgba(30,158,90,0.1)',
    cancelled:   'rgba(239,68,68,0.08)',
  } as any)[s] ?? C.surface;
  const statusColor = (s: string) => ({
    pending:     '#F59E0B',
    confirmed:   C.teal,
    scheduled:   C.teal,
    in_progress: '#F59E0B',
    completed:   '#1E9E5A',
    cancelled:   '#EF4444',
  } as any)[s] ?? C.muted;
  const statusLabel = (s: string) => ({
    pending:     'Pending',
    confirmed:   'Confirmed',
    scheduled:   'Scheduled',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
  } as any)[s] ?? s;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
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
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                {item.symptoms && <Text style={s.symptoms} numberOfLines={2}>Symptoms: {item.symptoms}</Text>}

                {item.status === 'pending' && (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus(item.id, 'confirmed')}>
                      <Text style={s.primaryBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.outlineBtn} onPress={() => { setRescheduleId(item.id); setRescheduleDate(new Date(item.scheduled_at)); }}>
                      <Text style={s.outlineBtnText}>Reschedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.outlineBtn, { borderColor: '#EF4444' }]} onPress={() => updateStatus(item.id, 'cancelled')}>
                      <Text style={[s.outlineBtnText, { color: '#EF4444' }]}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(item.status === 'confirmed' || item.status === 'scheduled') && (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.primaryBtn} onPress={() => updateStatus(item.id, 'in_progress')}>
                      <Text style={s.primaryBtnText}>Start Session</Text>
                    </TouchableOpacity>
                    {(item.consultation_type === 'video' || item.consultation_type === 'audio') && (
                      <TouchableOpacity style={s.callBtn} onPress={() => joinCall(item.id, item.consultation_type)}>
                        <Ionicons name={item.consultation_type === 'audio' ? 'call' : 'videocam'} size={15} color="#fff" />
                        <Text style={s.callBtnText}>Join Call</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.outlineBtn} onPress={() => updateStatus(item.id, 'cancelled')}>
                      <Text style={s.outlineBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {item.status === 'in_progress' && (
                  <View style={s.actions}>
                    {(item.consultation_type === 'video' || item.consultation_type === 'audio') && (
                      <TouchableOpacity style={s.callBtn} onPress={() => joinCall(item.id, item.consultation_type)}>
                        <Ionicons name={item.consultation_type === 'audio' ? 'call' : 'videocam'} size={15} color="#fff" />
                        <Text style={s.callBtnText}>Join Call</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#10B981' }]} onPress={() => updateStatus(item.id, 'completed')}>
                      <Text style={s.primaryBtnText}>Complete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.outlineBtn} onPress={() => openChat(item)}>
                      <Text style={s.outlineBtnText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>

      {/* Post-call completion prompt */}
      <Modal visible={!!postCallId} animationType="slide" transparent onRequestClose={() => doPostCall(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Ionicons name="checkmark-circle-outline" size={40} color="#0B7E8A" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 6, textAlign: 'center' }}>Call Ended</Text>
            <Text style={{ fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginBottom: 24, lineHeight: 20, textAlign: 'center' }}>
              Was the consultation completed successfully?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => doPostCall(false)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EDE9E0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' }}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => doPostCall(true)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#0B7E8A', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>Yes, Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={!!rescheduleId} animationType="slide" transparent onRequestClose={() => setRescheduleId(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 6 }}>Propose New Time</Text>
            <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginBottom: 20, lineHeight: 19 }}>
              Pick a new date and time. The patient will be notified and prompted to pay.
            </Text>
            <DateTimePicker
              value={rescheduleDate}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={(_: any, d?: Date) => d && setRescheduleDate(d)}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity onPress={() => setRescheduleId(null)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EDE9E0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => rescheduleId && rescheduleAppt(rescheduleId, rescheduleDate.toISOString())}
                style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#0B7E8A', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>Send to Patient</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Complete Sheet */}
      <Modal visible={!!confirmId} animationType="slide" transparent onRequestClose={() => setConfirmId(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 6 }}>Complete Consultation?</Text>
            <Text style={{ fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginBottom: 24, lineHeight: 20 }}>
              This will mark the consultation as completed and notify the patient.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setConfirmId(null)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EDE9E0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doComplete} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#0B7E8A', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>Mark Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  backButton:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitles:   { flex: 1 },
  headerTitle:    { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 2 },

  // White card
  card: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  // Appointment card
  apptCard:    { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  patientName: { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  dateText:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  typeText:    { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: C.teal, textTransform: 'capitalize', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', textTransform: 'capitalize' },
  symptoms:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, lineHeight: 18 },
  actions:     { flexDirection: 'row', gap: 10 },
  primaryBtn:  { flex: 1, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
  outlineBtn:  { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  outlineBtnText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  callBtn:     { flex: 1, backgroundColor: '#0B7E8A', borderRadius: 10, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  callBtnText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  // Empty
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyText:    { fontSize: 16, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
});
