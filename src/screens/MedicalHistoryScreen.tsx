import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { drName } from '../utils/formatters';

const C = {
  paper: '#F5F3EE', paperDark: '#EDE9E0', card: '#FFFFFF', border: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', gold: '#D4A843',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
  green: '#1E9E5A', red: '#EF4444',
};

const TABS = ['Consultations', 'Medications', 'Lab Results', 'Symptoms'] as const;
type Tab = typeof TABS[number];

const SYMPTOM_OPTIONS = [
  'Headache', 'Fever', 'Cough', 'Fatigue', 'Nausea',
  'Chest Pain', 'Shortness of Breath', 'Back Pain', 'Joint Pain',
  'Vomiting', 'Diarrhea', 'Dizziness', 'Swelling', 'Loss of Appetite',
  'Sore Throat', 'Runny Nose', 'Abdominal Pain', 'Blurred Vision',
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SeverityBar({ value }: { value: number }) {
  const color = value <= 3 ? C.green : value <= 6 ? C.gold : C.red;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <View style={{ flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2 }}>
        <View style={{ width: `${value * 10}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'Montserrat_700Bold', color }}>{value}/10</Text>
    </View>
  );
}

export default function MedicalHistoryScreen({ navigation }: any) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('Consultations');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [consultations, setConsultations] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);

  // Symptom log modal
  const [logModal, setLogModal] = useState(false);
  const [selSymptoms, setSelSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState(5);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await Promise.all([
        loadConsultations(user.id),
        loadMedications(user.id),
        loadLabResults(user.id),
        loadSymptoms(user.id),
      ]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadConsultations = async (uid: string) => {
    const { data } = await supabase
      .from('consultations')
      .select('id, scheduled_at, diagnosis, prescription, notes, consultation_type, doctors(full_name, specialization)')
      .eq('patient_id', uid)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false });
    setConsultations(data || []);
  };

  const loadMedications = async (uid: string) => {
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', uid)
      .order('created_at', { ascending: false });
    setMedications(data || []);
  };

  const loadLabResults = async (uid: string) => {
    const { data } = await supabase
      .from('lab_analyses')
      .select('*')
      .eq('patient_id', uid)
      .order('created_at', { ascending: false });
    setLabResults(data || []);
  };

  const loadSymptoms = async (uid: string) => {
    const { data } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('patient_id', uid)
      .order('logged_at', { ascending: false });
    setSymptoms(data || []);
  };

  const toggleMedication = async (med: any) => {
    const newVal = !med.is_active;
    await supabase.from('medications').update({ is_active: newVal }).eq('id', med.id);
    setMedications(prev => prev.map(m => m.id === med.id ? { ...m, is_active: newVal } : m));
  };

  const saveSymptomLog = async () => {
    if (selSymptoms.length === 0) {
      toast.showWarning('Required', 'Select at least one symptom');
      return;
    }
    if (!userId) return;
    setSaving(true);
    try {
      await supabase.from('symptom_logs').insert({
        patient_id: userId,
        symptoms: selSymptoms,
        severity,
        note: note.trim() || null,
        logged_at: new Date().toISOString(),
      });
      setLogModal(false);
      setSelSymptoms([]); setSeverity(5); setNote('');
      await loadSymptoms(userId);
      toast.showSuccess('Logged', 'Symptom log saved successfully.');
    } catch (e: any) {
      toast.showError('Error', e.message);
    } finally { setSaving(false); }
  };

  const renderConsultations = () => (
    consultations.length === 0
      ? <Empty icon="calendar-outline" text="No completed consultations yet" />
      : consultations.map(c => (
        <View key={c.id} style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.cardDate}>{fmt(c.scheduled_at)}</Text>
            <View style={s.typeBadge}><Text style={s.typeBadgeText}>{(c.consultation_type || 'consultation').replace('_', ' ')}</Text></View>
          </View>
          <Text style={s.cardDr}>{drName(c.doctors?.full_name, c.doctors?.title)}</Text>
          <Text style={s.cardSpec}>{c.doctors?.specialization || 'General'}</Text>
          {c.diagnosis ? <InfoRow label="Diagnosis" value={c.diagnosis} /> : null}
          {c.prescription ? <InfoRow label="Prescription" value={c.prescription} /> : null}
          {c.notes ? <InfoRow label="Notes" value={c.notes} /> : null}
        </View>
      ))
  );

  const renderMedications = () => (
    <>
      {medications.length === 0
        ? <Empty icon="medkit-outline" text="No medications prescribed yet" />
        : medications.map(m => (
          <View key={m.id} style={[s.card, !m.is_active && { opacity: 0.6 }]}>
            <View style={s.cardTop}>
              <Text style={s.medName}>{m.name}</Text>
              <TouchableOpacity onPress={() => toggleMedication(m)} style={[s.statusPill, { backgroundColor: m.is_active ? 'rgba(30,158,90,0.1)' : C.border }]}>
                <Text style={[s.statusPillText, { color: m.is_active ? C.green : C.muted }]}>{m.is_active ? 'Active' : 'Inactive'}</Text>
              </TouchableOpacity>
            </View>
            {m.dosage ? <Text style={s.medMeta}>Dosage: <Text style={s.medMetaVal}>{m.dosage}</Text></Text> : null}
            {m.frequency ? <Text style={s.medMeta}>Frequency: <Text style={s.medMetaVal}>{m.frequency}</Text></Text> : null}
            {m.start_date ? <Text style={s.medMeta}>From: <Text style={s.medMetaVal}>{fmt(m.start_date)} {m.end_date ? `→ ${fmt(m.end_date)}` : ''}</Text></Text> : null}
            {m.notes ? <Text style={[s.medMeta, { marginTop: 6 }]}>{m.notes}</Text> : null}
          </View>
        ))
      }
    </>
  );

  const renderLabResults = () => (
    labResults.length === 0
      ? <Empty icon="flask-outline" text="No lab results yet.\nYour doctor will send results here." />
      : labResults.map(l => (
        <View key={l.id} style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.medName}>{l.title}</Text>
            {l.flagged_count > 0 && (
              <View style={[s.statusPill, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Ionicons name="warning" size={11} color={C.red} />
                <Text style={[s.statusPillText, { color: C.red }]}>{l.flagged_count} flagged</Text>
              </View>
            )}
          </View>
          <Text style={s.cardDate}>{fmt(l.created_at)}</Text>
          {l.raw_text ? (
            <View style={s.rawBlock}>
              <Text style={s.rawText} numberOfLines={6}>{l.raw_text}</Text>
            </View>
          ) : null}
          {l.analysis && typeof l.analysis === 'object' && Object.keys(l.analysis).length > 0 ? (
            <View style={[s.rawBlock, { backgroundColor: 'rgba(11,126,138,0.05)', borderColor: 'rgba(11,126,138,0.15)' }]}>
              <Text style={[s.rawText, { color: C.teal }]}>
                {JSON.stringify(l.analysis, null, 2)}
              </Text>
            </View>
          ) : null}
        </View>
      ))
  );

  const renderSymptoms = () => (
    <>
      {symptoms.length === 0
        ? <Empty icon="thermometer-outline" text="No symptoms logged yet.\nTap the button below to log how you feel." />
        : symptoms.map(s2 => (
          <View key={s2.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardDate}>{fmt(s2.logged_at)}</Text>
              <Text style={s.severityLabel}>Severity</Text>
            </View>
            <SeverityBar value={s2.severity} />
            <View style={s.tagRow}>
              {(s2.symptoms || []).map((sym: string) => (
                <View key={sym} style={s.tag}><Text style={s.tagText}>{sym}</Text></View>
              ))}
            </View>
            {s2.note ? <Text style={s.medMeta}>{s2.note}</Text> : null}
          </View>
        ))
      }
      <TouchableOpacity style={s.logBtn} onPress={() => setLogModal(true)}>
        <Ionicons name="add-circle" size={18} color="#fff" />
        <Text style={s.logBtnText}>Log Symptoms Now</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.hdrIcon}><Ionicons name="medical" size={26} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>Medical History</Text>
          <Text style={s.hdrSub}>Your complete health record</Text>
        </View>
      </View>

      <View style={s.paperCard}>
        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading
          ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.teal} size="large" /></View>
          : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {activeTab === 'Consultations' && renderConsultations()}
              {activeTab === 'Medications' && renderMedications()}
              {activeTab === 'Lab Results' && renderLabResults()}
              {activeTab === 'Symptoms' && renderSymptoms()}
            </ScrollView>
          )}
      </View>

      {/* Symptom Log Modal */}
      <Modal visible={logModal} animationType="slide" transparent onRequestClose={() => setLogModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Log Symptoms</Text>

            <Text style={s.modalLabel}>What are you experiencing?</Text>
            <View style={s.symptomGrid}>
              {SYMPTOM_OPTIONS.map(sym => {
                const active = selSymptoms.includes(sym);
                return (
                  <TouchableOpacity
                    key={sym}
                    style={[s.symChip, active && s.symChipActive]}
                    onPress={() => setSelSymptoms(prev => active ? prev.filter(s => s !== sym) : [...prev, sym])}
                  >
                    <Text style={[s.symChipText, active && s.symChipTextActive]}>{sym}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.modalLabel}>Severity: <Text style={{ color: severity <= 3 ? C.green : severity <= 6 ? C.gold : C.red, fontFamily: 'Montserrat_700Bold' }}>{severity}/10</Text></Text>
            <View style={s.severityRow}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.sevBtn, severity === n && { backgroundColor: n <= 3 ? C.green : n <= 6 ? C.gold : C.red }]}
                  onPress={() => setSeverity(n)}
                >
                  <Text style={[s.sevBtnText, severity === n && { color: '#fff' }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalLabel}>Additional notes (optional)</Text>
            <TextInput
              style={s.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Any other details..."
              placeholderTextColor={C.muted2}
              multiline
              textAlignVertical="top"
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setLogModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveSymptomLog} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Log</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
      <Ionicons name={icon as any} size={52} color="#C9D0CF" />
      <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0', textAlign: 'center', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 10.5, fontFamily: 'Montserrat_700Bold', color: '#97A2A0', letterSpacing: 0.8, marginBottom: 2 }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#5C6B69', lineHeight: 19 }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },

  hdr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  hdrSub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  paperCard: { flex: 1, backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  tabBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#EAE5DA' },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EDE9E0' },
  tabActive: { backgroundColor: '#0B7E8A' },
  tabText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' },
  tabTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EAE5DA', padding: 14, marginBottom: 10, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0' },
  cardDr: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#16211F', marginTop: 4 },
  cardSpec: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785' },
  typeBadge: { backgroundColor: 'rgba(11,126,138,0.09)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#0B7E8A', textTransform: 'capitalize' },

  medName: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#16211F', flex: 1 },
  medMeta: { fontSize: 12.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginTop: 3 },
  medMetaVal: { fontFamily: 'SpaceGrotesk_500Medium', color: '#16211F' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },

  rawBlock: { backgroundColor: '#F5F3EE', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#EAE5DA' },
  rawText: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#5C6B69', lineHeight: 18 },

  severityLabel: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#97A2A0' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: 'rgba(11,126,138,0.09)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_500Medium', color: '#0B7E8A' },

  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0B7E8A', borderRadius: 14, padding: 14, marginTop: 8 },
  logBtnText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 16 },
  modalLabel: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#7A8785', letterSpacing: 0.6, marginBottom: 8, marginTop: 12 },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#EDE9E0', borderWidth: 1, borderColor: '#EAE5DA' },
  symChipActive: { backgroundColor: 'rgba(11,126,138,0.1)', borderColor: '#0B7E8A' },
  symChipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: '#7A8785' },
  symChipTextActive: { color: '#0B7E8A' },
  severityRow: { flexDirection: 'row', gap: 6 },
  sevBtn: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#EDE9E0' },
  sevBtnText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#7A8785' },
  noteInput: { backgroundColor: '#F5F3EE', borderRadius: 12, borderWidth: 1, borderColor: '#EAE5DA', padding: 12, fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#16211F', minHeight: 70, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#EDE9E0', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#0B7E8A', alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});
