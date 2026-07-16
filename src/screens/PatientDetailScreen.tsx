import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Image,
  Linking, StatusBar, Modal, TextInput, ActivityIndicator, useWindowDimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import FadeScreen from '../components/FadeScreen';
import { useToast } from '../components/ToastProvider';

const C = {
  paper: '#F5F3EE', card: '#FFFFFF', border: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', gold: '#D4A843',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
  green: '#1E9E5A', red: '#EF4444', hero1: '#083236',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <Text style={s.sectionTitle}>
      {title}{count !== undefined ? <Text style={{ color: C.muted }}> ({count})</Text> : null}
    </Text>
  );
}

const TABS = [
  { key: 'symptoms',      label: 'Symptoms',     icon: 'thermometer-outline' },
  { key: 'prescriptions', label: 'Prescriptions', icon: 'medkit-outline' },
  { key: 'labs',          label: 'Lab Results',  icon: 'flask-outline' },
  { key: 'records',       label: 'Records',      icon: 'documents-outline' },
  { key: 'history',       label: 'History',      icon: 'calendar-outline' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function PatientDetailScreen({ navigation, route }: any) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { patient } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>('symptoms');
  const [consultations, setConsultations]   = useState<any[]>([]);
  const [sharedRecords, setSharedRecords]   = useState<any[]>([]);
  const [medications, setMedications]       = useState<any[]>([]);
  const [labResults, setLabResults]         = useState<any[]>([]);
  const [symptomLogs, setSymptomLogs]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [myUserId, setMyUserId]             = useState<string | null>(null);
  const [doctorId, setDoctorId]             = useState<string | null>(null);

  // Prescribe modal
  const [prescribeModal, setPrescribeModal] = useState(false);
  const [rx, setRx] = useState({ name: '', dosage: '', frequency: '', start_date: '', end_date: '', notes: '' });
  const [savingRx, setSavingRx] = useState(false);

  // Lab result modal
  const [labModal, setLabModal] = useState(false);
  const [lab, setLab] = useState({ title: '', raw_text: '' });
  const [savingLab, setSavingLab] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (doc) setDoctorId(doc.id);

      await Promise.all([
        loadConsultations(patient.id, doc?.id),
        loadSharedRecords(patient.id, doc?.id),
        loadMedications(patient.id),
        loadLabResults(patient.id),
        loadSymptomLogs(patient.id),
      ]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadConsultations = async (pid: string, did?: string) => {
    if (!did) return;
    const { data } = await supabase
      .from('consultations')
      .select('id, scheduled_at, status, consultation_type, diagnosis, symptoms')
      .eq('patient_id', pid).eq('doctor_id', did)
      .order('scheduled_at', { ascending: false }).limit(5);
    setConsultations(data || []);
  };

  const loadSharedRecords = async (pid: string, did?: string) => {
    if (!did) return;
    const { data } = await supabase
      .from('medical_record_access')
      .select('id, granted_at, medical_records(id, title, record_type, file_url)')
      .eq('doctor_id', did).eq('patient_id', pid).eq('is_active', true)
      .order('granted_at', { ascending: false });
    setSharedRecords(data || []);
  };

  const loadMedications = async (pid: string) => {
    const { data } = await supabase
      .from('medications').select('*').eq('patient_id', pid)
      .order('created_at', { ascending: false });
    setMedications(data || []);
  };

  const loadLabResults = async (pid: string) => {
    const { data } = await supabase
      .from('lab_analyses').select('*').eq('patient_id', pid)
      .order('created_at', { ascending: false });
    setLabResults(data || []);
  };

  const loadSymptomLogs = async (pid: string) => {
    const { data } = await supabase
      .from('symptom_logs').select('*').eq('patient_id', pid)
      .order('logged_at', { ascending: false }).limit(5);
    setSymptomLogs(data || []);
  };

  const openChat = async () => {
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
        other: { id: patient.id, full_name: patient.full_name, avatar_url: patient.profile_image },
        currentUserId: myUserId,
      });
    } catch (e: any) { toast.showError('Error', e.message); }
  };

  const prescribe = async () => {
    if (!rx.name.trim()) { toast.showWarning('Required', 'Enter medication name'); return; }
    setSavingRx(true);
    try {
      const { error: medErr } = await supabase.from('medications').insert({
        patient_id: patient.id,
        name: rx.name.trim(),
        dosage: rx.dosage.trim() || null,
        frequency: rx.frequency.trim() || null,
        start_date: rx.start_date || null,
        end_date: rx.end_date || null,
        notes: rx.notes.trim() || null,
        reminder_times: [],
        is_active: true,
      });
      if (medErr) throw medErr;

      // Cross-post to medical_records
      if (myUserId && doctorId) {
        const { data: newRec } = await supabase.from('medical_records').insert({
          user_id: myUserId,
          record_type: 'prescription',
          title: `${rx.name.trim()} — Prescription`,
          data: { dosage: rx.dosage.trim() || null, frequency: rx.frequency.trim() || null, notes: rx.notes.trim() || null },
          is_sensitive: false,
        }).select('id').single();
        if (newRec) {
          await supabase.from('medical_record_access').insert({
            record_id: newRec.id, patient_id: patient.id, doctor_id: doctorId,
            access_type: 'doctor_sent', granted_at: new Date().toISOString(), is_active: true,
          });
        }
      }

      await supabase.from('notifications').insert({
        user_id: patient.id,
        title: 'New Prescription',
        message: `Your doctor has prescribed ${rx.name.trim()}${rx.dosage ? ` (${rx.dosage})` : ''}${rx.frequency ? ' — ' + rx.frequency : ''}.`,
        type: 'system', is_read: false,
      });

      // Optimistic update — don't rely on a reload that RLS may block for the doctor
      const newMed = {
        id: Date.now().toString(), patient_id: patient.id,
        name: rx.name.trim(), dosage: rx.dosage.trim() || null,
        frequency: rx.frequency.trim() || null, is_active: true,
        created_at: new Date().toISOString(),
      };
      setMedications(prev => [newMed, ...prev]);
      setPrescribeModal(false);
      setRx({ name: '', dosage: '', frequency: '', start_date: '', end_date: '', notes: '' });
      toast.showSuccess('Prescribed', `Medication added for ${patient.full_name}.`);
    } catch (e: any) { toast.showError('Error', e.message || 'Could not save prescription'); }
    finally { setSavingRx(false); }
  };

  const sendLabResult = async () => {
    if (!lab.title.trim()) { toast.showWarning('Required', 'Enter a title'); return; }
    if (!lab.raw_text.trim()) { toast.showWarning('Required', 'Enter the lab report text'); return; }
    setSavingLab(true);
    try {
      const { error: labErr } = await supabase.from('lab_analyses').insert({
        patient_id: patient.id,
        title: lab.title.trim(),
        raw_text: lab.raw_text.trim(),
        analysis: {},
        flagged_count: 0,
      });
      if (labErr) throw labErr;

      // Cross-post to medical_records
      if (myUserId && doctorId) {
        const { data: newRec } = await supabase.from('medical_records').insert({
          user_id: myUserId,
          record_type: 'lab_result',
          title: lab.title.trim(),
          data: { raw_text: lab.raw_text.trim() },
          is_sensitive: false,
        }).select('id').single();
        if (newRec) {
          await supabase.from('medical_record_access').insert({
            record_id: newRec.id, patient_id: patient.id, doctor_id: doctorId,
            access_type: 'doctor_sent', granted_at: new Date().toISOString(), is_active: true,
          });
        }
      }

      await supabase.from('notifications').insert({
        user_id: patient.id,
        title: 'New Lab Result',
        message: `Your doctor has shared a lab result: ${lab.title.trim()}`,
        type: 'system',
      });

      // Optimistic update
      const newLab = {
        id: Date.now().toString(), patient_id: patient.id,
        title: lab.title.trim(), raw_text: lab.raw_text.trim(),
        flagged_count: 0, created_at: new Date().toISOString(),
      };
      setLabResults(prev => [newLab, ...prev]);
      setLabModal(false);
      setLab({ title: '', raw_text: '' });
      toast.showSuccess('Sent', 'Lab result delivered to patient.');
    } catch (e: any) { toast.showError('Error', e.message || 'Could not save lab result'); }
    finally { setSavingLab(false); }
  };

  const statusColor = (st: string) =>
    st === 'completed' ? C.teal : st === 'cancelled' ? C.red : C.gold;


  const heroHeight = 260 + insets.top;
  const cardMinHeight = screenHeight - heroHeight + 60;

  return (
    <FadeScreen>
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: C.paper }} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Hero ── */}
        <View style={[s.hero, { height: heroHeight }]}>
          {patient.profile_image
            ? <Image source={{ uri: patient.profile_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#083236' }]} />}
          <LinearGradient
            colors={['rgba(8,50,54,0.08)', 'rgba(8,50,54,0.55)', 'rgba(8,50,54,0.96)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <TouchableOpacity style={[s.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.heroBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.heroBadge}>
                <Ionicons name="person" size={10} color="#fff" />
                <Text style={s.heroBadgeText}>Patient</Text>
              </View>
              <Text style={s.heroName} numberOfLines={1}>{patient.full_name}</Text>
              {patient.email ? <Text style={s.heroSub} numberOfLines={1}>{patient.email}</Text> : null}
              {patient.phone ? <Text style={s.heroSub} numberOfLines={1}>{patient.phone}</Text> : null}
              {patient.hbridge_id ? (
                <View style={s.heroIdRow}>
                  <Ionicons name="id-card-outline" size={11} color="rgba(255,255,255,0.7)" />
                  <Text style={s.heroIdText}>{patient.hbridge_id}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.heroActions}>
              <TouchableOpacity style={s.heroActionBtn} onPress={openChat}>
                <Ionicons name="chatbubble-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroActionBtn} onPress={() => { if (patient.phone) Linking.openURL(`tel:${patient.phone}`); }}>
                <Ionicons name="call-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Paper card ── */}
        <View style={[s.paperCard, { minHeight: cardMinHeight }]}>

          {/* Action buttons */}
          <View style={s.actionsRow}>
            <ActionBtn icon="medkit-outline" label="Prescribe" color="#D4A843" onPress={() => setPrescribeModal(true)} />
            <ActionBtn icon="flask-outline" label="Lab Result" color="#1E9E5A" onPress={() => setLabModal(true)} />
          </View>

          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
            {TABS.map(t => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => setActiveTab(t.key)}>
                  <Ionicons name={t.icon as any} size={13} color={active ? C.teal : C.muted} />
                  <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tab content */}
          <View style={{ padding: 16 }}>
            {activeTab === 'symptoms' && (
              loading
                ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
                : symptomLogs.length === 0
                  ? <Empty icon="thermometer-outline" text="No symptoms logged by patient" />
                  : symptomLogs.map(sl => (
                    <View key={sl.id} style={s.smallCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.smallDate}>{fmt(sl.logged_at)}</Text>
                        <Text style={s.smallVal}>{(sl.symptoms || []).join(', ')}</Text>
                      </View>
                      <View style={[s.sevChip, { backgroundColor: sl.severity <= 3 ? 'rgba(30,158,90,0.1)' : sl.severity <= 6 ? 'rgba(212,168,67,0.12)' : 'rgba(239,68,68,0.1)' }]}>
                        <Text style={[s.sevChipText, { color: sl.severity <= 3 ? C.green : sl.severity <= 6 ? C.gold : C.red }]}>Sev {sl.severity}/10</Text>
                      </View>
                    </View>
                  ))
            )}

            {activeTab === 'prescriptions' && (
              loading
                ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
                : medications.length === 0
                  ? <Empty icon="medkit-outline" text="No medications prescribed yet" />
                  : medications.map(m => (
                    <View key={m.id} style={s.smallCard}>
                      <View style={s.rxIconBox}><Ionicons name="medkit" size={16} color={C.gold} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.smallVal}>{m.name}{m.dosage ? ` · ${m.dosage}` : ''}</Text>
                        {m.frequency ? <Text style={s.smallDate}>{m.frequency}</Text> : null}
                      </View>
                      <View style={[s.sevChip, { backgroundColor: m.is_active ? 'rgba(30,158,90,0.1)' : C.border }]}>
                        <Text style={[s.sevChipText, { color: m.is_active ? C.green : C.muted }]}>{m.is_active ? 'Active' : 'Inactive'}</Text>
                      </View>
                    </View>
                  ))
            )}

            {activeTab === 'labs' && (
              loading
                ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
                : labResults.length === 0
                  ? <Empty icon="flask-outline" text="No lab results sent yet" />
                  : labResults.map(l => (
                    <View key={l.id} style={s.smallCard}>
                      <View style={s.rxIconBox}><Ionicons name="flask" size={16} color={C.teal} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.smallVal}>{l.title}</Text>
                        <Text style={s.smallDate}>{fmt(l.created_at)}</Text>
                      </View>
                      {l.flagged_count > 0 && (
                        <View style={[s.sevChip, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                          <Text style={[s.sevChipText, { color: C.red }]}>{l.flagged_count} flagged</Text>
                        </View>
                      )}
                    </View>
                  ))
            )}

            {activeTab === 'records' && (
              loading
                ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
                : sharedRecords.length === 0
                  ? <Empty icon="documents-outline" text="No records shared with you yet" />
                  : sharedRecords.map(r => (
                    <View key={r.id} style={s.smallCard}>
                      <View style={s.rxIconBox}><Ionicons name="document-text" size={16} color={C.teal} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.smallVal}>{r.medical_records?.title ?? 'Record'}</Text>
                        <Text style={s.smallDate}>Shared {fmt(r.granted_at)}</Text>
                      </View>
                      {r.medical_records && (
                        <TouchableOpacity onPress={() => navigation.navigate('RecordDetail', { record: r.medical_records, isIncoming: true })}>
                          <Ionicons name="eye-outline" size={18} color={C.teal} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
            )}

            {activeTab === 'history' && (
              loading
                ? <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
                : consultations.length === 0
                  ? <Empty icon="calendar-outline" text="No consultations with this patient yet" />
                  : consultations.map(c => (
                    <View key={c.id} style={s.smallCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.smallDate}>{fmt(c.scheduled_at)} · {(c.consultation_type || '').replace('_', ' ')}</Text>
                        {c.symptoms && <Text style={s.smallVal} numberOfLines={1}>Symptoms: {c.symptoms}</Text>}
                        {c.diagnosis && <Text style={[s.smallDate, { color: C.teal }]} numberOfLines={1}>Dx: {c.diagnosis}</Text>}
                      </View>
                      <View style={[s.sevChip, { backgroundColor: statusColor(c.status) + '20' }]}>
                        <Text style={[s.sevChipText, { color: statusColor(c.status) }]}>{c.status}</Text>
                      </View>
                    </View>
                  ))
            )}
          </View>
        </View>

      </ScrollView>

      {/* Prescribe Modal */}
      <Modal visible={prescribeModal} animationType="slide" transparent onRequestClose={() => setPrescribeModal(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.sheetTitle}>Prescribe Medication</Text>
              <Text style={s.sheetSub}>For {patient.full_name}</Text>

              <Field label="Medication Name *" value={rx.name} onChange={v => setRx(p => ({ ...p, name: v }))} placeholder="e.g. Amoxicillin 500mg" />
              <Field label="Dosage" value={rx.dosage} onChange={v => setRx(p => ({ ...p, dosage: v }))} placeholder="e.g. 1 tablet" />
              <Field label="Frequency" value={rx.frequency} onChange={v => setRx(p => ({ ...p, frequency: v }))} placeholder="e.g. 3 times daily for 7 days" />
              <Field label="Start Date (YYYY-MM-DD)" value={rx.start_date} onChange={v => setRx(p => ({ ...p, start_date: v }))} placeholder="e.g. 2026-07-10" />
              <Field label="End Date (YYYY-MM-DD)" value={rx.end_date} onChange={v => setRx(p => ({ ...p, end_date: v }))} placeholder="Optional" />
              <Field label="Notes" value={rx.notes} onChange={v => setRx(p => ({ ...p, notes: v }))} placeholder="Special instructions..." multiline />

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setPrescribeModal(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.gold }]} onPress={prescribe} disabled={savingRx}>
                  {savingRx ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Prescribe</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lab Result Modal */}
      <Modal visible={labModal} animationType="slide" transparent onRequestClose={() => setLabModal(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.sheetTitle}>Send Lab Result</Text>
              <Text style={s.sheetSub}>For {patient.full_name}</Text>

              <Field label="Title *" value={lab.title} onChange={v => setLab(p => ({ ...p, title: v }))} placeholder="e.g. Blood Test Result, Malaria RDT" />
              <Field label="Lab Report / Findings *" value={lab.raw_text} onChange={v => setLab(p => ({ ...p, raw_text: v }))} placeholder="Paste or type the full lab report here..." multiline />

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setLabModal(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.green }]} onPress={sendLabResult} disabled={savingLab}>
                  {savingLab ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Send to Patient</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    </FadeScreen>
  );
}

function ActionBtn({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color?: string }) {
  const bg = color ? color + '18' : 'rgba(11,126,138,0.09)';
  const ic = color || C.teal;
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress}>
      <View style={[s.actionIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={20} color={ic} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.emptyCard}>
      <Ionicons name={icon as any} size={22} color={C.muted2} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted2}
        multiline={multiline}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },
  paperCard: { flex: 1, backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  hero: { overflow: 'hidden', justifyContent: 'flex-end' },
  backBtn: { position: 'absolute', top: 0, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 4 },
  heroBadgeText: { fontSize: 10, fontFamily: 'Montserrat_600SemiBold', color: '#fff', letterSpacing: 0.5 },
  heroName: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  heroSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  heroIdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  heroIdText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },
  heroActions: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  heroActionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },

  tabScroll: { borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 48 },
  tabRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  tab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'transparent' },
  tabActive: { backgroundColor: 'rgba(11,126,138,0.1)' },
  tabLabel:      { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  tabLabelActive:{ color: C.teal },
  actionBtn: { alignItems: 'center', gap: 7 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', color: C.textBody },


  smallCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  rxIconBox: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F5F3EE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  smallDate: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  smallVal: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary, marginTop: 2 },
  sevChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  sevChipText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 18, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border },
  emptyText: { fontSize: 12.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2, textAlign: 'center' },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.ink, marginBottom: 2 },
  sheetSub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 0.5, marginBottom: 5 },
  fieldInput: { backgroundColor: '#F5F3EE', borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#EDE9E0', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});
