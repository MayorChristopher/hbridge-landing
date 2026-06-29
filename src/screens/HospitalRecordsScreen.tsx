import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView, Linking, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const C = { bg:'#FFFFFF', surface:'#F5F5F5', text:'#171717', muted:'#737373', border:'#E5E5E5', teal:'#0B7E8A' };

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
  const { folderId, folderName, userId, linkedId, folderType } = route.params;
  const isPersonal = folderId === 'personal';

  const [records, setRecords]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  // Upload
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadTitle, setUploadTitle]     = useState('');
  const [uploadType, setUploadType]       = useState('lab_result');
  const [uploadFile, setUploadFile]       = useState<any>(null);
  const [uploading, setUploading]         = useState(false);

  // Share/Transfer
  const [shareRecord, setShareRecord]   = useState<any>(null);
  const [shareMode, setShareMode]       = useState<'doctor'|'hospital'|null>(null);
  const [shareTargets, setShareTargets] = useState<any[]>([]);
  const [shareSearch, setShareSearch]   = useState('');
  const [sharing, setSharing]           = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('medical_records')
        .select('id, title, record_type, created_at, file_url, attachment_url, doctor_id, hospital_id, folder_id, doctors(full_name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (isPersonal) q = q.is('folder_id', null);
      else q = q.eq('folder_id', folderId);
      const { data } = await q;
      setRecords(data || []);
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
    if (status !== 'granted') { Alert.alert('Permission needed','Allow photo access'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality:0.8 });
    if (!r.canceled && r.assets?.[0]) setUploadFile({ uri:r.assets[0].uri, name:'image.jpg', mimeType:'image/jpeg' });
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { Alert.alert('Required','Please enter a title'); return; }
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
      const { error } = await supabase.from('medical_records').insert({
        user_id: userId,
        folder_id: isPersonal ? null : folderId,
        hospital_id: folderType === 'hospital' ? linkedId : null,
        title: uploadTitle.trim(),
        record_type: uploadType,
        file_url: fileUrl,
        attachment_url: fileUrl,
        data: { file_name: uploadFile?.name ?? null },
        is_sensitive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setUploadVisible(false); setUploadTitle(''); setUploadType('lab_result'); setUploadFile(null);
      await loadRecords();
      Alert.alert('Uploaded', 'Record saved successfully');
    } catch(e:any) { Alert.alert('Upload Error', e.message || 'Something went wrong'); }
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
    setSharing(true);
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
      Alert.alert('Shared', `Record shared with ${label}`);
    } catch(e:any) { Alert.alert('Error', e.message); }
    finally { setSharing(false); }
  };

  const deleteRecord = (id: string) => {
    Alert.alert('Delete Record','This cannot be undone.',[
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await supabase.from('medical_records').delete().eq('id', id);
        setRecords(prev => prev.filter(r => r.id !== id));
      }},
    ]);
  };

  const filtered = search.trim()
    ? records.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
    : records;

  const renderRecord = ({ item }: any) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardIcon}>
          <Ionicons name={(TYPE_ICONS[item.record_type] || 'document-outline') as any} size={20} color={C.teal} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={s.cardMeta}>{TYPE_LABELS[item.record_type] || item.record_type} · {formatDate(item.created_at)}</Text>
          {!!item.doctors?.full_name && <Text style={s.cardDoctor}>Dr. {item.doctors.full_name}</Text>}
        </View>
        <TouchableOpacity onPress={() => Alert.alert(item.title, 'Choose action', [
          { text:'Share with Doctor', onPress:()=>openShare(item,'doctor') },
          { text:'Transfer to Hospital', onPress:()=>openShare(item,'hospital') },
          ...(item.file_url ? [{ text:'Open File', onPress:()=>Linking.openURL(item.file_url) }] : []),
          { text:'Delete', style:'destructive', onPress:()=>deleteRecord(item.id) },
          { text:'Cancel', style:'cancel' },
        ] as any)}>
          <Ionicons name="ellipsis-vertical" size={18} color={C.muted} />
        </TouchableOpacity>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity style={s.actionBtn} onPress={()=>openShare(item,'doctor')}>
          <Ionicons name="person-outline" size={13} color={C.text} />
          <Text style={s.actionBtnText}>Share to Doctor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={()=>openShare(item,'hospital')}>
          <Ionicons name="business-outline" size={13} color={C.text} />
          <Text style={s.actionBtnText}>Transfer</Text>
        </TouchableOpacity>
        {!!item.file_url && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnTEAL]} onPress={()=>Linking.openURL(item.file_url)}>
            <Ionicons name="eye-outline" size={13} color={C.teal} />
            <Text style={[s.actionBtnText,{color:C.teal}]}>View</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const sharePlaceholder = shareMode === 'doctor' ? 'Search doctors...' : 'Search hospitals...';
  const shareTitle = shareMode === 'doctor' ? 'Share with Doctor' : shareMode === 'hospital' ? 'Transfer to Hospital' : '';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={()=>navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerIconCircle}>
          <Ionicons name="document-text" size={26} color="#fff" />
        </View>
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
            <TouchableOpacity onPress={()=>{setUploadVisible(false);setUploadFile(null);}}>
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
              <TouchableOpacity style={s.shareTarget} onPress={()=>handleShare(item)} disabled={sharing}>
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
                {sharing
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0B7E8A'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:12,paddingBottom:20,gap:14},
  backBtn:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  headerIconCircle:{width:56,height:56,borderRadius:28,backgroundColor:'rgba(255,255,255,0.2)',borderWidth:1,borderColor:'rgba(255,255,255,0.4)',alignItems:'center',justifyContent:'center'},
  headerCenter:{flex:1},
  headerTitle:{fontSize:26,fontWeight:'700',color:'#fff',letterSpacing:-0.3},
  headerSub:{fontSize:14,color:'rgba(255,255,255,0.75)',marginTop:2},
  whiteCard:{flex:1,backgroundColor:'#ffffff',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'},
  addBtn:{width:34,height:34,borderRadius:10,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  searchBar:{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginVertical:8,backgroundColor:C.surface,borderRadius:10,paddingHorizontal:12,paddingVertical:10},
  searchInput:{flex:1,fontSize:14,color:C.text,paddingVertical:0},
  card:{backgroundColor:C.bg,borderRadius:14,borderWidth:1,borderColor:C.border,padding:14,marginBottom:12},
  cardTop:{flexDirection:'row',alignItems:'flex-start',gap:12},
  cardIcon:{width:40,height:40,borderRadius:10,backgroundColor:'#E6F5F5',alignItems:'center',justifyContent:'center'},
  cardTitle:{fontSize:15,fontWeight:'700',color:C.text},
  cardMeta:{fontSize:12,color:C.muted,marginTop:2},
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
