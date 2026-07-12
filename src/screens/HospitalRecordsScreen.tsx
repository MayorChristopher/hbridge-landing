import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView, StatusBar, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const { width: SW } = Dimensions.get('window');
const C = { bg:'#F5F3EE', surface:'#EDE9E0', card:'#FFFFFF', text:'#0C2E30', muted:'#6B7E7F', border:'#EAE5DA', teal:'#0B7E8A', tealLight:'rgba(11,126,138,0.09)', ink:'#0C2E30' };

const isImage = (url?: string) => !!url && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

const TYPE_ICONS: any = {
  lab_result:'flask-outline', imaging:'scan-outline', prescription:'medkit-outline',
  vital_signs:'pulse-outline', diagnosis:'document-text-outline', other:'document-outline',
};
const TYPE_LABELS: any = {
  lab_result:'Lab Result', imaging:'Imaging / Scan', prescription:'Prescription',
  vital_signs:'Vitals', diagnosis:'Diagnosis', other:'Other',
};
const RECORD_TYPES = Object.keys(TYPE_LABELS);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

export default function HospitalRecordsScreen({ route, navigation }: any) {
  const toast = useToast();
  const { folderId, folderName, userId, linkedId, folderType } = route.params;
  const isPersonal = folderId === 'personal';

  const [records, setRecords]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  // Upload
  const [uploadVisible, setUploadVisible]   = useState(false);
  const [uploadTitle, setUploadTitle]       = useState('');
  const [uploadDesc, setUploadDesc]         = useState('');
  const [uploadType, setUploadType]         = useState('lab_result');
  const [uploadFile, setUploadFile]         = useState<any>(null);
  const [uploading, setUploading]           = useState(false);

  // In-app viewer
  const [viewerRecord, setViewerRecord]     = useState<any>(null);

  // Action menu
  const [actionItem, setActionItem]     = useState<any>(null);

  // Share/Transfer
  const [shareRecord, setShareRecord]   = useState<any>(null);
  const [shareMode, setShareMode]       = useState<'doctor'|'hospital'|null>(null);
  const [shareTargets, setShareTargets] = useState<any[]>([]);
  const [shareSearch, setShareSearch]   = useState('');
  const [sharingId, setSharingId]       = useState<string|null>(null);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      if (isPersonal) {
        // Personal folder: records with no folder_id
        const { data } = await supabase
          .from('medical_records')
          .select('id, title, record_type, created_at, file_url, attachment_url')
          .eq('user_id', userId)
          .is('folder_id', null)
          .order('created_at', { ascending: false });
        setRecords(data || []);
      } else {
        // Hospital folder: records linked by folder_id
        const { data } = await supabase
          .from('medical_records')
          .select('id, title, record_type, created_at, file_url, attachment_url')
          .eq('user_id', userId)
          .eq('folder_id', folderId)
          .order('created_at', { ascending: false });
        setRecords(data || []);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRecords(); setRefreshing(false); };

  // ── Upload ────────────────────────────────────────────────────────────────
  const pickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type:['application/pdf','image/*'], copyToCacheDirectory:true });
    if (!r.canceled && r.assets?.[0]) setUploadFile(r.assets[0]);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast.showWarning('Permission needed', 'Allow photo access'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality:0.8 });
    if (!r.canceled && r.assets?.[0]) setUploadFile({ uri:r.assets[0].uri, name:'image.jpg', mimeType:'image/jpeg' });
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { toast.showWarning('Required', 'Please enter a title'); return; }
    setUploading(true);
    try {
      let fileUrl: string|null = null;
      if (uploadFile) {
        const ext = (uploadFile.name?.split('.').pop() || 'pdf').toLowerCase();
        const mime = uploadFile.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
        const path = `records/${userId}/${Date.now()}.${ext}`;
        // Use FormData — works on both iOS and Android
        const formData = new FormData();
        formData.append('file', { uri: uploadFile.uri, name: uploadFile.name || `file.${ext}`, type: mime } as any);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const supabaseUrl = (supabase as any).supabaseUrl as string;
        const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/medical-records/${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-upsert': 'true',
          },
          body: formData,
        });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`Upload failed: ${errText}`);
        }
        const { data: { publicUrl } } = supabase.storage.from('medical-records').getPublicUrl(path);
        fileUrl = publicUrl;
      }
      const { data: newRecord, error } = await supabase.from('medical_records').insert({
        user_id: userId,
        folder_id: isPersonal ? null : folderId,
        hospital_id: folderType === 'hospital' ? linkedId : null,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        record_type: uploadType,
        file_url: fileUrl,
        attachment_url: fileUrl,
        data: { file_name: uploadFile?.name ?? null },
        is_sensitive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id').single();
      if (error) throw error;

      // If this is a doctor folder, share the record with the doctor immediately
      if (folderType === 'doctor' && linkedId && newRecord?.id) {
        const { error: shareError } = await supabase.from('medical_record_access').insert({
          record_id: newRecord.id,
          patient_id: userId,
          doctor_id: linkedId,
          access_type: 'view',
          granted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        });
        if (shareError) throw shareError;
      }

      setUploadVisible(false); setUploadTitle(''); setUploadDesc(''); setUploadType('lab_result'); setUploadFile(null);
      await loadRecords();
      toast.showSuccess('Uploaded', folderType === 'doctor' ? 'Record saved and shared with doctor.' : 'Record saved successfully.');
    } catch(e:any) { toast.showError('Upload Error', e.message || 'Something went wrong'); }
    finally { setUploading(false); }
  };

  // ── Share / Transfer ──────────────────────────────────────────────────────
  const openShare = async (record: any, mode: 'doctor'|'hospital') => {
    setShareRecord(record); setShareMode(mode); setShareSearch(''); setShareTargets([]);
    await loadShareTargets(mode, '');
  };

  const loadShareTargets = async (mode: 'doctor'|'hospital', query: string) => {
    if (mode === 'doctor') {
      const { data } = await supabase.from('doctors').select('id, full_name, specialization')
        .eq('verification_status','verified').ilike('full_name',`%${query}%`).limit(20);
      setShareTargets(data || []);
    } else {
      const { data } = await supabase.from('hospitals').select('id, name, city, state')
        .eq('is_active',true).ilike('name',`%${query}%`).limit(20);
      setShareTargets(data || []);
    }
  };

  const handleShare = async (target: any) => {
    setSharingId(target.id);
    try {
      const { error } = await supabase.from('medical_record_access').insert({
        record_id: shareRecord.id,
        patient_id: userId,
        doctor_id: shareMode === 'doctor' ? target.id : null,
        hospital_id: shareMode === 'hospital' ? target.id : null,
        access_type: 'view',
        granted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        is_active: true,
      });
      if (error) throw error;
      setShareRecord(null); setShareMode(null);
      const label = shareMode === 'doctor' ? `Dr. ${target.full_name ?? ''}` : (target.name ?? '');
      toast.showSuccess('Shared', `Record shared with ${label}.`);
    } catch(e:any) { toast.showError('Error', e.message); }
    finally { setSharingId(null); }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteRecord = (id: string) => setDeleteConfirmId(id);

  const doDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    await supabase.from('medical_records').delete().eq('id', id);
    setRecords(prev => prev.filter(r => r.id !== id));
    toast.showSuccess('Deleted', 'Record removed.');
  };

  const filtered = search.trim()
    ? records.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
    : records;

  const openRecord = (item: any) => {
    const url = item.file_url || item.attachment_url;
    if (!url) return;
    setViewerRecord(item);
  };

  const renderRecord = ({ item }: any) => {
    const fileUrl = item.file_url || item.attachment_url;
    const hasImage = isImage(fileUrl);
    return (
      <View style={s.card}>
        {/* Image preview thumbnail */}
        {hasImage && (
          <TouchableOpacity onPress={() => openRecord(item)} activeOpacity={0.85}>
            <Image source={{ uri: fileUrl }} style={s.cardPreview} resizeMode="cover" />
          </TouchableOpacity>
        )}
        <View style={s.cardTop}>
          {!hasImage && (
            <View style={s.cardIcon}>
              <Ionicons name={(TYPE_ICONS[item.record_type] || 'document-outline') as any} size={20} color={C.teal} />
            </View>
          )}
          <View style={{ flex:1 }}>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={s.cardMeta}>{TYPE_LABELS[item.record_type] || item.record_type} · {formatDate(item.created_at)}</Text>
            {!!item.description && <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>}
          </View>
          <TouchableOpacity onPress={() => setActionItem(item)}>
            <Ionicons name="ellipsis-vertical" size={18} color={C.muted} />
          </TouchableOpacity>
        </View>
        <View style={s.cardActions}>
          <TouchableOpacity style={s.actionBtn} onPress={()=>openShare(item,'doctor')}>
            <Ionicons name="person-outline" size={13} color={C.text} />
            <Text style={s.actionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={()=>openShare(item,'hospital')}>
            <Ionicons name="business-outline" size={13} color={C.text} />
            <Text style={s.actionBtnText}>Transfer</Text>
          </TouchableOpacity>
          {!!fileUrl && (
            <TouchableOpacity style={[s.actionBtn, s.actionBtnTEAL]} onPress={() => openRecord(item)}>
              <Ionicons name="eye-outline" size={13} color={C.teal} />
              <Text style={[s.actionBtnText,{color:C.teal}]}>View</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const sharePlaceholder = shareMode === 'doctor' ? 'Search doctors...' : 'Search hospitals...';
  const shareTitle = shareMode === 'doctor' ? 'Share with Doctor' : shareMode === 'hospital' ? 'Transfer to Hospital' : '';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={()=>navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{folderName}</Text>
          <Text style={s.headerSub}>
            {isPersonal ? 'Personal folder' : folderType === 'doctor' ? 'Doctor folder' : 'Hospital folder'}
          </Text>
        </View>
        <TouchableOpacity onPress={()=>{setSearchVisible(v=>!v);setSearch('');}}>
          <Ionicons name="search" size={20} color={searchVisible ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)'} />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={()=>setUploadVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* White Card */}
      <View style={s.whiteCard}>
      {searchVisible && (
        <View style={s.searchBar}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search records..." placeholderTextColor={C.muted} autoFocus />
        </View>
      )}

      {loading ? <ActivityIndicator color={C.teal} style={{flex:1}} /> : (
        <FlatList
          data={filtered} keyExtractor={r=>r.id} renderItem={renderRecord}
          contentContainerStyle={{padding:16, paddingBottom:40}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-outline" size={48} color={C.muted} />
              <Text style={s.emptyTitle}>No Records</Text>
              <Text style={s.emptySub}>Tap + to add a record to this folder</Text>
            </View>
          }
        />
      )}

      {/* Upload Modal */}
      <Modal visible={uploadVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalContainer} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={()=>{setUploadVisible(false);setUploadFile(null);setUploadTitle('');setUploadDesc('');}}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add Record</Text>
            <TouchableOpacity onPress={handleUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={s.modalSave}>Upload</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody}>
            <Text style={s.fieldLabel}>RECORD TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:4}}>
              {RECORD_TYPES.map(t=>(
                <TouchableOpacity key={t} style={[s.typeChip, uploadType===t&&s.typeChipActive]} onPress={()=>setUploadType(t)}>
                  <Text style={[s.typeChipText, uploadType===t&&s.typeChipTextActive]}>{TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.fieldLabel}>TITLE *</Text>
            <TextInput style={s.fieldInput} value={uploadTitle} onChangeText={setUploadTitle}
              placeholder="e.g. Blood Test Results" placeholderTextColor={C.muted} />
            <Text style={s.fieldLabel}>DESCRIPTION / NOTES</Text>
            <TextInput style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
              value={uploadDesc} onChangeText={setUploadDesc} multiline
              placeholder={folderType === 'doctor'
                ? "e.g. Results from clinic visit on Monday, referred by Dr. Okonkwo..."
                : "e.g. Personal copy of lab results from General Hospital..."}
              placeholderTextColor={C.muted} />
            <Text style={s.fieldLabel}>ATTACH FILE (PDF / IMAGE)</Text>
            <View style={s.fileRow}>
              <TouchableOpacity style={s.fileBtn} onPress={pickFile}>
                <Ionicons name="document-outline" size={18} color={C.teal} />
                <Text style={s.fileBtnText}>Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.fileBtn} onPress={pickImage}>
                <Ionicons name="image-outline" size={18} color={C.teal} />
                <Text style={s.fileBtnText}>Image</Text>
              </TouchableOpacity>
            </View>
            {!!uploadFile && (
              <View style={s.fileChosen}>
                <Ionicons name="checkmark-circle" size={16} color={C.teal} />
                <Text style={s.fileChosenText} numberOfLines={1}>{uploadFile.name ?? 'Selected'}</Text>
                <TouchableOpacity onPress={()=>setUploadFile(null)}>
                  <Ionicons name="close-circle" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      </View>

      {/* Share / Transfer Modal */}
      <Modal visible={!!shareRecord && !!shareMode} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalContainer} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={()=>{setShareRecord(null);setShareMode(null);}}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{shareTitle}</Text>
            <View style={{width:50}} />
          </View>
          <View style={s.searchBar}>
            <Ionicons name="search" size={15} color={C.muted} />
            <TextInput style={s.searchInput} value={shareSearch}
              onChangeText={t=>{setShareSearch(t);if(shareMode)loadShareTargets(shareMode,t);}}
              placeholder={sharePlaceholder} placeholderTextColor={C.muted} autoFocus />
          </View>
          <FlatList
            data={shareTargets} keyExtractor={t=>t.id}
            contentContainerStyle={{padding:16, paddingBottom:40}}
            renderItem={({item})=>(
              <TouchableOpacity style={s.shareTarget} onPress={()=>handleShare(item)} disabled={sharingId !== null}>
                <View style={s.shareTargetIcon}>
                  <Ionicons name={shareMode==='doctor'?'person':'business'} size={20} color={C.teal} />
                </View>
                <View style={{flex:1}}>
                  <Text style={s.shareTargetName}>
                    {shareMode==='doctor' ? `Dr. ${item.full_name ?? ''}` : (item.name ?? '')}
                  </Text>
                  <Text style={s.shareTargetSub}>
                    {shareMode==='doctor' ? (item.specialization ?? '') : `${item.city ?? ''}, ${item.state ?? ''}`}
                  </Text>
                </View>
                {sharingId === item.id
                  ? <ActivityIndicator size="small" color={C.teal} />
                  : <Ionicons name="chevron-forward" size={18} color={C.muted} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{alignItems:'center',paddingTop:40}}>
                <Text style={{color:C.muted}}>No results found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Action Sheet */}
      <Modal visible={!!actionItem} animationType="slide" transparent onRequestClose={() => setActionItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 16 }} numberOfLines={1}>{actionItem?.title}</Text>
            {[
              { icon: 'person-outline', label: 'Share with Doctor', onPress: () => { setActionItem(null); openShare(actionItem, 'doctor'); } },
              { icon: 'business-outline', label: 'Transfer to Hospital', onPress: () => { setActionItem(null); openShare(actionItem, 'hospital'); } },
              ...(actionItem?.file_url ? [{ icon: 'open-outline', label: 'Open File', onPress: () => { setActionItem(null); Linking.openURL(actionItem.file_url); } }] : []),
            ].map(a => (
              <TouchableOpacity key={a.label} onPress={a.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EAE5DA' }}>
                <Ionicons name={a.icon as any} size={20} color="#0B7E8A" />
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#0C2E30' }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => { const item = actionItem; setActionItem(null); deleteRecord(item.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EAE5DA' }}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#EF4444' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActionItem(null)} style={{ marginTop: 8, padding: 14, borderRadius: 13, backgroundColor: '#EDE9E0', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Sheet */}
      <Modal visible={!!deleteConfirmId} animationType="slide" transparent onRequestClose={() => setDeleteConfirmId(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 6 }}>Delete Record?</Text>
            <Text style={{ fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginBottom: 24, lineHeight: 20 }}>This cannot be undone.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EDE9E0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doDelete} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EF4444', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* In-app record viewer */}
      <Modal visible={!!viewerRecord} animationType="slide" onRequestClose={() => setViewerRecord(null)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#000' }} edges={['top']}>
          {/* Viewer header */}
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, backgroundColor:'#083236', gap:12 }}>
            <TouchableOpacity onPress={() => setViewerRecord(null)}
              style={{ width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={{ color:'#fff', fontSize:15, fontFamily:'Montserrat_600SemiBold' }} numberOfLines={1}>{viewerRecord?.title}</Text>
              <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>{viewerRecord ? TYPE_LABELS[viewerRecord.record_type] : ''} · {viewerRecord ? formatDate(viewerRecord.created_at) : ''}</Text>
            </View>
          </View>

          {viewerRecord && (() => {
            const url = viewerRecord.file_url || viewerRecord.attachment_url;
            if (!url) return (
              <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="document-outline" size={64} color="#555" />
                <Text style={{ color:'#888', marginTop:12 }}>No file attached</Text>
              </View>
            );
            if (isImage(url)) return (
              <Image source={{ uri: url }} style={{ flex:1 }} resizeMode="contain" />
            );
            // PDF and all other types — render via WebView using Google Docs viewer
            const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
            return (
              <WebView
                source={{ uri: viewerUrl }}
                style={{ flex:1, backgroundColor:'#f5f5f5' }}
                startInLoadingState
                renderLoading={() => (
                  <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', backgroundColor:'#f5f5f5' }}>
                    <ActivityIndicator size="large" color="#0B7E8A" />
                    <Text style={{ marginTop:12, color:'#7A8785', fontFamily:'SpaceGrotesk_400Regular' }}>Loading document...</Text>
                  </View>
                )}
              />
            );
          })()}

          {/* Description bar at bottom if available */}
          {!!viewerRecord?.description && (
            <View style={{ backgroundColor:'#083236', paddingHorizontal:20, paddingVertical:12 }}>
              <Text style={{ color:'rgba(255,255,255,0.8)', fontSize:13, fontFamily:'SpaceGrotesk_400Regular', lineHeight:20 }}>{viewerRecord.description}</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#083236'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:12,paddingBottom:20,gap:14},
  backBtn:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  headerIconCircle:{width:56,height:56,borderRadius:28,backgroundColor:'rgba(255,255,255,0.2)',borderWidth:1,borderColor:'rgba(255,255,255,0.4)',alignItems:'center',justifyContent:'center'},
  headerCenter:{flex:1},
  headerTitle:{fontSize:22,fontFamily:'Montserrat_700Bold',color:'#fff',letterSpacing:-0.3},
  headerSub:{fontSize:12,fontFamily:'SpaceGrotesk_400Regular',color:'rgba(255,255,255,0.7)',marginTop:2},
  whiteCard:{flex:1,backgroundColor:'#F5F3EE',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'},
  addBtn:{width:34,height:34,borderRadius:10,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  searchBar:{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginVertical:8,backgroundColor:C.surface,borderRadius:10,paddingHorizontal:12,paddingVertical:10},
  searchInput:{flex:1,fontSize:14,color:C.text,paddingVertical:0},
  card:{backgroundColor:C.bg,borderRadius:14,borderWidth:1,borderColor:C.border,padding:14,marginBottom:12},
  cardTop:{flexDirection:'row',alignItems:'flex-start',gap:12},
  cardIcon:{width:40,height:40,borderRadius:10,backgroundColor:'#E6F5F5',alignItems:'center',justifyContent:'center'},
  cardPreview:{ width:'100%', height:180, borderRadius:10, marginBottom:10, backgroundColor:C.surface },
  cardTitle:{fontSize:15,fontWeight:'700',color:C.text},
  cardMeta:{fontSize:12,color:C.muted,marginTop:2},
  cardDesc:{fontSize:12,color:C.muted,marginTop:4,lineHeight:17},
  cardDoctor:{fontSize:11,color:C.teal,marginTop:2},
  cardActions:{flexDirection:'row',gap:8,marginTop:10},
  actionBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,borderWidth:1,borderColor:C.border,borderRadius:8,paddingVertical:7},
  actionBtnTEAL:{borderColor:C.teal+'50',backgroundColor:'#E6F5F5'},
  actionBtnText:{fontSize:12,fontWeight:'500',color:C.text},
  empty:{alignItems:'center',paddingVertical:60,gap:10},
  emptyTitle:{fontSize:16,fontWeight:'700',color:C.text},
  emptySub:{fontSize:13,color:C.muted,textAlign:'center'},
  modalContainer:{flex:1,backgroundColor:C.bg},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.border},
  modalTitle:{fontSize:17,fontWeight:'700',color:C.text},
  modalCancel:{fontSize:15,color:C.muted},
  modalSave:{fontSize:15,fontWeight:'700',color:C.teal},
  modalBody:{padding:20,paddingBottom:60},
  fieldLabel:{fontSize:11,fontWeight:'700',color:C.muted,marginTop:16,marginBottom:6,letterSpacing:0.8},
  fieldInput:{backgroundColor:C.surface,borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:C.text,borderWidth:1,borderColor:C.border},
  typeChip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:C.border,backgroundColor:C.bg,marginRight:8},
  typeChipActive:{backgroundColor:C.teal,borderColor:C.teal},
  typeChipText:{fontSize:13,color:C.text,fontWeight:'500'},
  typeChipTextActive:{color:'#fff'},
  fileRow:{flexDirection:'row',gap:10,marginTop:4},
  fileBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:C.border,borderRadius:10,paddingVertical:12,backgroundColor:C.surface},
  fileBtnText:{fontSize:14,color:C.text,fontWeight:'500'},
  fileChosen:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#E6F5F5',borderRadius:8,padding:10,marginTop:8},
  fileChosenText:{flex:1,fontSize:13,color:C.text},
  shareTarget:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:C.surface,borderRadius:12,padding:14,marginBottom:8},
  shareTargetIcon:{width:40,height:40,borderRadius:10,backgroundColor:'#E6F5F5',alignItems:'center',justifyContent:'center'},
  shareTargetName:{fontSize:15,fontWeight:'600',color:C.text},
  shareTargetSub:{fontSize:12,color:C.muted,marginTop:2},
});
