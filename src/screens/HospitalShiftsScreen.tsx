import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Modal, ActivityIndicator, RefreshControl, StatusBar, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { drName } from '../utils/formatters';
import { sendNotifications } from '../utils/notify';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  ink: '#083236', green: '#1E9E5A', greenBg: 'rgba(30,158,90,0.1)',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function toTimeString(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

export default function HospitalShiftsScreen({ navigation }: any) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hospitals, setHospitals] = useState<any[]>([]); // [{id, name}] — admin always has exactly one
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [roster, setRoster] = useState<any[]>([]); // active hospital_staff + doctors, admin mode
  const [shifts, setShifts] = useState<any[]>([]); // all staff_shifts for selected hospital, with doctor names
  const [onDutyStaff, setOnDutyStaff] = useState<any[]>([]); // hospital_staff rows with on_duty=true
  const [pendingOnDuty, setPendingOnDuty] = useState<any[]>([]); // rows with a pending on-duty request

  const [addVisible, setAddVisible] = useState(false);
  const [pickDoctorId, setPickDoctorId] = useState<string | null>(null);
  const [pickDay, setPickDay] = useState(1);
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 8, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 17, 0));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase.from('profiles').select('hospital_name, user_type, user_types').eq('id', user.id).maybeSingle();
      // Multi-role accounts (e.g. primary type "doctor" with "hospital_admin"
      // as a secondary role) must not be excluded here — checking only the
      // singular user_type caused this exact class of bug before (see the
      // hospitals INSERT policy fix).
      const isHospitalAdminAccount = prof?.user_type === 'hospital_admin' || (prof?.user_types as string[] | null)?.includes('hospital_admin');
      if (!(isHospitalAdminAccount && prof?.hospital_name)) { setLoading(false); setRefreshing(false); return; }

      setIsAdmin(true);
      let { data: hosp } = await supabase.from('hospitals').select('id, name').ilike('name', `%${prof.hospital_name}%`).maybeSingle();
      if (!hosp) { setLoading(false); setRefreshing(false); return; }
      setHospitals([hosp]);
      setSelectedHospitalId(hosp.id);

      const { data: staffRows } = await supabase
        .from('hospital_staff')
        .select('id, doctor_id, on_duty, on_duty_requested_at, doctors(id, full_name, title, specialization, user_id)')
        .eq('hospital_id', hosp.id).eq('status', 'active');
      setRoster((staffRows || []).map((r: any) => r.doctors).filter(Boolean));
      setOnDutyStaff((staffRows || []).filter((r: any) => r.on_duty && r.doctors));
      setPendingOnDuty((staffRows || []).filter((r: any) => !r.on_duty && r.on_duty_requested_at && r.doctors));

      await loadShifts(hosp.id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadShifts = async (hospitalId: string) => {
    const { data } = await supabase
      .from('staff_shifts')
      .select('id, doctor_id, day_of_week, start_time, end_time, doctors(full_name, title)')
      .eq('hospital_id', hospitalId)
      .order('day_of_week');
    setShifts(data || []);
  };

  const saveShift = async () => {
    if (!selectedHospitalId || !pickDoctorId) { toast.showWarning('Required', 'Choose a staff member'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('staff_shifts').insert({
        hospital_id: selectedHospitalId,
        doctor_id: pickDoctorId,
        day_of_week: pickDay,
        start_time: toTimeString(startTime),
        end_time: toTimeString(endTime),
      });
      if (error) throw error;
      setAddVisible(false);
      setPickDoctorId(null);
      await loadShifts(selectedHospitalId);
      toast.showSuccess('Shift Added', '');
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally { setSaving(false); }
  };

  const deleteShift = async (id: string) => {
    if (!selectedHospitalId) return;
    await supabase.from('staff_shifts').delete().eq('id', id);
    loadShifts(selectedHospitalId);
  };

  const approveOnDuty = async (row: any) => {
    const { error } = await supabase.from('hospital_staff')
      .update({ on_duty: true, on_duty_requested_at: null }).eq('id', row.id);
    if (error) { toast.showError('Error', error.message); return; }
    toast.showSuccess('Approved', `${drName(row.doctors?.full_name, row.doctors?.title)} is now on duty.`);
    try {
      await sendNotifications([{
        userId: row.doctors?.user_id,
        title: 'On-Duty Confirmed',
        message: 'Your hospital has confirmed you as on duty.',
        type: 'system',
        is_read: false,
      }]);
    } catch (e) { console.warn('Notification failed', e); }
    load();
  };

  const declineOnDuty = async (row: any) => {
    const { error } = await supabase.from('hospital_staff')
      .update({ on_duty_requested_at: null }).eq('id', row.id);
    if (error) { toast.showError('Error', error.message); return; }
    toast.showInfo('Declined', `${drName(row.doctors?.full_name, row.doctors?.title)}'s on-duty request was declined.`);
    try {
      await sendNotifications([{
        userId: row.doctors?.user_id,
        title: 'On-Duty Request Declined',
        message: 'Your hospital did not confirm your on-duty request.',
        type: 'system',
        is_read: false,
      }]);
    } catch (e) { console.warn('Notification failed', e); }
    load();
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={C.ink} />
        <ActivityIndicator style={{ marginTop: 100 }} color={C.teal} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Shifts</Text>
          <Text style={styles.headerSubtitle}>Manage your staff schedule</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        data={shifts}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.teal} colors={[C.teal]} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 20 }}>
            {pendingOnDuty.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Pending On-Duty Requests</Text>
                {pendingOnDuty.map((r: any) => (
                  <View key={r.id} style={styles.pendingRow}>
                    <View style={styles.onDutyDotPending} />
                    <Text style={[styles.onDutyText, { flex: 1 }]}>{drName(r.doctors?.full_name, r.doctors?.title)}</Text>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approveOnDuty(r)}>
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => declineOnDuty(r)}>
                      <Ionicons name="close" size={15} color={C.text} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
            <Text style={styles.sectionLabel}>On Duty Now</Text>
            {onDutyStaff.length === 0 ? (
              <Text style={styles.emptyText}>No staff have marked themselves on duty yet.</Text>
            ) : onDutyStaff.map((r: any) => (
              <View key={r.doctor_id} style={styles.onDutyRow}>
                <View style={styles.onDutyDot} />
                <Text style={styles.onDutyText}>{drName(r.doctors?.full_name, r.doctors?.title)}</Text>
              </View>
            ))}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Scheduled Shifts</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={C.muted} />
            <Text style={styles.emptyTitle}>No shifts yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.shiftRow}>
            <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{DAYS[item.day_of_week]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shiftDoctor}>{drName(item.doctors?.full_name, item.doctors?.title)}</Text>
              <Text style={styles.shiftTime}>{fmtTime(item.start_time)} – {fmtTime(item.end_time)}</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity onPress={() => deleteShift(item.id)}>
                <Ionicons name="trash-outline" size={18} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Add Shift Modal (admin only) */}
      <Modal visible={addVisible} animationType="slide" transparent onRequestClose={() => setAddVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Shift</Text>

            <Text style={styles.fieldLbl}>STAFF MEMBER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {roster.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.pickChip, pickDoctorId === d.id && styles.pickChipActive]}
                  onPress={() => setPickDoctorId(d.id)}
                >
                  <Text style={[styles.pickChipText, pickDoctorId === d.id && styles.pickChipTextActive]}>{drName(d.full_name, d.title)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLbl}>DAY</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {DAYS.map((d, i) => (
                <TouchableOpacity key={d} style={[styles.pickChip, pickDay === i && styles.pickChipActive]} onPress={() => setPickDay(i)}>
                  <Text style={[styles.pickChipText, pickDay === i && styles.pickChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <TouchableOpacity style={[styles.pickChip, { flex: 1 }]} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.pickChipText}>Start: {fmtTime(toTimeString(startTime))}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickChip, { flex: 1 }]} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.pickChipText}>End: {fmtTime(toTimeString(endTime))}</Text>
              </TouchableOpacity>
            </View>
            {showStartPicker && (
              <DateTimePicker value={startTime} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_: any, d?: Date) => { setShowStartPicker(Platform.OS === 'ios'); if (d) setStartTime(d); }} />
            )}
            {showEndPicker && (
              <DateTimePicker value={endTime} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_: any, d?: Date) => { setShowEndPicker(Platform.OS === 'ios'); if (d) setEndTime(d); }} />
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveShift} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Shift</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Montserrat_600SemiBold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' },
  hospitalRow: { paddingVertical: 10, backgroundColor: C.bg },
  hospitalChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  hospitalChipActive: { backgroundColor: C.tealLight, borderColor: C.teal },
  hospitalChipText: { fontSize: 13, color: C.muted, fontFamily: 'SpaceGrotesk_400Regular' },
  hospitalChipTextActive: { color: C.teal, fontFamily: 'Montserrat_600SemiBold' },
  sectionLabel: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  emptyText: { fontSize: 13, color: C.muted, fontFamily: 'SpaceGrotesk_400Regular' },
  onDutyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenBg, borderRadius: 10, padding: 10, marginBottom: 6 },
  onDutyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(212,168,67,0.12)', borderRadius: 10, padding: 10, marginBottom: 6 },
  onDutyDotPending: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4A843' },
  approveBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  onDutyText: { fontSize: 14, color: C.text, fontFamily: 'Montserrat_600SemiBold' },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  dayBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: C.teal },
  shiftDoctor: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  shiftTime: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 14, color: C.muted, fontFamily: 'SpaceGrotesk_400Regular' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 16 },
  fieldLbl: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 0.5, marginBottom: 8 },
  pickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginRight: 8, alignItems: 'center' },
  pickChipActive: { backgroundColor: C.tealLight, borderColor: C.teal },
  pickChipText: { fontSize: 13, color: C.muted, fontFamily: 'SpaceGrotesk_400Regular' },
  pickChipTextActive: { color: C.teal, fontFamily: 'Montserrat_600SemiBold' },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 13, backgroundColor: C.surface, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  saveBtn: { flex: 1, padding: 14, borderRadius: 13, backgroundColor: C.teal, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
});
