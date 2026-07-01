import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg:'#FFFFFF', surface:'#F5F5F5', text:'#171717', muted:'#737373', border:'#E5E5E5', teal:'#0B7E8A' };

// ── PIN screen ─────────────────────────────────────────────────────────────
function PinScreen({ setup, pinStep, currentVal, pinError, onNumpad, onBack, onForgot, showBack = false }: {
  setup:boolean; pinStep:'enter'|'confirm'; currentVal:string;
  pinError:string; onNumpad:(k:string)=>void; onBack:()=>void; onForgot?:()=>void; showBack?:boolean;
}) {
  const title = setup ? (pinStep==='confirm' ? 'Confirm your PIN' : 'Create a PIN') : 'Enter your PIN';
  const sub = setup
    ? (pinStep==='confirm' ? 'Re-enter your 4-digit PIN to confirm' : 'Choose a 4-digit PIN to secure your records')
    : 'Enter your 4-digit PIN to access your medical records';
  const rows = [['1','2','3'],['4','5','6'],['7','8','9'],['del','0','ok']];
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        {showBack ? (
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
        <Text style={s.headerTitle}>Medical Records</Text>
        <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.7)" />
      </View>
      <View style={s.pinScreen}>
        <View style={s.pinCard}>
          <View style={s.pinIconBox}>
            <Ionicons name={setup ? 'shield-checkmark' : 'lock-closed'} size={28} color={C.teal} />
          </View>
          <Text style={s.pinTitle}>{title}</Text>
          <Text style={s.pinSub}>{sub}</Text>
          <View style={s.dotsRow}>
            {[0,1,2,3].map(i=>(
              <View key={i} style={[s.dot, i < currentVal.length ? s.dotFilled : s.dotEmpty]} />
            ))}
          </View>
          {/* Fixed-height container prevents layout shift when error appears/disappears */}
          <View style={{ minHeight: 22, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[s.pinError, { opacity: pinError ? 1 : 0 }]}>{pinError || ' '}</Text>
          </View>
        </View>
        <View style={s.numpad}>
          {rows.map((row,ri)=>(
            <View key={ri} style={s.numRow}>
              {row.map(k=>(
                <TouchableOpacity key={k} activeOpacity={0.7}
                  style={[s.numKey,(k==='del'||k==='ok')?s.numKeyAction:null,k==='ok'&&currentVal.length===4?s.numKeyOk:null]}
                  onPress={()=>onNumpad(k)}>
                  {k==='del' ? <Ionicons name="backspace-outline" size={22} color={C.text} />
                   : k==='ok' ? <Ionicons name="arrow-forward" size={22} color={currentVal.length===4?'#fff':C.muted} />
                   : <Text style={s.numKeyText}>{k}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
        {!setup && onForgot && (
          <TouchableOpacity onPress={onForgot}>
            <Text style={s.forgotPin}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function MedicalRecordsScreen({ navigation }: any) {
  const [isLocked, setIsLocked]         = useState(true);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [userPin, setUserPin]           = useState<string|null>(null);
  const [pin, setPin]                   = useState('');
  const [confirmPin, setConfirmPin]     = useState('');
  const [pinStep, setPinStep]           = useState<'enter'|'confirm'>('enter');
  const [pinError, setPinError]         = useState('');
  const [userId, setUserId]             = useState<string|null>(null);
  const [userType, setUserType]         = useState<string>('patient');

  const [folders, setFolders]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create folder modal
  const [createVisible, setCreateVisible] = useState(false);
  const [folderType, setFolderType]       = useState<'hospital'|'doctor'>('hospital');
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching]         = useState(false);

  // Rename modal
  const [renameFolder, setRenameFolder]   = useState<any>(null);
  const [renameValue, setRenameValue]     = useState('');
  // Folder options bottom sheet
  const [optionsFolder, setOptionsFolder] = useState<any>(null);
  // Filter
  const [filter, setFilter] = useState<'all'|'hospital'|'doctor'>('all');

  useEffect(() => { checkPin(); }, []);

  // ── PIN ──────────────────────────────────────────────────────────────────
  const checkPin = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('medical_pin, user_type').eq('id', user.id).single();
      setUserType(data?.user_type || 'patient');
      if (data?.medical_pin) setUserPin(data.medical_pin);
      else setIsSettingPin(true);
    } catch { setIsSettingPin(true); }
  };

  const handleSetPin = async () => {
    if (pin.length !== 4) return;
    if (pinStep === 'enter') { setPinStep('confirm'); setConfirmPin(''); setPinError(''); return; }
    if (confirmPin !== pin) { setPinError('PINs do not match. Try again.'); setConfirmPin(''); return; }
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ medical_pin: pin }).eq('id', user.id);
      setUserPin(pin); setIsSettingPin(false); setIsLocked(false);
      setPin(''); setConfirmPin(''); setPinStep('enter');
      loadFolders(user.id);
    } catch (e:any) { Alert.alert('Error', e.message); }
  };

  const handleUnlock = () => {
    if (pin.length !== 4) return;
    // String coercion guards against numeric type returned from DB
    if (pin.trim() === String(userPin ?? '').trim()) {
      setIsLocked(false); setPin(''); setPinError(''); if (userId) loadFolders(userId);
    } else { setPinError('Incorrect PIN. Try again.'); setPin(''); }
  };

  const activePin    = isSettingPin ? (pinStep==='confirm' ? confirmPin : pin) : pin;
  const setActivePin = (val:string) => { if (isSettingPin) { pinStep==='confirm' ? setConfirmPin(val) : setPin(val); } else setPin(val); };

  const handleNumpad = (digit:string) => {
    setPinError('');
    if (digit==='del') { setActivePin(activePin.slice(0,-1)); return; }
    if (digit==='ok') { isSettingPin ? handleSetPin() : handleUnlock(); return; }
    if (activePin.length < 4) setActivePin(activePin + digit);
  };

  const resetPin = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ medical_pin: null }).eq('id', user.id);
      setUserPin(null); setIsSettingPin(true); setIsLocked(true);
    } catch {}
  };

  // ── Folders ──────────────────────────────────────────────────────────────
  const loadFolders = async (uid:string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('record_folders')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false });
      setFolders(data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { if (!userId) return; setRefreshing(true); await loadFolders(userId); setRefreshing(false); };

  // ── Search for hospital/doctor to create folder ──────────────────────────
  const runSearch = async (q:string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      if (folderType === 'hospital') {
        const { data } = await supabase.from('hospitals').select('id, name, city, state').ilike('name', `%${q}%`).limit(15);
        setSearchResults((data||[]).map((h:any) => ({ id:h.id, name:h.name, sub:`${h.city??''}, ${h.state??''}`, type:'hospital' })));
      } else {
        const { data } = await supabase.from('doctors').select('id, full_name, specialization').eq('verification_status','verified').ilike('full_name', `%${q}%`).limit(15);
        setSearchResults((data||[]).map((d:any) => ({ id:d.id, name:`Dr. ${d.full_name}`, sub:d.specialization??'', type:'doctor' })));
      }
    } finally { setSearching(false); }
  };

  const createFolder = async (target:any) => {
    if (!userId) return;
    try {
      // Check for duplicate
      const { data:existing } = await supabase.from('record_folders')
        .select('id').eq('owner_id', userId).eq('linked_id', target.id).maybeSingle();
      if (existing) { Alert.alert('Folder exists', 'A folder for this entity already exists.'); return; }

      await supabase.from('record_folders').insert({
        owner_id: userId,
        folder_name: target.name,
        folder_type: target.type,  // 'hospital' | 'doctor' | 'personal'
        linked_id: target.id,
      });
      setCreateVisible(false); setSearchQuery(''); setSearchResults([]);
      loadFolders(userId);
    } catch(e:any) { Alert.alert('Error', e.message); }
  };

  const renameFolder_ = async () => {
    if (!renameValue.trim() || !renameFolder) return;
    try {
      await supabase.from('record_folders').update({ folder_name: renameValue.trim() }).eq('id', renameFolder.id);
      setRenameFolder(null); setRenameValue('');
      if (userId) loadFolders(userId);
    } catch(e:any) { Alert.alert('Error', e.message); }
  };

  const deleteFolder = (folder:any) => {
    Alert.alert('Delete Folder', `Delete "${folder.folder_name}"? Records inside won't be deleted.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await supabase.from('record_folders').delete().eq('id', folder.id);
        if (userId) loadFolders(userId);
      }},
    ]);
  };

  // ── PIN gates ─────────────────────────────────────────────────────────────
  if (isSettingPin) return (
    <PinScreen setup pinStep={pinStep} currentVal={pinStep==='confirm'?confirmPin:pin}
      pinError={pinError} onNumpad={handleNumpad}
      showBack={pinStep==='confirm'}
      onBack={()=>{ if (pinStep==='confirm'){setPinStep('enter');setConfirmPin('');setPinError('');}else navigation.goBack();}} />
  );
  if (isLocked) return (
    <PinScreen setup={false} pinStep="enter" currentVal={pin}
      pinError={pinError} onNumpad={handleNumpad}
      showBack={false} onForgot={resetPin}
      onBack={()=>navigation.goBack()} />
  );

  const folderIcon = (type:string) => {
    if (type==='hospital') return <MaterialCommunityIcons name="hospital-building" size={24} color={C.teal} />;
    if (type==='doctor')   return <Ionicons name="person" size={24} color="#6366f1" />;
    return <Ionicons name="folder" size={24} color="#f59e0b" />;
  };
  const folderIconBg = (type:string) => type==='hospital' ? '#E6F5F5' : type==='doctor' ? '#ede9fe' : '#fef3c7';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Rename modal */}
      <Modal visible={!!renameFolder} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.renameModal}>
            <Text style={s.renameTitle}>Rename Folder</Text>
            <TextInput style={s.renameInput} value={renameValue} onChangeText={setRenameValue}
              placeholder="Folder name" placeholderTextColor={C.muted} autoFocus />
            <View style={s.renameBtns}>
              <TouchableOpacity style={s.renameCancel} onPress={()=>setRenameFolder(null)}>
                <Text style={s.renameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.renameSave} onPress={renameFolder_}>
                <Text style={s.renameSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create folder modal */}
      <Modal visible={createVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalContainer} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={()=>{setCreateVisible(false);setSearchQuery('');setSearchResults([]);}}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Create Folder</Text>
            <View style={{width:50}} />
          </View>

          {/* Folder type tabs */}
          <View style={s.tabRow}>
            {(['hospital','doctor'] as const).map(t=>(
              <TouchableOpacity key={t} style={[s.tab, folderType===t&&s.tabActive]} onPress={()=>{setFolderType(t);setSearchQuery('');setSearchResults([]);}}>
                <Text style={[s.tabText, folderType===t&&s.tabTextActive]}>
                  {t==='hospital' ? 'Hospital' : 'Doctor'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Ionicons name="search" size={15} color={C.muted} />
            <TextInput style={s.searchInput} value={searchQuery}
              onChangeText={q=>{setSearchQuery(q);runSearch(q);}}
              placeholder={folderType==='hospital' ? 'Search hospitals...' : 'Search doctors...'}
              placeholderTextColor={C.muted} autoFocus />
            {searching && <ActivityIndicator size="small" color={C.teal} />}
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={i=>i.id}
            contentContainerStyle={{ padding:16, paddingBottom:40 }}
            ListEmptyComponent={
              <View style={s.emptySearch}>
                <Text style={s.emptySearchText}>
                  {searchQuery.trim() ? 'No results found' : `Type to search ${folderType}s`}
                </Text>
              </View>
            }
            renderItem={({item})=>(
              <TouchableOpacity style={s.resultRow} onPress={()=>createFolder(item)}>
                <View style={[s.resultIcon, {backgroundColor: item.type==='hospital'?'#E6F5F5':'#ede9fe'}]}>
                  {item.type==='hospital'
                    ? <MaterialCommunityIcons name="hospital-building" size={20} color={C.teal} />
                    : <Ionicons name="person" size={20} color="#6366f1" />}
                </View>
                <View style={{flex:1}}>
                  <Text style={s.resultName}>{item.name}</Text>
                  <Text style={s.resultSub}>{item.sub}</Text>
                </View>
                <Ionicons name="folder-open-outline" size={18} color={C.muted} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={()=>navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerIconWrap}>
          <Ionicons name="document-text" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Medical Records</Text>
          <Text style={s.headerSubtitle}>Secure & encrypted</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={()=>setCreateVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* White card */}
      <View style={s.card}>

      {/* Folder options bottom sheet */}
      <Modal visible={!!optionsFolder} transparent animationType="slide">
        <TouchableOpacity style={s.optionsOverlay} activeOpacity={1} onPress={()=>setOptionsFolder(null)}>
          <View style={s.optionsSheet}>
            <View style={s.optionsHandle} />
            <Text style={s.optionsTitle} numberOfLines={1}>{optionsFolder?.folder_name ?? ''}</Text>
            <View style={s.optionsDivider} />
            <TouchableOpacity style={s.optionRow} onPress={()=>{
              setRenameFolder(optionsFolder);
              setRenameValue(optionsFolder?.folder_name ?? '');
              setOptionsFolder(null);
            }}>
              <View style={s.optionIconBox}><Ionicons name="pencil-outline" size={18} color={C.teal} /></View>
              <Text style={s.optionText}>Rename Folder</Text>
            </TouchableOpacity>
            <View style={s.optionsDivider} />
            <TouchableOpacity style={s.optionRow} onPress={()=>{ deleteFolder(optionsFolder); setOptionsFolder(null); }}>
              <View style={[s.optionIconBox,{backgroundColor:'#fee2e2'}]}><Ionicons name="trash-outline" size={18} color="#EF4444" /></View>
              <Text style={[s.optionText,{color:'#EF4444'}]}>Delete Folder</Text>
            </TouchableOpacity>
            <View style={s.optionsDivider} />
            <TouchableOpacity style={[s.optionRow,{justifyContent:'center'}]} onPress={()=>setOptionsFolder(null)}>
              <Text style={[s.optionText,{color:C.muted,fontWeight:'400'}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={s.secBanner}>
        <Ionicons name="shield-checkmark" size={13} color={C.teal} />
        <Text style={s.secText}>AES-256 Encrypted · PIN Protected</Text>
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {(['all','hospital','doctor'] as const).map(f=>(
          <TouchableOpacity key={f} style={[s.filterChip, filter===f&&s.filterChipActive]} onPress={()=>setFilter(f)}>
            <Text style={[s.filterChipText, filter===f&&s.filterChipTextActive]}>
              {f==='all'?'All Folders':f==='hospital'?'Hospitals':'Doctors'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={C.teal} style={{flex:1}} /> : (
        <FlatList
          data={filter==='all' ? folders : folders.filter(f=>f.folder_type===filter)}
          keyExtractor={f=>f.id}
          contentContainerStyle={{padding:16, paddingBottom:40}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          ListHeaderComponent={
            /* Personal folder always first */
            <TouchableOpacity style={[s.folderCard,{marginBottom:10}]}
              onPress={()=>navigation.navigate('HospitalRecords',{folderId:'personal',folderName:'Personal Records',userId,linkedId:null})}>
              <View style={[s.folderIcon,{backgroundColor:'#fef3c7'}]}>
                <Ionicons name="folder" size={24} color="#f59e0b" />
              </View>
              <View style={{flex:1}}>
                <Text style={s.folderName}>Personal Records</Text>
                <Text style={s.folderSub}>Self-uploaded records</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <MaterialCommunityIcons name="folder-open-outline" size={48} color={C.muted} />
              <Text style={s.emptyTitle}>No Folders Yet</Text>
              <Text style={s.emptySub}>Tap + to create a folder for a hospital or doctor</Text>
            </View>
          }
          renderItem={({item})=>(
            <TouchableOpacity style={s.folderCard}
              onPress={()=>navigation.navigate('HospitalRecords',{folderId:item.id,folderName:item.folder_name,userId,linkedId:item.linked_id,folderType:item.folder_type})}>
              <View style={[s.folderIcon,{backgroundColor:folderIconBg(item.folder_type)}]}>
                {folderIcon(item.folder_type)}
              </View>
              <View style={{flex:1}}>
                <Text style={s.folderName} numberOfLines={1}>{item.folder_name}</Text>
                <Text style={s.folderSub}>{item.folder_type==='hospital'?'Hospital folder':item.folder_type==='doctor'?'Doctor folder':'Personal'}</Text>
              </View>
              <TouchableOpacity style={{padding:4}} onPress={()=>setOptionsFolder(item)}>
                <Ionicons name="ellipsis-vertical" size={18} color={C.muted} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        />
      )}
      </View>{/* end card */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0B7E8A'},
  header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingTop:12,paddingBottom:28},
  backBtn:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  headerIconWrap:{width:52,height:52,borderRadius:26,backgroundColor:'rgba(255,255,255,0.2)',borderWidth:2,borderColor:'rgba(255,255,255,0.4)',alignItems:'center',justifyContent:'center'},
  headerTitles:{flex:1},
  headerTitle:{fontSize:22,fontWeight:'700',color:'#ffffff',letterSpacing:-0.3},
  headerSubtitle:{fontSize:13,color:'rgba(255,255,255,0.75)',marginTop:1},
  card:{flex:1,backgroundColor:C.bg,borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'},
  addBtn:{width:34,height:34,borderRadius:17,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  secBanner:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#E6F5F5',paddingHorizontal:16,paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.border},
  secText:{fontSize:12,color:C.teal,fontWeight:'500'},
  folderCard:{flexDirection:'row',alignItems:'center',backgroundColor:C.bg,borderRadius:14,borderWidth:1,borderColor:C.border,padding:16,marginBottom:10,gap:12},
  folderIcon:{width:48,height:48,borderRadius:12,alignItems:'center',justifyContent:'center'},
  folderName:{fontSize:15,fontWeight:'700',color:C.text,marginBottom:2},
  folderSub:{fontSize:12,color:C.muted},
  empty:{alignItems:'center',paddingVertical:40,gap:10},
  emptyTitle:{fontSize:16,fontWeight:'700',color:C.text},
  emptySub:{fontSize:13,color:C.muted,textAlign:'center',maxWidth:260},
  // Create modal
  modalContainer:{flex:1,backgroundColor:C.bg},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.border},
  modalTitle:{fontSize:17,fontWeight:'700',color:C.text},
  modalCancel:{fontSize:15,color:C.muted},
  tabRow:{flexDirection:'row',margin:16,backgroundColor:C.surface,borderRadius:10,padding:4},
  tab:{flex:1,paddingVertical:9,borderRadius:8,alignItems:'center'},
  tabActive:{backgroundColor:C.teal},
  tabText:{fontSize:14,fontWeight:'600',color:C.muted},
  tabTextActive:{color:'#fff'},
  searchBar:{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginBottom:8,backgroundColor:C.surface,borderRadius:10,paddingHorizontal:12,paddingVertical:10},
  searchInput:{flex:1,fontSize:14,color:C.text,paddingVertical:0},
  resultRow:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.surface,borderRadius:12,padding:14,marginBottom:8},
  resultIcon:{width:40,height:40,borderRadius:10,alignItems:'center',justifyContent:'center'},
  resultName:{fontSize:15,fontWeight:'600',color:C.text},
  resultSub:{fontSize:12,color:C.muted,marginTop:1},
  emptySearch:{alignItems:'center',paddingVertical:40},
  emptySearchText:{fontSize:14,color:C.muted},
  filterRow:{flexDirection:'row',gap:8,paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border},
  filterChip:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,borderWidth:1,borderColor:C.border,backgroundColor:C.bg},
  filterChipActive:{backgroundColor:C.teal,borderColor:C.teal},
  filterChipText:{fontSize:13,fontWeight:'500',color:C.muted},
  filterChipTextActive:{color:'#fff',fontWeight:'600'},
  // Options bottom sheet
  optionsOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'flex-end'},
  optionsSheet:{backgroundColor:C.bg,borderTopLeftRadius:20,borderTopRightRadius:20,paddingBottom:32,paddingTop:12},
  optionsHandle:{width:40,height:4,backgroundColor:C.border,borderRadius:2,alignSelf:'center',marginBottom:12},
  optionsTitle:{fontSize:15,fontWeight:'700',color:C.text,textAlign:'center',paddingHorizontal:20,paddingBottom:12},
  optionsDivider:{height:1,backgroundColor:C.border},
  optionRow:{flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:24,paddingVertical:16},
  optionIconBox:{width:36,height:36,borderRadius:10,backgroundColor:'#E6F5F5',alignItems:'center',justifyContent:'center'},
  optionText:{fontSize:15,fontWeight:'600',color:C.text},
  // Rename modal
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',alignItems:'center',justifyContent:'center',padding:24},
  renameModal:{width:'100%',backgroundColor:C.bg,borderRadius:20,padding:24,gap:16},
  renameTitle:{fontSize:17,fontWeight:'700',color:C.text,textAlign:'center'},
  renameInput:{backgroundColor:C.surface,borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:C.text,borderWidth:1,borderColor:C.border},
  renameBtns:{flexDirection:'row',gap:12},
  renameCancel:{flex:1,paddingVertical:13,borderRadius:12,borderWidth:1,borderColor:C.border,alignItems:'center'},
  renameCancelText:{fontSize:15,fontWeight:'600',color:C.text},
  renameSave:{flex:1,paddingVertical:13,borderRadius:12,backgroundColor:C.teal,alignItems:'center'},
  renameSaveText:{fontSize:15,fontWeight:'700',color:'#fff'},
  // PIN
  pinScreen:{flex:1,alignItems:'center',paddingTop:32,paddingHorizontal:24,gap:32},
  pinCard:{width:'100%',borderWidth:1,borderColor:C.border,borderRadius:16,padding:24,alignItems:'center',gap:8,backgroundColor:C.bg},
  pinIconBox:{width:64,height:64,borderRadius:32,backgroundColor:C.teal+'15',alignItems:'center',justifyContent:'center',marginBottom:8},
  pinTitle:{fontSize:18,fontWeight:'700',color:C.text},
  pinSub:{fontSize:13,color:C.muted,textAlign:'center',marginBottom:8},
  dotsRow:{flexDirection:'row',gap:16,marginTop:8},
  dot:{width:14,height:14,borderRadius:7},
  dotFilled:{backgroundColor:C.teal},
  dotEmpty:{backgroundColor:C.border},
  pinError:{fontSize:13,color:'#EF4444',marginTop:4},
  numpad:{width:'100%',gap:12},
  numRow:{flexDirection:'row',justifyContent:'center',gap:16},
  numKey:{width:80,height:64,borderRadius:14,backgroundColor:C.surface,alignItems:'center',justifyContent:'center'},
  numKeyAction:{backgroundColor:C.bg,borderWidth:1,borderColor:C.border},
  numKeyOk:{backgroundColor:C.teal,borderWidth:0},
  numKeyText:{fontSize:22,fontWeight:'600',color:C.text},
  forgotPin:{fontSize:13,color:C.teal,fontWeight:'500'},
});
