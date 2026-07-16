import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, Text, View, FlatList, SectionList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { useRecordsBadge } from '../context/RecordsBadgeContext';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  ink: '#083236', red: '#EF4444', green: '#1E9E5A',
};

const TYPE_LABELS: Record<string, string> = {
  lab_result: 'Lab Result', imaging: 'Imaging', prescription: 'Prescription',
  vital_signs: 'Vitals', diagnosis: 'Diagnosis', other: 'Other',
};
const TYPE_ICONS: Record<string, string> = {
  lab_result: 'flask-outline', imaging: 'scan-outline', prescription: 'medkit-outline',
  vital_signs: 'pulse-outline', diagnosis: 'document-text-outline', other: 'document-outline',
};
const RECORD_TYPES = Object.keys(TYPE_LABELS);

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Avatar({ name, image, size = 36 }: { name?: string; image?: string; size?: number }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (image) return <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontFamily: 'Montserrat_700Bold', color: C.teal }}>{initials}</Text>
    </View>
  );
}

export default function DoctorCaseFilesScreen({ navigation }: any) {
  const toast = useToast();
  const { clearRecordsBadge } = useRecordsBadge();

  useFocusEffect(useCallback(() => {
    clearRecordsBadge();
  }, []));
  const [tab, setTab]               = useState<'received' | 'sent'>('received');
  const [received, setReceived]     = useState<any[]>([]);
  const [sent, setSent]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<'all' | 'active' | 'expired'>('all');
  const [search, setSearch]         = useState('');
  const [myUserId, setMyUserId]     = useState<string | null>(null);
  const [myDoctorId, setMyDoctorId] = useState<string | null>(null);

  // local UI state
  const [approvedIds, setApprovedIds]     = useState<Set<string>>(new Set());
  const [localNotes, setLocalNotes]       = useState<Record<string, string>>({});
  const [collapsedIds, setCollapsedIds]   = useState<Set<string>>(new Set());
  const [allPatients, setAllPatients]     = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');

  const toggleCollapse = (patientId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      next.has(patientId) ? next.delete(patientId) : next.add(patientId);
      return next;
    });
  };

  // modals
  const [noteModal, setNoteModal]       = useState<{ item: any; text: string } | null>(null);
  const [requestModal, setRequestModal] = useState<{ patient: any; text: string } | null>(null);
  const [revokeModal, setRevokeModal]   = useState<any | null>(null);
  const [sendModal, setSendModal]       = useState<{ patient: any; title: string; type: string; notes: string; file: any; expiry: string } | null>(null);
  const [sending, setSending]           = useState(false);
  const [viewerRecord, setViewerRecord] = useState<any | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyUserId(user.id);

      const { data: doc } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
      if (!doc) { setReceived([]); setSent([]); return; }
      setMyDoctorId(doc.id);

      const { data: access, error: accessErr } = await supabase
        .from('medical_record_access')
        .select('id, access_type, granted_at, expires_at, is_active, record_id, patient_id, doctor_note')
        .eq('doctor_id', doc.id)
        .order('granted_at', { ascending: false });
      if (accessErr) console.error('CaseFiles query error:', accessErr.message);

      if (!access?.length) { setReceived([]); setSent([]); return; }

      const recordIds  = [...new Set(access.map((a: any) => a.record_id).filter(Boolean))];
      const patientIds = [...new Set(access.map((a: any) => a.patient_id).filter(Boolean))];

      const [{ data: recs }, { data: patients }, { data: convos }] = await Promise.all([
        recordIds.length  ? supabase.from('medical_records').select('id,title,record_type,created_at,file_url,attachment_url').in('id', recordIds) : { data: [] },
        patientIds.length ? supabase.from('profiles').select('id,full_name,email,profile_image').in('id', patientIds) : { data: [] },
        supabase.from('conversations').select('patient:profiles!conversations_patient_id_fkey(id,full_name,profile_image)').eq('doctor_id', doc.id),
      ]);

      // Merge patients from record access + conversations, deduplicated by id
      const allPats = new Map<string, any>();
      (patients || []).forEach((p: any) => allPats.set(p.id, p));
      (convos || []).forEach((c: any) => { if (c.patient?.id) allPats.set(c.patient.id, c.patient); });
      setAllPatients(Array.from(allPats.values()));

      const recMap     = new Map((recs     || []).map((r: any) => [r.id, r]));
      const patientMap = new Map((patients || []).map((p: any) => [p.id, p]));

      const enriched = access.map((a: any) => ({
        ...a,
        medical_records: recMap.get(a.record_id) || null,
        patient: patientMap.get(a.patient_id) || null,
      }));

      setReceived(enriched.filter((a: any) => a.access_type !== 'doctor_sent'));
      setSent(enriched.filter((a: any) => a.access_type === 'doctor_sent'));

      // seed local notes from DB
      const notes: Record<string, string> = {};
      enriched.forEach((a: any) => { if (a.doctor_note) notes[a.id] = a.doctor_note; });
      setLocalNotes(notes);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const isExpired = (item: any) =>
    !item.is_active || (item.expires_at && new Date(item.expires_at) <= new Date());

  const applyFilters = (list: any[]) => {
    let out = list;
    if (filter === 'active')  out = out.filter(r => !isExpired(r));
    if (filter === 'expired') out = out.filter(r => isExpired(r));
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r =>
        r.medical_records?.title?.toLowerCase().includes(q) ||
        r.patient?.full_name?.toLowerCase().includes(q)
      );
    }
    return out;
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const doRevoke = async (id: string) => {
    await supabase.from('medical_record_access').update({ is_active: false }).eq('id', id);
    setRevokeModal(null);
    loadAll();
  };

  const approveRecord = async (item: any) => {
    await supabase.from('medical_record_access').update({ access_type: 'approved' } as any).eq('id', item.id);
    setApprovedIds(prev => new Set([...prev, item.id]));

    // Notify patient via chat
    if (!myDoctorId || !myUserId || !item.patient?.id) return;
    try {
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('patient_id', item.patient.id).eq('doctor_id', myDoctorId).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: newConv, error } = await supabase.from('conversations')
          .insert({ patient_id: item.patient.id, doctor_id: myDoctorId }).select().single();
        if (error) throw error;
        convId = newConv.id;
      }
      const recTitle = item.medical_records?.title ?? 'your record';
      await supabase.from('messages').insert({
        conversation_id: convId, sender_id: myUserId,
        content: `I've reviewed "${recTitle}" and approved your record. Feel free to reach out if you have any questions.`,
      });
    } catch { /* approval still succeeded even if message fails */ }
  };

  const saveNote = async () => {
    if (!noteModal) return;
    const { item, text } = noteModal;
    await supabase.from('medical_record_access').update({ doctor_note: text.trim() } as any).eq('id', item.id);
    setLocalNotes(prev => ({ ...prev, [item.id]: text.trim() }));
    setNoteModal(null);
    toast.showSuccess('Note saved', '');
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
        other: { id: patient.id, full_name: patient.full_name, avatar_url: patient.profile_image, isDoctor: false },
        currentUserId: myUserId,
      });
    } catch (e: any) { toast.showError('Error', e.message); }
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
        conversation_id: convId, sender_id: myUserId,
        content: text.trim() || 'I would like to request a medical record from you.',
      });
    } catch {}
    setRequestModal(null);
    toast.showSuccess('Request Sent', `Message sent to ${patient.full_name ?? 'patient'}.`);
  };

  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets?.[0]) setSendModal(prev => prev ? { ...prev, file: r.assets[0] } : null);
  };
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast.showWarning('Permission needed', 'Allow photo access to attach images.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!r.canceled && r.assets?.[0])
      setSendModal(prev => prev ? { ...prev, file: { uri: r.assets[0].uri, name: 'image.jpg', mimeType: 'image/jpeg' } } : null);
  };

  const expiryDate = (key: string): string | null => {
    const ms: Record<string, number> = {
      '7d':  7 * 864e5, '30d': 30 * 864e5, '90d': 90 * 864e5,
      '6m':  180 * 864e5, '1y': 365 * 864e5,
    };
    return ms[key] ? new Date(Date.now() + ms[key]).toISOString() : null;
  };

  const handleSend = async () => {
    if (!sendModal || !myDoctorId || !myUserId) return;
    const { patient, title, type, notes, file, expiry } = sendModal;
    if (!title.trim()) { toast.showWarning('Required', 'Please enter a record title.'); return; }
    setSending(true);
    try {
      let fileUrl: string | null = null;
      if (file) {
        const ext  = (file.name?.split('.').pop() || 'pdf').toLowerCase();
        const mime = file.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
        const path = `records/${myUserId}/${Date.now()}.${ext}`;
        const form = new FormData();
        form.append('file', { uri: file.uri, name: file.name || `file.${ext}`, type: mime } as any);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const supabaseUrl = (supabase as any).supabaseUrl as string;
        const up = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${path}`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' }, body: form,
        });
        if (!up.ok) throw new Error(`Upload failed: ${await up.text()}`);
        fileUrl = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;
      }
      const { data: newRec, error: recErr } = await supabase.from('medical_records').insert({
        user_id: myUserId, record_type: type, title: title.trim(),
        file_url: fileUrl, attachment_url: fileUrl,
        data: { notes: notes.trim() || null },
        is_sensitive: false,
      }).select('id').single();
      if (recErr) throw recErr;

      const { error: accErr } = await supabase.from('medical_record_access').insert({
        record_id: newRec.id, patient_id: patient.id, doctor_id: myDoctorId,
        access_type: 'doctor_sent', granted_at: new Date().toISOString(),
        expires_at: expiryDate(expiry),
        is_active: true,
      });
      if (accErr) throw accErr;

      setSendModal(null);
      toast.showSuccess('Sent', `Record sent to ${patient.full_name ?? 'patient'}.`);
      loadAll();
    } catch (e: any) {
      toast.showError('Send Failed', e.message || 'Something went wrong.');
    } finally { setSending(false); }
  };

  // ── Render card ───────────────────────────────────────────────────────────
  const renderReceived = ({ item }: any) => {
    const rec      = item.medical_records;
    const patient  = item.patient;
    const expired  = isExpired(item);
    const approved = approvedIds.has(item.id) || item.access_type === 'approved';
    const note     = localNotes[item.id];
    const fileUrl  = rec?.file_url || rec?.attachment_url;

    const isImg = isImageUrl(fileUrl);

    return (
      <View style={s.card}>
        {/* Top: thumbnail or icon + title + status */}
        <View style={s.cardTop}>
          {isImg ? (
            <Image source={{ uri: fileUrl! }} style={s.thumb} resizeMode="cover" />
          ) : (
            <View style={[s.iconBox, { backgroundColor: expired ? C.surface : C.tealLight }]}>
              <Ionicons name={(TYPE_ICONS[rec?.record_type] || 'document-outline') as any} size={20} color={expired ? C.muted : C.teal} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.cardTitle} numberOfLines={1}>{rec?.title ?? 'Medical Record'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={s.typeChip}>
                <Text style={s.typeChipText}>{TYPE_LABELS[rec?.record_type] ?? 'Document'}</Text>
              </View>
              {rec?.created_at && (
                <Text style={s.cardMeta}>{fmt(rec.created_at)}</Text>
              )}
            </View>
          </View>
          <View style={[s.badge, approved ? s.badgeGreen : expired ? s.badgeGray : s.badgeTeal]}>
            <Text style={[s.badgeText, approved ? { color: C.green } : expired ? { color: C.muted } : { color: C.teal }]}>
              {approved ? 'Approved' : expired ? 'Expired' : 'Active'}
            </Text>
          </View>
        </View>

        {/* Shared date */}
        <Text style={[s.cardMeta, { marginBottom: 10 }]}>
          Shared {fmt(item.granted_at)}{item.expires_at ? ` · Expires ${fmt(item.expires_at)}` : ''}
        </Text>

        {/* Note */}
        {!!note && (
          <View style={s.noteRow}>
            <Ionicons name="create-outline" size={13} color={C.muted} />
            <Text style={s.noteText} numberOfLines={2}>{note}</Text>
          </View>
        )}

        {/* Primary actions */}
        <View style={s.actions}>
          {fileUrl && !expired && (
            <TouchableOpacity style={s.viewBtn} onPress={() => setViewerRecord(item.medical_records)}>
              <Ionicons name="eye-outline" size={14} color={C.teal} />
              <Text style={s.viewBtnText}>View</Text>
            </TouchableOpacity>
          )}
          {!expired && !approved && (
            <TouchableOpacity style={s.approveBtn} onPress={() => approveRecord(item)}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
              <Text style={[s.viewBtnText, { color: C.green }]}>Approve</Text>
            </TouchableOpacity>
          )}
          {!expired && (
            <TouchableOpacity style={s.revokeBtn} onPress={() => setRevokeModal(item)}>
              <Ionicons name="close-outline" size={14} color={C.red} />
              <Text style={[s.viewBtnText, { color: C.red }]}>Revoke</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Secondary actions */}
        {patient && (
          <View style={s.secRow}>
            <TouchableOpacity style={s.secBtn} onPress={() => setNoteModal({ item, text: note || '' })}>
              <Ionicons name="create-outline" size={13} color={C.muted} />
              <Text style={s.secBtnText}>Note</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secBtn} onPress={() => setRequestModal({ patient, text: '' })}>
              <Ionicons name="download-outline" size={13} color={C.muted} />
              <Text style={s.secBtnText}>Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.secBtn, { backgroundColor: C.tealLight }]}
              onPress={() => setSendModal({ patient, title: '', type: 'diagnosis', notes: '', file: null, expiry: '1y' })}>
              <Ionicons name="arrow-up-circle-outline" size={13} color={C.teal} />
              <Text style={[s.secBtnText, { color: C.teal }]}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSent = ({ item }: any) => {
    const rec     = item.medical_records;
    const patient = item.patient;
    const expired = isExpired(item);
    const fileUrl = rec?.file_url || rec?.attachment_url;

    const isImg = isImageUrl(fileUrl);

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          {isImg ? (
            <Image source={{ uri: fileUrl! }} style={s.thumb} resizeMode="cover" />
          ) : (
            <View style={[s.iconBox, { backgroundColor: expired ? C.surface : 'rgba(99,102,241,0.09)' }]}>
              <Ionicons name={(TYPE_ICONS[rec?.record_type] || 'document-outline') as any} size={20} color={expired ? C.muted : '#6366f1'} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.cardTitle} numberOfLines={1}>{rec?.title ?? 'Medical Record'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={[s.typeChip, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                <Text style={[s.typeChipText, { color: '#6366f1' }]}>{TYPE_LABELS[rec?.record_type] ?? 'Document'}</Text>
              </View>
            </View>
          </View>
          <View style={[s.badge, expired ? s.badgeGray : { backgroundColor: 'rgba(99,102,241,0.09)' }]}>
            <Text style={[s.badgeText, { color: expired ? C.muted : '#6366f1' }]}>{expired ? 'Expired' : 'Sent'}</Text>
          </View>
        </View>

        <Text style={[s.cardMeta, { marginBottom: 10 }]}>
          Sent {fmt(item.granted_at)}{item.expires_at ? ` · Expires ${fmt(item.expires_at)}` : ''}
        </Text>

        <View style={s.actions}>
          {fileUrl && !expired && (
            <TouchableOpacity style={s.viewBtn} onPress={() => setViewerRecord(item.medical_records)}>
              <Ionicons name="eye-outline" size={14} color={C.teal} />
              <Text style={s.viewBtnText}>View</Text>
            </TouchableOpacity>
          )}
          {!expired && (
            <TouchableOpacity style={s.revokeBtn} onPress={() => setRevokeModal(item)}>
              <Ionicons name="close-outline" size={14} color={C.red} />
              <Text style={[s.viewBtnText, { color: C.red }]}>Revoke</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const isImageUrl = (url?: string | null) =>
    !!url && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

  const buildSections = (list: any[]) => {
    const map = new Map<string, { patient: any; data: any[] }>();
    list.forEach(item => {
      const pid = item.patient?.id ?? '__unknown__';
      if (!map.has(pid)) map.set(pid, { patient: item.patient, data: [] });
      map.get(pid)!.data.push(item);
    });
    return Array.from(map.values()).map(({ patient, data }) => ({
      patient,
      patientId: patient?.id ?? '__unknown__',
      data: collapsedIds.has(patient?.id ?? '__unknown__') ? [] : data,
      totalCount: data.length,
    }));
  };

  const activeList = applyFilters(tab === 'received' ? received : sent);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Case Files</Text>
          <Text style={s.headerSub}>
            {received.length} received · {sent.length} sent
          </Text>
        </View>
        <TouchableOpacity
          style={s.sendFab}
          onPress={() => setSendModal({ patient: null, title: '', type: 'diagnosis', notes: '', file: null, expiry: '1y' })}
        >
          <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
          <Text style={s.sendFabText}>Send Record</Text>
        </TouchableOpacity>
      </View>

      {/* Paper card */}
      <View style={s.paperCard}>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['received', 'sent'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'received' ? `Received${received.length ? ` (${received.length})` : ''}` : `Sent${sent.length ? ` (${sent.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput
            style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search by record name or patient..." placeholderTextColor={C.muted}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <View style={s.filterRow}>
          {(['all', 'active', 'expired'] as const).map(f => (
            <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
              <Text style={[s.chipText, filter === f && s.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Expired'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1, marginTop: 60 }} />
        ) : (
          <SectionList
            sections={buildSections(activeList)}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }: any) => {
              const collapsed = collapsedIds.has(section.patientId);
              return (
                <TouchableOpacity style={s.sectionHeader} activeOpacity={0.7} onPress={() => toggleCollapse(section.patientId)}>
                  <Avatar name={section.patient?.full_name} image={section.patient?.profile_image} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.sectionName}>{section.patient?.full_name ?? 'Patient'}</Text>
                    <Text style={s.sectionCount}>{section.totalCount} record{section.totalCount !== 1 ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity style={s.sectionMsgBtn} onPress={() => openConversation(section.patient)}>
                    <Ionicons name="chatbubble-outline" size={15} color={C.teal} />
                    <Text style={s.sectionMsgText}>Message</Text>
                  </TouchableOpacity>
                  <Ionicons
                    name={collapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
                    size={18} color={C.muted} style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="documents-outline" size={32} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>{search ? 'No results' : tab === 'received' ? 'No records received' : 'No records sent'}</Text>
                <Text style={s.emptySub}>
                  {search ? 'Try a different search term' : tab === 'received'
                    ? 'When a patient shares a record with you it will appear here'
                    : 'Records you send to patients will appear here'}
                </Text>
              </View>
            }
            renderItem={tab === 'received' ? renderReceived : renderSent}
          />
        )}
      </View>

      {/* Revoke Modal */}
      <Modal visible={!!revokeModal} transparent animationType="fade" onRequestClose={() => setRevokeModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalIconWrap}>
              <Ionicons name="warning-outline" size={28} color={C.red} />
            </View>
            <Text style={s.modalTitle}>Revoke Access</Text>
            <Text style={s.modalBody}>
              {revokeModal?.access_type === 'doctor_sent'
                ? 'Remove the patient\'s access to this record you sent?'
                : 'Remove your access to this patient\'s record?'}
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setRevokeModal(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirmRed} onPress={() => revokeModal && doRevoke(revokeModal.id)}>
                <Text style={s.modalConfirmText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal visible={!!noteModal} transparent animationType="fade" onRequestClose={() => setNoteModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.overlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Clinical Note</Text>
              <Text style={s.modalBody}>Add notes or observations about this record.</Text>
              <TextInput
                style={s.noteInput} multiline numberOfLines={4}
                placeholder="Enter your note..." placeholderTextColor={C.muted}
                value={noteModal?.text ?? ''}
                onChangeText={t => setNoteModal(prev => prev ? { ...prev, text: t } : null)}
                textAlignVertical="top"
              />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.modalCancel} onPress={() => setNoteModal(null)}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalConfirmTeal} onPress={saveNote}>
                  <Text style={s.modalConfirmText}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Request Records Modal */}
      <Modal visible={!!requestModal} transparent animationType="fade" onRequestClose={() => setRequestModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.overlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Request Records</Text>
              <Text style={s.modalBody}>Send a message to {requestModal?.patient?.full_name ?? 'this patient'} requesting medical records.</Text>
              <TextInput
                style={s.noteInput} multiline numberOfLines={4}
                placeholder="Describe what records you need..." placeholderTextColor={C.muted}
                value={requestModal?.text ?? ''}
                onChangeText={t => setRequestModal(prev => prev ? { ...prev, text: t } : null)}
                textAlignVertical="top"
              />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.modalCancel} onPress={() => setRequestModal(null)}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalConfirmTeal} onPress={sendRecordRequest}>
                  <Text style={s.modalConfirmText}>Send Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Send Record Modal */}
      <Modal visible={!!sendModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setSendModal(null); setPatientSearch(''); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
          <View style={s.sheetHeader}>
            <TouchableOpacity onPress={() => { setSendModal(null); setPatientSearch(''); }}>
              <Text style={s.sheetCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.sheetTitle}>Send Record to Patient</Text>
            <TouchableOpacity onPress={handleSend} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={s.sheetSave}>Send</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {/* Patient selector */}
            <Text style={s.fieldLabel}>TO</Text>
            {sendModal?.patient ? (
              <View style={s.selectedPatientRow}>
                <Avatar name={sendModal.patient.full_name} image={sendModal.patient.profile_image} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={s.patientName}>{sendModal.patient.full_name}</Text>
                  <Text style={s.cardMeta}>Tap × to change</Text>
                </View>
                <TouchableOpacity onPress={() => { setSendModal(prev => prev ? { ...prev, patient: null } : null); setPatientSearch(''); }}>
                  <Ionicons name="close-circle" size={22} color={C.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.patientPickerBox}>
                <View style={s.patPickerSearch}>
                  <Ionicons name="search" size={14} color={C.muted} />
                  <TextInput
                    style={s.patPickerInput}
                    placeholder="Search patient..." placeholderTextColor={C.muted}
                    value={patientSearch} onChangeText={setPatientSearch}
                    autoCorrect={false}
                  />
                  {!!patientSearch && (
                    <TouchableOpacity onPress={() => setPatientSearch('')}>
                      <Ionicons name="close-circle" size={15} color={C.muted} />
                    </TouchableOpacity>
                  )}
                </View>
                {allPatients.filter(p => !patientSearch || p.full_name?.toLowerCase().includes(patientSearch.toLowerCase())).length === 0 ? (
                  <Text style={[s.cardMeta, { padding: 12, textAlign: 'center' }]}>No patients found</Text>
                ) : (
                  allPatients
                    .filter(p => !patientSearch || p.full_name?.toLowerCase().includes(patientSearch.toLowerCase()))
                    .map((p: any) => (
                      <TouchableOpacity key={p.id} style={s.patPickerRow}
                        onPress={() => { setSendModal(prev => prev ? { ...prev, patient: p } : null); setPatientSearch(''); }}>
                        <Avatar name={p.full_name} image={p.profile_image} size={34} />
                        <Text style={s.patientName}>{p.full_name}</Text>
                        <Ionicons name="chevron-forward" size={16} color={C.muted} />
                      </TouchableOpacity>
                    ))
                )}
              </View>
            )}

            <Text style={s.fieldLabel}>RECORD TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {RECORD_TYPES.map(t => (
                <TouchableOpacity key={t}
                  style={[s.typeChip, sendModal?.type === t && s.typeChipActive]}
                  onPress={() => setSendModal(prev => prev ? { ...prev, type: t } : null)}>
                  <Text style={[s.typeChipText, sendModal?.type === t && s.typeChipTextActive]}>{TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>TITLE *</Text>
            <TextInput
              style={s.fieldInput} placeholder="e.g. Consultation Summary" placeholderTextColor={C.muted}
              value={sendModal?.title ?? ''} onChangeText={t => setSendModal(prev => prev ? { ...prev, title: t } : null)}
            />

            <Text style={s.fieldLabel}>NOTES / FINDINGS</Text>
            <TextInput
              style={[s.fieldInput, { height: 90, textAlignVertical: 'top' }]} multiline
              placeholder="Add diagnosis, prescription, or test results..." placeholderTextColor={C.muted}
              value={sendModal?.notes ?? ''} onChangeText={t => setSendModal(prev => prev ? { ...prev, notes: t } : null)}
            />

            <Text style={s.fieldLabel}>ACCESS EXPIRES</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {([
                { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' },
                { key: '90d', label: '90 days' }, { key: '6m', label: '6 months' },
                { key: '1y', label: '1 year' }, { key: 'never', label: 'Never' },
              ] as const).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.typeChip, sendModal?.expiry === opt.key && s.typeChipActive]}
                  onPress={() => setSendModal(prev => prev ? { ...prev, expiry: opt.key } : null)}>
                  <Text style={[s.typeChipText, sendModal?.expiry === opt.key && s.typeChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>ATTACH FILE (OPTIONAL)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={s.fileBtn} onPress={pickFile}>
                <Ionicons name="document-outline" size={18} color={C.teal} />
                <Text style={s.fileBtnText}>Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.fileBtn} onPress={pickImage}>
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

      {/* ── In-app record viewer ── */}
      <Modal visible={!!viewerRecord} animationType="slide" onRequestClose={() => setViewerRecord(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.ink, gap: 12 }}>
            <TouchableOpacity onPress={() => setViewerRecord(null)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: 'Montserrat_600SemiBold' }} numberOfLines={1}>
                {viewerRecord?.title ?? 'Record'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' }}>
                {viewerRecord ? (TYPE_LABELS[viewerRecord.record_type] ?? 'Document') : ''}
                {viewerRecord?.created_at ? ` · ${fmt(viewerRecord.created_at)}` : ''}
              </Text>
            </View>
          </View>

          {viewerRecord && (() => {
            const url = viewerRecord.file_url || viewerRecord.attachment_url;
            if (!url) {
              const d = viewerRecord.data ?? {};
              const rows = Object.entries(d).filter(([, v]) => v !== null && v !== '');
              return (
                <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 12 }}>
                  {rows.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                      <Ionicons name="document-outline" size={64} color="#555" />
                      <Text style={{ color: '#888', fontFamily: 'SpaceGrotesk_400Regular' }}>No content available</Text>
                    </View>
                  ) : rows.map(([key, value]) => (
                    <View key={key} style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
                        {key.replace(/_/g, ' ')}
                      </Text>
                      <Text style={{ fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, lineHeight: 22 }}>
                        {String(value)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              );
            }
            if (isImageUrl(url)) return (
              <Image source={{ uri: url }} style={{ flex: 1 }} resizeMode="contain" />
            );
            const docViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
            return (
              <WebView
                source={{ uri: docViewerUrl }}
                style={{ flex: 1, backgroundColor: '#f5f5f5' }}
                startInLoadingState
                renderLoading={() => (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
                    <ActivityIndicator size="large" color={C.teal} />
                    <Text style={{ marginTop: 12, color: C.muted, fontFamily: 'SpaceGrotesk_400Regular' }}>Loading document...</Text>
                  </View>
                )}
              />
            );
          })()}

          {!!viewerRecord?.data?.notes && (
            <View style={{ backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 20 }}>
                {viewerRecord.data.notes}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.ink },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 12 },
  headerTitles: { flex: 1 },
  headerTitle:  { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  headerSub:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  sendFab:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.teal, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  sendFabText:  { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  // Tabs
  tabs:        { flexDirection: 'row', margin: 16, backgroundColor: C.surface, borderRadius: 14, padding: 4 },
  tab:         { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabActive:   { backgroundColor: C.ink },
  tabText:     { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  tabTextActive: { color: '#fff' },

  // Search
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  chipActive:    { backgroundColor: C.tealLight, borderColor: C.teal },
  chipText:      { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  chipTextActive:{ fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  // Card
  card:       { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  iconBox:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:  { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: C.text },
  cardMeta:   { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },

  badge:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeTeal: { backgroundColor: C.tealLight },
  badgeGreen:{ backgroundColor: 'rgba(30,158,90,0.1)' },
  badgeGray: { backgroundColor: C.surface },
  badgeText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold' },

  // Section header (patient grouping)
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 2, marginBottom: 6, marginTop: 4 },
  sectionName:    { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.text },
  sectionCount:   { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },
  sectionMsgBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: C.teal, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.tealLight },
  sectionMsgText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  // Type chip
  typeChip:     { backgroundColor: C.tealLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeChipText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  // Thumbnail
  thumb: { width: 52, height: 52, borderRadius: 10, flexShrink: 0 },

  // (kept for any remaining uses)
  patientRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 10, padding: 8, marginBottom: 10 },
  patientName: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  grantedAt:   { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },

  noteRow:  { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: '#F9F8F5', borderRadius: 8, padding: 8, marginBottom: 10 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  actions:    { flexDirection: 'row', gap: 8 },
  viewBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: C.teal, borderRadius: 12, paddingVertical: 9, backgroundColor: C.tealLight },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#1E9E5A', borderRadius: 12, paddingVertical: 9, backgroundColor: 'rgba(30,158,90,0.06)' },
  revokeBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 9, backgroundColor: 'rgba(239,68,68,0.06)' },
  viewBtnText:{ fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  secRow:     { flexDirection: 'row', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  secBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, backgroundColor: C.surface },
  secBtnText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.muted },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyIcon:   { width: 68, height: 68, borderRadius: 34, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  emptySub:    { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  // Modals
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  modalBox:        { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 28, gap: 12 },
  modalIconWrap:   { alignItems: 'center', marginBottom: 4 },
  modalTitle:      { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.text, textAlign: 'center' },
  modalBody:       { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 20 },
  modalBtns:       { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel:     { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  modalConfirmRed: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: C.red, alignItems: 'center' },
  modalConfirmTeal:{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center' },
  modalConfirmText:{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  noteInput:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 14, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, minHeight: 100, textAlignVertical: 'top' },

  // Send modal
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  sheetCancel: { fontSize: 15, fontFamily: 'Montserrat_500Medium', color: C.muted },
  sheetTitle:  { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  sheetSave:   { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.teal },
  fieldLabel:  { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.muted, marginTop: 16, marginBottom: 6, letterSpacing: 0.8 },
  fieldInput:  { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  typeChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  typeChipActive:  { backgroundColor: C.teal, borderColor: C.teal },
  typeChipText:    { fontSize: 13, color: C.text, fontFamily: 'Montserrat_500Medium' },
  typeChipTextActive: { color: '#fff' },
  // Patient picker
  selectedPatientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.tealLight, borderRadius: 14, borderWidth: 1.5, borderColor: C.teal, padding: 12, marginBottom: 4 },
  patientPickerBox:   { borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  patPickerSearch:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  patPickerInput:     { flex: 1, fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },
  patPickerRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  patChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  patChipText: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  fileBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12, backgroundColor: C.surface },
  fileBtnText:  { fontSize: 14, color: C.text, fontFamily: 'Montserrat_500Medium' },
  fileChosen:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F5F5', borderRadius: 8, padding: 10, marginTop: 8 },
  fileChosenText:{ flex: 1, fontSize: 13, color: C.text, fontFamily: 'SpaceGrotesk_400Regular' },
});
