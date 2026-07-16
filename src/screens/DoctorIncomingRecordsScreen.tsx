import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, StatusBar,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  ink: '#083236',
};

const TYPE_LABELS: any = {
  lab_result: 'Lab Result', imaging: 'Imaging / Scan', prescription: 'Prescription',
  vital_signs: 'Vitals', diagnosis: 'Diagnosis', other: 'Other',
};
const RECORD_TYPES = Object.keys(TYPE_LABELS);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DoctorIncomingRecordsScreen({ navigation }: any) {
  const toast = useToast();
  const [records, setRecords]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filter, setFilter]           = useState<'all' | 'active' | 'expired'>('all');
  const [myUserId, setMyUserId]       = useState<string | null>(null);
  const [myDoctorId, setMyDoctorId]   = useState<string | null>(null);

  // Modals
  const [noteModal, setNoteModal]       = useState<{ item: any; text: string } | null>(null);
  const [requestModal, setRequestModal] = useState<{ patient: any; text: string } | null>(null);
  const [revokeModal, setRevokeModal]   = useState<any | null>(null);

  // Local state for UI feedback
  const [localNotes, setLocalNotes]     = useState<Record<string, string>>({});
  const [approvedIds, setApprovedIds]   = useState<Set<string>>(new Set());

  // Send record to patient
  const [sendModal, setSendModal] = useState<{ patient: any; title: string; type: string; notes: string; file: any } | null>(null);
  const [sending, setSending]     = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data: doctorRow } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doctorRow) { setRecords([]); return; }
      setMyDoctorId(doctorRow.id);

      const { data: access, error } = await supabase
        .from('medical_record_access')
        .select('id, access_type, granted_at, expires_at, is_active, record_id, patient_id')
        .eq('doctor_id', doctorRow.id)
        .neq('access_type', 'doctor_sent')   // hide records the doctor sent OUT; those aren't incoming
        .order('granted_at', { ascending: false });

      if (error) throw error;
      if (!access || access.length === 0) { setRecords([]); return; }

      const recordIds  = [...new Set(access.map((a: any) => a.record_id).filter(Boolean))];
      const patientIds = [...new Set(access.map((a: any) => a.patient_id).filter(Boolean))];

      const [{ data: recs }, { data: patients }] = await Promise.all([
        recordIds.length > 0
          ? supabase.from('medical_records').select('id, title, record_type, created_at, file_url, attachment_url').in('id', recordIds)
          : { data: [] },
        patientIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email, profile_image').in('id', patientIds)
          : { data: [] },
      ]);

      const recMap     = new Map((recs || []).map((r: any) => [r.id, r]));
      const patientMap = new Map((patients || []).map((p: any) => [p.id, p]));

      setRecords(access.map((a: any) => ({
        ...a,
        medical_records: recMap.get(a.record_id) || null,
        patient: patientMap.get(a.patient_id) || null,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRecords(); setRefreshing(false); };

  const isExpired = (item: any) =>
    !item.is_active || (item.expires_at && new Date(item.expires_at) <= new Date());

  const filtered = records.filter(r => {
    if (filter === 'active')  return !isExpired(r);
    if (filter === 'expired') return isExpired(r);
    return true;
  });

  const doRevoke = async (id: string) => {
    await supabase.from('medical_record_access').update({ is_active: false }).eq('id', id);
    setRevokeModal(null);
    loadRecords();
  };

  const openConversation = async (patient: any) => {
    if (!myDoctorId || !myUserId || !patient) return;
    try {
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('patient_id', patient.id).eq('doctor_id', myDoctorId).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: newConv, error } = await supabase.from('conversations')
          .insert({ patient_id: patient.id, doctor_id: myDoctorId }).select().single();
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

  const saveNote = async () => {
    if (!noteModal) return;
    const { item, text } = noteModal;
    try {
      await supabase.from('medical_record_access').update({ doctor_note: text.trim() } as any).eq('id', item.id);
    } catch {}
    setLocalNotes(prev => ({ ...prev, [item.id]: text.trim() }));
    setNoteModal(null);
  };

  const approveRecord = async (item: any) => {
    try {
      await supabase.from('medical_record_access').update({ access_type: 'approved' } as any).eq('id', item.id);
    } catch {}
    setApprovedIds(prev => new Set([...prev, item.id]));
  };

  const sendRecordRequest = async () => {
    if (!requestModal || !myDoctorId || !myUserId) return;
    const { patient, text } = requestModal;
    try {
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('patient_id', patient.id).eq('doctor_id', myDoctorId).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: newConv, error } = await supabase.from('conversations')
          .insert({ patient_id: patient.id, doctor_id: myDoctorId }).select().single();
        if (error) throw error;
        convId = newConv.id;
      }
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: myUserId,
        content: text.trim() || 'I would like to request a medical record from you.',
        message_type: 'text',
      });
    } catch {}
    setRequestModal(null);
    toast.showSuccess('Request Sent', 'Your record request has been sent to the patient.');
  };

  const pickSendFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets?.[0]) setSendModal(prev => prev ? { ...prev, file: r.assets[0] } : null);
  };

  const pickSendImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to attach images.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) {
      setSendModal(prev => prev ? { ...prev, file: { uri: r.assets[0].uri, name: 'image.jpg', mimeType: 'image/jpeg' } } : null);
    }
  };

  const handleSendToPatient = async () => {
    if (!sendModal || !myDoctorId || !myUserId) return;
    const { patient, title, type, notes, file } = sendModal;
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title for the record.'); return; }

    setSending(true);
    try {
      let fileUrl: string | null = null;
      if (file) {
        const ext = (file.name?.split('.').pop() || 'pdf').toLowerCase();
        const mime = file.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
        const path = `records/${myUserId}/${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: file.uri, name: file.name || `file.${ext}`, type: mime } as any);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const supabaseUrl = (supabase as any).supabaseUrl as string;
        const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${path}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
          body: formData,
        });
        if (!uploadRes.ok) throw new Error(`File upload failed: ${await uploadRes.text()}`);
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        fileUrl = publicUrl;
      }

      // Create the record owned by the doctor
      const { data: newRecord, error: recError } = await supabase.from('medical_records').insert({
        user_id: myUserId,
        record_type: type,
        title: title.trim(),
        file_url: fileUrl,
        attachment_url: fileUrl,
        data: { notes: notes.trim() || null },
        is_sensitive: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id').single();
      if (recError) throw recError;

      // Grant the patient access with access_type='doctor_sent'
      const { error: accessError } = await supabase.from('medical_record_access').insert({
        record_id: newRecord.id,
        patient_id: patient.id,
        doctor_id: myDoctorId,
        access_type: 'doctor_sent',
        granted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      });
      if (accessError) throw accessError;

      setSendModal(null);
      toast.showSuccess('Sent', `Record sent to ${patient.full_name ?? 'patient'}.`);
    } catch (e: any) {
      Alert.alert('Send Failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Incoming Records</Text>
          <Text style={s.headerSub}>Records shared with you by patients</Text>
        </View>
      </View>

      {/* Paper card */}
      <View style={s.paperCard}>
        {/* Filter chips */}
        <View style={s.filterRow}>
          {(['all', 'active', 'expired'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.chip, filter === f && s.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.chipText, filter === f && s.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Expired'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1, marginTop: 60 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="documents-outline" size={32} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>No records yet</Text>
                <Text style={s.emptySub}>When a patient shares a record with you, it will appear here</Text>
              </View>
            }
            renderItem={({ item }) => {
              const rec     = item.medical_records;
              const patient = item.patient;
              const expired = isExpired(item);
              const fileUrl = rec?.file_url || rec?.attachment_url;
              const approved = approvedIds.has(item.id) || item.access_type === 'approved';
              const note = localNotes[item.id];

              return (
                <View style={s.card}>
                  <View style={s.cardTop}>
                    <View style={[s.iconBox, { backgroundColor: expired ? C.surface : C.tealLight }]}>
                      <Ionicons name="document-text" size={22} color={expired ? C.muted : C.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle} numberOfLines={1}>{rec?.title ?? 'Medical Record'}</Text>
                      <Text style={s.cardMeta}>
                        {TYPE_LABELS[rec?.record_type] ?? 'Document'}{rec?.created_at ? ` · ${formatDate(rec.created_at)}` : ''}
                      </Text>
                      {patient && (
                        <Text style={s.cardPatient} numberOfLines={1}>
                          From: {patient.full_name ?? 'Patient'}
                        </Text>
                      )}
                    </View>
                    <View style={[s.badge, approved ? s.badgeApproved : expired ? s.badgeExp : s.badgeActive]}>
                      <Text style={[s.badgeText, approved ? s.badgeTextApproved : expired ? s.badgeTextExp : s.badgeTextActive]}>
                        {approved ? 'Approved' : expired ? 'Expired' : 'Active'}
                      </Text>
                    </View>
                  </View>

                  <Text style={s.grantedAt}>
                    Shared {formatDate(item.granted_at)}
                    {item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ''}
                  </Text>

                  {note ? (
                    <View style={s.noteRow}>
                      <Ionicons name="create-outline" size={13} color={C.muted} />
                      <Text style={s.noteText} numberOfLines={2}>{note}</Text>
                    </View>
                  ) : null}

                  {/* Primary actions row */}
                  <View style={s.actions}>
                    {fileUrl && !expired && (
                      <TouchableOpacity style={s.viewBtn} onPress={() => Linking.openURL(fileUrl)}>
                        <Ionicons name="eye-outline" size={14} color={C.teal} />
                        <Text style={s.viewBtnText}>View</Text>
                      </TouchableOpacity>
                    )}
                    {!expired && !approved && (
                      <TouchableOpacity style={s.approveBtn} onPress={() => approveRecord(item)}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#1E9E5A" />
                        <Text style={s.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    )}
                    {!expired && (
                      <TouchableOpacity style={s.revokeBtn} onPress={() => setRevokeModal(item)}>
                        <Ionicons name="close-outline" size={14} color="#EF4444" />
                        <Text style={s.revokeBtnText}>Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Secondary actions row */}
                  <View style={s.secondaryActions}>
                    <TouchableOpacity style={s.secBtn} onPress={() => setNoteModal({ item, text: note || '' })}>
                      <Ionicons name="create-outline" size={13} color={C.muted} />
                      <Text style={s.secBtnText}>Add Note</Text>
                    </TouchableOpacity>
                    {patient && (
                      <TouchableOpacity style={s.secBtn} onPress={() => openConversation(patient)}>
                        <Ionicons name="chatbubble-outline" size={13} color={C.muted} />
                        <Text style={s.secBtnText}>Reply</Text>
                      </TouchableOpacity>
                    )}
                    {patient && (
                      <TouchableOpacity style={s.secBtn} onPress={() => setRequestModal({ patient, text: '' })}>
                        <Ionicons name="download-outline" size={13} color={C.muted} />
                        <Text style={s.secBtnText}>Request</Text>
                      </TouchableOpacity>
                    )}
                    {patient && (
                      <TouchableOpacity style={[s.secBtn, s.secBtnSend]} onPress={() => setSendModal({ patient, title: '', type: 'diagnosis', notes: '', file: null })}>
                        <Ionicons name="arrow-up-circle-outline" size={13} color={C.teal} />
                        <Text style={[s.secBtnText, { color: C.teal }]}>Send Record</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* Revoke Confirmation Modal */}
      <Modal visible={!!revokeModal} transparent animationType="fade" onRequestClose={() => setRevokeModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalIconWrap}>
              <Ionicons name="warning-outline" size={28} color="#EF4444" />
            </View>
            <Text style={s.modalTitle}>Revoke Access</Text>
            <Text style={s.modalBody}>Remove this patient's access to their record? This cannot be undone without the patient re-sharing.</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setRevokeModal(null)}>
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={() => revokeModal && doRevoke(revokeModal.id)}>
                <Text style={s.modalBtnConfirmText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal visible={!!noteModal} transparent animationType="fade" onRequestClose={() => setNoteModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Add Note</Text>
              <Text style={s.modalBody}>Write a note or feedback about this record.</Text>
              <TextInput
                style={s.noteInput}
                multiline
                numberOfLines={4}
                placeholder="Enter your note..."
                placeholderTextColor={C.muted}
                value={noteModal?.text ?? ''}
                onChangeText={t => setNoteModal(prev => prev ? { ...prev, text: t } : null)}
              />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setNoteModal(null)}>
                  <Text style={s.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtnConfirm, { backgroundColor: C.teal }]} onPress={saveNote}>
                  <Text style={s.modalBtnConfirmText}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Send Record to Patient Modal */}
      <Modal visible={!!sendModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSendModal(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSendModal(null)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle2}>Send Record to Patient</Text>
            <TouchableOpacity onPress={handleSendToPatient} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={s.modalSaveText}>Send</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={s.fieldLabel}>TO</Text>
            <Text style={s.fieldValue}>{sendModal?.patient?.full_name ?? 'Patient'}</Text>

            <Text style={s.fieldLabel}>RECORD TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {RECORD_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, sendModal?.type === t && s.typeChipActive]}
                  onPress={() => setSendModal(prev => prev ? { ...prev, type: t } : null)}
                >
                  <Text style={[s.typeChipText, sendModal?.type === t && s.typeChipTextActive]}>{TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>TITLE *</Text>
            <TextInput
              style={s.fieldInput}
              value={sendModal?.title ?? ''}
              onChangeText={t => setSendModal(prev => prev ? { ...prev, title: t } : null)}
              placeholder="e.g. Consultation Summary"
              placeholderTextColor={C.muted}
            />

            <Text style={s.fieldLabel}>NOTES / FINDINGS</Text>
            <TextInput
              style={[s.fieldInput, { height: 90, textAlignVertical: 'top' }]}
              value={sendModal?.notes ?? ''}
              onChangeText={t => setSendModal(prev => prev ? { ...prev, notes: t } : null)}
              multiline
              placeholder="Add diagnosis notes, prescription details, or test results..."
              placeholderTextColor={C.muted}
            />

            <Text style={s.fieldLabel}>ATTACH FILE (OPTIONAL)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={s.fileBtn} onPress={pickSendFile}>
                <Ionicons name="document-outline" size={18} color={C.teal} />
                <Text style={s.fileBtnText}>Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.fileBtn} onPress={pickSendImage}>
                <Ionicons name="image-outline" size={18} color={C.teal} />
                <Text style={s.fileBtnText}>Image</Text>
              </TouchableOpacity>
            </View>
            {!!sendModal?.file && (
              <View style={s.fileChosen}>
                <Ionicons name="checkmark-circle" size={16} color={C.teal} />
                <Text style={s.fileChosenText} numberOfLines={1}>{sendModal.file.name ?? 'Selected'}</Text>
                <TouchableOpacity onPress={() => setSendModal(prev => prev ? { ...prev, file: null } : null)}>
                  <Ionicons name="close-circle" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Request Records Modal */}
      <Modal visible={!!requestModal} transparent animationType="fade" onRequestClose={() => setRequestModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Request Records</Text>
              <Text style={s.modalBody}>
                Send a message to {requestModal?.patient?.full_name ?? 'this patient'} requesting medical records.
              </Text>
              <TextInput
                style={s.noteInput}
                multiline
                numberOfLines={4}
                placeholder="Describe what records you need..."
                placeholderTextColor={C.muted}
                value={requestModal?.text ?? ''}
                onChangeText={t => setRequestModal(prev => prev ? { ...prev, text: t } : null)}
              />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setRequestModal(null)}>
                  <Text style={s.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtnConfirm, { backgroundColor: C.teal }]} onPress={sendRecordRequest}>
                  <Text style={s.modalBtnConfirmText}>Send Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 2 },

  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  chipActive: { backgroundColor: C.tealLight, borderColor: C.teal },
  chipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  chipTextActive: { fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },

  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: C.text },
  cardMeta: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },
  cardPatient: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal, marginTop: 3 },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeActive: { backgroundColor: C.tealLight },
  badgeApproved: { backgroundColor: 'rgba(30,158,90,0.1)' },
  badgeExp: { backgroundColor: C.surface },
  badgeText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },
  badgeTextActive: { color: C.teal },
  badgeTextApproved: { color: '#1E9E5A' },
  badgeTextExp: { color: C.muted },

  grantedAt: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 10 },

  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 8, backgroundColor: '#F9F8F5', borderRadius: 8, padding: 8 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, paddingVertical: 9, backgroundColor: C.tealLight },
  viewBtnText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#1E9E5A', borderRadius: 12, paddingVertical: 9, backgroundColor: 'rgba(30,158,90,0.06)' },
  approveBtnText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#1E9E5A' },
  revokeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 9, backgroundColor: 'rgba(239,68,68,0.06)' },
  revokeBtnText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#EF4444' },

  secondaryActions: { flexDirection: 'row', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  secBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, backgroundColor: C.surface },
  secBtnSend: { backgroundColor: C.tealLight },
  secBtnText: { fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', color: C.muted },

  // Send modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  modalCancelText: { fontSize: 15, fontFamily: 'Montserrat_500Medium', color: C.muted },
  modalTitle2: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  modalSaveText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.teal },
  fieldLabel: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.muted, marginTop: 16, marginBottom: 6, letterSpacing: 0.8 },
  fieldValue: { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: C.text, marginBottom: 4 },
  fieldInput: { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, marginRight: 8 },
  typeChipActive: { backgroundColor: C.teal, borderColor: C.teal },
  typeChipText: { fontSize: 13, color: C.text, fontFamily: 'Montserrat_500Medium' },
  typeChipTextActive: { color: '#fff' },
  fileBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12, backgroundColor: C.surface },
  fileBtnText: { fontSize: 14, color: C.text, fontFamily: 'Montserrat_500Medium' },
  fileChosen: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F5F5', borderRadius: 8, padding: 10, marginTop: 8 },
  fileChosenText: { flex: 1, fontSize: 13, color: C.text, fontFamily: 'SpaceGrotesk_400Regular' },

  empty: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 280 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 28 },
  modalBox: { backgroundColor: '#fff', borderRadius: 24, padding: 28, gap: 12 },
  modalIconWrap: { alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.text, textAlign: 'center' },
  modalBody: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 20 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnCancel: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#F5F3EE', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  modalBtnConfirm: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#EF4444', alignItems: 'center' },
  modalBtnConfirmText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  noteInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 14,
    fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text,
    minHeight: 100, textAlignVertical: 'top',
  },
});
