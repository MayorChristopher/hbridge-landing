import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, Pressable,
  ActivityIndicator, RefreshControl, Modal, TextInput, StatusBar, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { drName } from '../utils/formatters';

const C = {
  paper: '#F5F3EE', paperDark: '#EDE9E0', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', gold: '#D4A843',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
  red: '#EF4444',
};

// â”€â”€ PIN screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PinScreen({ setup, pinStep, currentVal, pinError, onNumpad, onBack, onForgot, showBack = false, greeting }: {
  setup: boolean; pinStep: 'enter' | 'confirm'; currentVal: string;
  pinError: string; onNumpad: (k: string) => void; onBack: () => void; onForgot?: () => void; showBack?: boolean; greeting?: string;
}) {
  const title = setup ? (pinStep === 'confirm' ? 'Confirm your PIN' : 'Create a PIN') : greeting ? `Welcome back, ${greeting}` : 'Welcome back';
  const sub = setup
    ? (pinStep === 'confirm' ? 'Re-enter your 4-digit PIN to confirm' : 'Choose a 4-digit PIN to secure your records')
    : 'Enter your 4-digit PIN to access your medical records';
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['del', '0', 'ok']];

  return (
    <SafeAreaView style={p.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Dark header */}
      <View style={p.hdr}>
        {showBack ? (
          <TouchableOpacity style={p.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text style={p.hdrTitle}>Medical Records</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Paper card */}
      <View style={p.paperCard}>
      <View style={p.body}>
        {/* PIN card */}
        <View style={p.pinCard}>
          <View style={p.pinIconBox}>
            <Image source={require('../../assets/hbridge3.png')} style={{ width: 76, height: 76, borderRadius: 38 }} resizeMode="cover" />
          </View>
          <Text style={p.pinTitle}>{title}</Text>
          <Text style={p.pinSub}>{sub}</Text>
          <View style={p.dotsRow}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[p.dot, i < currentVal.length ? p.dotFilled : p.dotEmpty]} />
            ))}
          </View>
          <View style={{ minHeight: 22, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[p.pinError, { opacity: pinError ? 1 : 0 }]}>{pinError || ' '}</Text>
          </View>
        </View>

        {/* Numpad */}
        <View style={p.numpad}>
          {rows.map((row, ri) => (
            <View key={ri} style={p.numRow}>
              {row.map(k => {
                const isAction = k === 'del' || k === 'ok';
                const isOkReady = k === 'ok' && currentVal.length === 4;
                return (
                  <Pressable
                    key={k}
                    style={({ pressed }) => [
                      p.numKey,
                      isAction ? p.numKeyAction : null,
                      isOkReady ? p.numKeyOk : null,
                      pressed && !isOkReady && { backgroundColor: C.teal, borderColor: C.teal },
                    ]}
                    onPress={() => onNumpad(k)}
                  >
                    {({ pressed }) => (
                      k === 'del'
                        ? <Ionicons name="backspace-outline" size={22} color={pressed ? '#fff' : C.textPrimary} />
                        : k === 'ok'
                        ? <Ionicons name="arrow-forward" size={22} color={isOkReady ? '#fff' : C.muted2} />
                        : <Text style={[p.numKeyText, pressed && { color: '#fff' }]}>{k}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {!setup && onForgot && (
          <TouchableOpacity onPress={onForgot}>
            <Text style={p.forgotPin}>Forgot PIN?</Text>
          </TouchableOpacity>
        )}
      </View>
      </View>{/* paperCard */}
    </SafeAreaView>
  );
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function MedicalRecordsScreen({ navigation }: any) {
  const toast = useToast();
  const [isLocked, setIsLocked]         = useState(true);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [userPin, setUserPin]           = useState<string | null>(null);
  const [pin, setPin]                   = useState('');
  const [confirmPin, setConfirmPin]     = useState('');
  const [pinStep, setPinStep]           = useState<'enter' | 'confirm'>('enter');
  const [pinError, setPinError]         = useState('');
  const [userId, setUserId]             = useState<string | null>(null);
  const [greeting, setGreeting]         = useState('');

  const [folders, setFolders]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [folderType, setFolderType]       = useState<'hospital' | 'doctor'>('hospital');
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching]         = useState(false);

  const [renameFolder, setRenameFolder] = useState<any>(null);
  const [renameValue, setRenameValue]   = useState('');
  const [optionsFolder, setOptionsFolder] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'hospital' | 'doctor'>('all');
  const [folderViewMode, setFolderViewMode] = useState<'list' | 'grid'>('list');
  const [transferredCount, setTransferredCount]       = useState(0);
  const [transferredNewCount, setTransferredNewCount] = useState(0);

  // ── Forgot PIN OTP state ──
  const [forgotVisible, setForgotVisible]   = useState(false);
  const [forgotEmail, setForgotEmail]       = useState('');
  const [forgotOtp, setForgotOtp]           = useState(['','','','','','']);
  const [forgotLoading, setForgotLoading]   = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotOtpRefs    = useRef<(TextInput | null)[]>([]);
  const forgotCooldownRef = useRef<any>(null);

  useEffect(() => { checkPin(); }, []);
  useEffect(() => () => clearInterval(forgotCooldownRef.current), []);

  // Reload folders on focus so badges clear after visiting a folder
  useFocusEffect(useCallback(() => {
    if (userId && !isSettingPin && !isLocked) loadFolders(userId);
  }, [userId, isSettingPin, isLocked]));

  const checkPin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('medical_pin, user_type, full_name').eq('id', user.id).single();

      // Build greeting with appropriate prefix
      if (data?.full_name) {
        if (data.user_type === 'doctor') {
          const { data: doc } = await supabase.from('doctors').select('title').eq('user_id', user.id).maybeSingle();
          setGreeting(drName(data.full_name, doc?.title));
        } else {
          setGreeting(data.full_name.split(' ')[0]); // first name only for patients
        }
      }

      if (data?.medical_pin) setUserPin(data.medical_pin);
      else setIsSettingPin(true);
    } catch { setIsSettingPin(true); }
  };

  const handleSetPin = async () => {
    if (pin.length !== 4) return;
    if (pinStep === 'enter') { setPinStep('confirm'); setConfirmPin(''); setPinError(''); return; }
    if (confirmPin !== pin) { setPinError('PINs do not match. Try again.'); setConfirmPin(''); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ medical_pin: pin }).eq('id', user.id);
      setUserPin(pin); setIsSettingPin(false); setIsLocked(false);
      setPin(''); setConfirmPin(''); setPinStep('enter');
      // useFocusEffect handles the load when isSettingPin/isLocked change
    } catch (e: any) { toast.showError('Error', e.message); }
  };

  const handleUnlock = () => {
    if (pin.length !== 4) return;
    if (pin.trim() === String(userPin ?? '').trim()) {
      setIsLocked(false); setPin(''); setPinError('');
      // useFocusEffect handles the load when isLocked changes to false
    } else { setPinError('Incorrect PIN. Try again.'); setPin(''); }
  };

  const activePin    = isSettingPin ? (pinStep === 'confirm' ? confirmPin : pin) : pin;
  const setActivePin = (val: string) => {
    if (isSettingPin) { pinStep === 'confirm' ? setConfirmPin(val) : setPin(val); }
    else setPin(val);
  };

  const handleNumpad = (digit: string) => {
    setPinError('');
    if (digit === 'del') { setActivePin(activePin.slice(0, -1)); return; }
    if (digit === 'ok')  { isSettingPin ? handleSetPin() : handleUnlock(); return; }
    if (activePin.length < 4) setActivePin(activePin + digit);
  };

  const startForgotCooldown = () => {
    setForgotCooldown(60);
    clearInterval(forgotCooldownRef.current);
    forgotCooldownRef.current = setInterval(() => {
      setForgotCooldown(prev => {
        if (prev <= 1) { clearInterval(forgotCooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleForgotPin = async () => {
    setForgotLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { toast.showError('Error', 'Could not find your account email.'); return; }
      const { error } = await supabase.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setForgotEmail(user.email);
      setForgotOtp(['','','','','','']);
      setForgotVisible(true);
      startForgotCooldown();
      setTimeout(() => forgotOtpRefs.current[0]?.focus(), 400);
    } catch (e: any) {
      toast.showError('Error', e.message || 'Could not send verification code.');
    } finally { setForgotLoading(false); }
  };

  const handleResendForgotOtp = async () => {
    if (forgotCooldown > 0) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: forgotEmail, options: { shouldCreateUser: false } });
      if (error) throw error;
      toast.showSuccess('Code Sent', 'A new verification code has been sent.');
      setForgotOtp(['','','','','','']);
      startForgotCooldown();
      setTimeout(() => forgotOtpRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      toast.showError('Error', e.message || 'Could not resend code.');
    } finally { setForgotLoading(false); }
  };

  const handleForgotOtpChange = (val: string, idx: number) => {
    if (val.length === 6 && /^\d{6}$/.test(val)) {
      const digits = val.split('');
      setForgotOtp(digits);
      forgotOtpRefs.current[5]?.focus();
      return;
    }
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...forgotOtp];
    next[idx] = digit;
    setForgotOtp(next);
    if (digit && idx < 5) forgotOtpRefs.current[idx + 1]?.focus();
  };

  const handleVerifyForgotOtp = async () => {
    const code = forgotOtp.join('');
    if (code.length < 6) { toast.showWarning('Required', 'Enter all 6 digits from your email.'); return; }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: forgotEmail, token: code, type: 'email' });
      if (error) throw error;
      // Verified — clear PIN and go to setup
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('profiles').update({ medical_pin: null }).eq('id', user.id);
      clearInterval(forgotCooldownRef.current);
      setForgotVisible(false);
      setForgotOtp(['','','','','','']);
      setForgotCooldown(0);
      setUserPin(null);
      setIsSettingPin(true);
      setIsLocked(true);
      setPin('');
      setPinStep('enter');
      toast.showSuccess('Verified', 'Create a new PIN to secure your records.');
    } catch (e: any) {
      toast.showError('Invalid Code', 'Code is incorrect or expired. Tap resend for a new one.');
    } finally { setForgotLoading(false); }
  };

  const loadFolders = async (uid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('record_folders').select('*').eq('owner_id', uid).order('created_at', { ascending: false });
      const raw = data || [];

      // Enrich doctor folders with profile images and clean display names
      const doctorIds = raw.filter((f: any) => f.folder_type === 'doctor' && f.linked_id).map((f: any) => f.linked_id);
      const imageMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      if (doctorIds.length > 0) {
        const { data: docs } = await supabase.from('doctors').select('id, profile_image, full_name, title').in('id', doctorIds);
        (docs || []).forEach((d: any) => {
          if (d.profile_image) imageMap[d.id] = d.profile_image;
          if (d.full_name) nameMap[d.id] = drName(d.full_name, d.title);
        });
      }

      // Fetch record counts per folder (own uploads)
      const folderIds = raw.map((f: any) => f.id).filter(Boolean);

      // Read per-folder "last seen" timestamps from storage; fall back to 7 days ago
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const seenMap: Record<string, string> = {};
      await Promise.all(folderIds.map(async (id: string) => {
        const val = await AsyncStorage.getItem(`folder_seen_${id}`).catch(() => null);
        seenMap[id] = val || sevenDaysAgo;
      }));

      const countMap: Record<string, number> = {};
      const newCountMap: Record<string, number> = {};
      if (folderIds.length > 0) {
        const { data: recRows } = await supabase
          .from('medical_records').select('folder_id, created_at').eq('user_id', uid).in('folder_id', folderIds);
        (recRows || []).forEach((r: any) => {
          if (!r.folder_id) return;
          countMap[r.folder_id] = (countMap[r.folder_id] || 0) + 1;
          const cutoff = seenMap[r.folder_id] || sevenDaysAgo;
          if (r.created_at >= cutoff) newCountMap[r.folder_id] = (newCountMap[r.folder_id] || 0) + 1;
        });
      }

      // Build linked_id → folder_id map so we can look up the seen timestamp for doctor folders
      const linkedToFolder: Record<string, string> = {};
      raw.forEach((f: any) => { if (f.linked_id) linkedToFolder[f.linked_id] = f.id; });

      // Fetch count of records shared by doctors into each doctor folder
      const sentCountMap: Record<string, number> = {};
      const sentNewCountMap: Record<string, number> = {};
      if (doctorIds.length > 0) {
        const { data: accessRows } = await supabase
          .from('medical_record_access').select('doctor_id, created_at').eq('patient_id', uid).in('doctor_id', doctorIds).eq('is_active', true).eq('access_type', 'doctor_sent');
        (accessRows || []).forEach((r: any) => {
          sentCountMap[r.doctor_id] = (sentCountMap[r.doctor_id] || 0) + 1;
          const fid = linkedToFolder[r.doctor_id];
          const cutoff = (fid && seenMap[fid]) || sevenDaysAgo;
          if (r.created_at >= cutoff) sentNewCountMap[r.doctor_id] = (sentNewCountMap[r.doctor_id] || 0) + 1;
        });
      }

      // Total transferred records (from ANY doctor, not just those with folders)
      const transferredSeenAt = await AsyncStorage.getItem('transferred_seen').catch(() => null) || sevenDaysAgo;
      const { data: allTransferred } = await supabase
        .from('medical_record_access').select('created_at')
        .eq('patient_id', uid).eq('is_active', true).eq('access_type', 'doctor_sent');
      setTransferredCount((allTransferred || []).length);
      setTransferredNewCount((allTransferred || []).filter((r: any) => r.created_at >= transferredSeenAt).length);

      setFolders(raw.map((f: any) => ({
        ...f,
        _image: imageMap[f.linked_id] || null,
        _displayName: f.folder_type === 'doctor' && nameMap[f.linked_id] ? nameMap[f.linked_id] : f.folder_name,
        _count: (countMap[f.id] || 0) + (sentCountMap[f.linked_id] || 0),
        _newCount: (newCountMap[f.id] || 0) + (sentNewCountMap[f.linked_id] || 0),
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { if (!userId) return; setRefreshing(true); await loadFolders(userId); setRefreshing(false); };

  const runSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      if (folderType === 'hospital') {
        const { data } = await supabase.from('hospitals').select('id, name, city, state').ilike('name', `%${q}%`).limit(15);
        setSearchResults((data || []).map((h: any) => ({ id: h.id, name: h.name, sub: `${h.city ?? ''}, ${h.state ?? ''}`, type: 'hospital' })));
      } else {
        const { data } = await supabase.from('doctors').select('id, full_name, specialization, title').eq('verification_status', 'verified').ilike('full_name', `%${q}%`).limit(15);
        setSearchResults((data || []).map((d: any) => ({ id: d.id, name: drName(d.full_name, d.title), sub: d.specialization ?? '', type: 'doctor' })));
      }
    } finally { setSearching(false); }
  };

  const createFolder = async (target: any) => {
    if (!userId) return;
    try {
      const { data: existing } = await supabase.from('record_folders').select('id').eq('owner_id', userId).eq('linked_id', target.id).maybeSingle();
      if (existing) { toast.showInfo('Folder exists', 'A folder for this entity already exists.'); return; }
      await supabase.from('record_folders').insert({
        owner_id: userId, folder_name: target.name, folder_type: target.type, linked_id: target.id,
      });
      setCreateVisible(false); setSearchQuery(''); setSearchResults([]);
      loadFolders(userId);
      toast.showSuccess('Folder Created', target.name);
    } catch (e: any) { toast.showError('Error', e.message); }
  };

  const renameFolder_ = async () => {
    if (!renameValue.trim() || !renameFolder) return;
    try {
      await supabase.from('record_folders').update({ folder_name: renameValue.trim() }).eq('id', renameFolder.id);
      setRenameFolder(null); setRenameValue('');
      if (userId) loadFolders(userId);
      toast.showSuccess('Renamed', 'Folder name updated.');
    } catch (e: any) { toast.showError('Error', e.message); }
  };

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<any>(null);

  const deleteFolder = (folder: any) => setDeleteFolderTarget(folder);

  const doDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const folder = deleteFolderTarget;
    setDeleteFolderTarget(null);
    await supabase.from('record_folders').delete().eq('id', folder.id);
    if (userId) loadFolders(userId);
    toast.showSuccess('Deleted', `"${folder.folder_name}" removed.`);
  };

  // PIN gate screens
  if (isSettingPin) return (
    <PinScreen setup pinStep={pinStep} currentVal={pinStep === 'confirm' ? confirmPin : pin}
      pinError={pinError} onNumpad={handleNumpad}
      showBack={pinStep === 'confirm'}
      onBack={() => { if (pinStep === 'confirm') { setPinStep('enter'); setConfirmPin(''); setPinError(''); } else navigation.goBack(); }} />
  );
  if (isLocked) return (
    <>
      <PinScreen setup={false} pinStep="enter" currentVal={pin}
        pinError={pinError} onNumpad={handleNumpad}
        showBack={false} onForgot={forgotLoading ? undefined : handleForgotPin}
        onBack={() => navigation.goBack()} greeting={greeting} />

      {/* ── Forgot PIN — OTP Verification Modal ── */}
      <Modal visible={forgotVisible} transparent animationType="slide" onRequestClose={() => setForgotVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={fp.overlay}>
          <View style={fp.sheet}>
            <View style={fp.handle} />
            <View style={fp.iconRow}>
              <View style={fp.iconBox}>
                <Ionicons name="mail-outline" size={24} color={C.teal} />
              </View>
            </View>
            <Text style={fp.title}>Verify your identity</Text>
            <Text style={fp.sub}>
              A 6-digit code has been sent to{'\n'}
              <Text style={{ fontWeight: '700', color: C.ink }}>{forgotEmail}</Text>
            </Text>

            {/* 6-box OTP */}
            <View style={fp.otpRow}>
              {forgotOtp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={r => { forgotOtpRefs.current[idx] = r; }}
                  style={[fp.otpBox, digit && fp.otpBoxFilled]}
                  value={digit}
                  onChangeText={v => handleForgotOtpChange(v, idx)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !forgotOtp[idx] && idx > 0)
                      forgotOtpRefs.current[idx - 1]?.focus();
                  }}
                  keyboardType="number-pad"
                  maxLength={idx === 0 ? 6 : 1}
                  selectTextOnFocus
                  textAlign="center"
                />
              ))}
            </View>

            <TouchableOpacity
              style={[fp.verifyBtn, (forgotLoading || forgotOtp.join('').length < 6) && fp.verifyBtnDisabled]}
              onPress={handleVerifyForgotOtp}
              disabled={forgotLoading || forgotOtp.join('').length < 6}
              activeOpacity={0.85}
            >
              <Text style={fp.verifyBtnText}>{forgotLoading ? 'Verifying…' : 'Verify & Reset PIN'}</Text>
            </TouchableOpacity>

            <View style={fp.linkRow}>
              <TouchableOpacity onPress={handleResendForgotOtp} disabled={forgotLoading || forgotCooldown > 0}>
                <Text style={[fp.link, forgotCooldown > 0 && { color: C.muted2 }]}>
                  {forgotCooldown > 0 ? `Resend in ${forgotCooldown}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
              <Text style={fp.dot}>·</Text>
              <TouchableOpacity onPress={() => { setForgotVisible(false); clearInterval(forgotCooldownRef.current); setForgotCooldown(0); }}>
                <Text style={[fp.link, { color: C.muted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );

  const folderIcon = (type: string) => {
    if (type === 'hospital') return <MaterialCommunityIcons name="hospital-building" size={24} color={C.teal} />;
    if (type === 'doctor')   return <Ionicons name="person" size={24} color={C.teal} />;
    return <Ionicons name="folder" size={24} color={C.gold} />;
  };
  const folderIconBg = (type: string) => type === 'hospital' ? 'rgba(11,126,138,0.1)' : type === 'doctor' ? 'rgba(11,126,138,0.1)' : 'rgba(212,168,67,0.12)';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Rename modal */}
      <Modal visible={!!renameFolder} transparent animationType="fade">
        <View style={s.overlayCenter}>
          <View style={s.renameModal}>
            <Text style={s.renameTitle}>Rename Folder</Text>
            <TextInput
              style={s.renameInput} value={renameValue}
              onChangeText={setRenameValue} placeholder="Folder name"
              placeholderTextColor={C.muted2} autoFocus
            />
            <View style={s.renameBtns}>
              <TouchableOpacity style={s.renameCancel} onPress={() => setRenameFolder(null)}>
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
            <TouchableOpacity onPress={() => { setCreateVisible(false); setSearchQuery(''); setSearchResults([]); }}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Create Folder</Text>
            <View style={{ width: 50 }} />
          </View>

          <View style={s.tabRow}>
            {(['hospital', 'doctor'] as const).map(t => (
              <TouchableOpacity key={t} style={[s.tab, folderType === t && s.tabActive]}
                onPress={() => { setFolderType(t); setSearchQuery(''); setSearchResults([]); }}>
                <Text style={[s.tabText, folderType === t && s.tabTextActive]}>
                  {t === 'hospital' ? 'Hospital' : 'Medical Practitioner'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color={C.muted2} />
            <TextInput
              style={s.searchInput} value={searchQuery}
              onChangeText={q => { setSearchQuery(q); runSearch(q); }}
              placeholder={folderType === 'hospital' ? 'Search hospitals...' : 'Search medical practitioners...'}
              placeholderTextColor={C.muted2} autoFocus
            />
            {searching && <ActivityIndicator size="small" color={C.teal} />}
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={s.emptySearch}>
                <Text style={s.emptySearchText}>
                  {searchQuery.trim() ? 'No results found' : folderType === 'hospital' ? 'Type to search hospitals' : 'Type to search medical practitioners'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={s.resultRow} onPress={() => createFolder(item)}>
                <View style={[s.resultIcon, { backgroundColor: folderIconBg(item.type) }]}>
                  {item.type === 'hospital'
                    ? <MaterialCommunityIcons name="hospital-building" size={20} color={C.teal} />
                    : <Ionicons name="person" size={20} color={C.teal} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName}>{item.name}</Text>
                  <Text style={s.resultSub}>{item.sub}</Text>
                </View>
                <Ionicons name="folder-open-outline" size={18} color={C.muted2} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Folder options sheet */}
      <Modal visible={!!optionsFolder} transparent animationType="slide">
        <TouchableOpacity style={s.optionsOverlay} activeOpacity={1} onPress={() => setOptionsFolder(null)}>
          <View style={s.optionsSheet}>
            <View style={s.optionsHandle} />
            <Text style={s.optionsTitle} numberOfLines={1}>{optionsFolder?._displayName ?? optionsFolder?.folder_name ?? ''}</Text>
            <View style={s.optionsDivider} />
            <TouchableOpacity style={s.optionRow} onPress={() => {
              setRenameFolder(optionsFolder);
              setRenameValue(optionsFolder?.folder_name ?? '');
              setOptionsFolder(null);
            }}>
              <View style={s.optionIconBox}><Ionicons name="pencil-outline" size={18} color={C.teal} /></View>
              <Text style={s.optionText}>Rename Folder</Text>
            </TouchableOpacity>
            <View style={s.optionsDivider} />
            <TouchableOpacity style={s.optionRow} onPress={() => { deleteFolder(optionsFolder); setOptionsFolder(null); }}>
              <View style={[s.optionIconBox, { backgroundColor: '#fee2e2' }]}><Ionicons name="trash-outline" size={18} color={C.red} /></View>
              <Text style={[s.optionText, { color: C.red }]}>Delete Folder</Text>
            </TouchableOpacity>
            <View style={s.optionsDivider} />
            <TouchableOpacity style={[s.optionRow, { justifyContent: 'center' }]} onPress={() => setOptionsFolder(null)}>
              <Text style={[s.optionText, { color: C.muted, fontFamily: 'SpaceGrotesk_400Regular' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dark header */}
      <View style={s.hdrRow}>
        <Text style={s.hdrTitle}>Medical Records</Text>
        <TouchableOpacity style={s.addBtnLight} onPress={() => setFolderViewMode(v => v === 'list' ? 'grid' : 'list')}>
          <Ionicons name={folderViewMode === 'list' ? 'grid-outline' : 'list-outline'} size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtnLight} onPress={() => setCreateVisible(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={s.contentCard}>

      {/* Security banner */}
      <View style={s.secBanner}>
        <Ionicons name="shield-checkmark" size={13} color={C.teal} />
        <Text style={s.secText}>AES-256 Encrypted · PIN Protected</Text>
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {(['all', 'hospital', 'doctor'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.filterChip, filter === f && s.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'hospital' ? 'Hospitals' : 'Practitioners'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ flex: 1 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filter === 'all' ? folders : folders.filter(f => f.folder_type === filter)}
          keyExtractor={f => f.id}
          key={folderViewMode}
          numColumns={folderViewMode === 'grid' ? 3 : 1}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 110 }}
          columnWrapperStyle={folderViewMode === 'grid' ? { gap: 10, marginBottom: 12 } : undefined}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          ListHeaderComponent={() => (
            <View style={{ width: '100%' }}>
              {/* Personal Records — always visible */}
              <TouchableOpacity style={[s.folderCard, { marginBottom: 8 }]}
                onPress={() => navigation.navigate('HospitalRecords', { folderId: 'personal', folderName: 'Personal Records', userId, linkedId: null })}>
                <View style={[s.folderIconBox, { backgroundColor: 'rgba(212,168,67,0.12)' }]}>
                  <Ionicons name="folder" size={24} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.folderName}>Personal Records</Text>
                  <Text style={s.folderSub}>Self-uploaded records</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted2} />
              </TouchableOpacity>

              {/* Received from Practitioners — hide when filtering by hospital only */}
              {filter !== 'hospital' && (
                <TouchableOpacity style={[s.folderCard, { marginBottom: 8 }]}
                  onPress={() => {
                    AsyncStorage.setItem('transferred_seen', new Date().toISOString()).catch(() => {});
                    setTransferredNewCount(0);
                    navigation.navigate('TransferredRecords');
                  }}>
                  <View style={{ position: 'relative', marginRight: 2 }}>
                    <View style={[s.folderIconBox, { backgroundColor: 'rgba(11,126,138,0.1)' }]}>
                      <Ionicons name="arrow-down-circle" size={24} color={C.teal} />
                    </View>
                    {transferredNewCount > 0 && (
                      <View style={s.newBadge}><Text style={s.newBadgeText}>{transferredNewCount}</Text></View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.folderName}>Received from Practitioners</Text>
                    <Text style={s.folderSub}>
                      {transferredCount > 0
                        ? `${transferredCount} record${transferredCount !== 1 ? 's' : ''} shared with you`
                        : 'Records sent to you by practitioners'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted2} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconBox}>
                <MaterialCommunityIcons name="folder-open-outline" size={36} color={C.muted2} />
              </View>
              <Text style={s.emptyTitle}>No Folders Yet</Text>
              <Text style={s.emptySub}>Tap + to create a folder for a hospital or medical practitioner</Text>
            </View>
          }
          renderItem={({ item }) => {
            const displayName = item._displayName ?? item.folder_name;
            const nav = () => navigation.navigate('HospitalRecords', {
              folderId: item.id, folderName: displayName,
              userId, linkedId: item.linked_id, folderType: item.folder_type,
            });

            // Initials avatar for doctor folders with no profile image
            const initials = (() => {
              if (item.folder_type !== 'doctor' || item._image) return null;
              const stripped = displayName.replace(/^(dr\.?|prof\.?|nurse\.?|pharm\.?|physio\.?|rad\.?)\s+/i, '').trim();
              const parts = stripped.split(' ').filter(Boolean);
              return parts.length >= 2
                ? (parts[0][0] + parts[1][0]).toUpperCase()
                : (parts[0]?.[0] ?? '?').toUpperCase();
            })();

            if (folderViewMode === 'grid') {
              return (
                <TouchableOpacity style={s.gridFolderCard} onPress={nav} onLongPress={() => setOptionsFolder(item)}>
                  <View style={{ position: 'relative' }}>
                    <View style={[s.gridFolderIcon, { backgroundColor: folderIconBg(item.folder_type), overflow: 'hidden' }]}>
                      {item._image
                        ? <Image source={{ uri: item._image }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                        : initials
                          ? <Text style={s.initialsTextGrid}>{initials}</Text>
                          : folderIcon(item.folder_type)}
                    </View>
                    {item._newCount > 0 && <View style={s.newBadge}><Text style={s.newBadgeText}>{item._newCount}</Text></View>}
                  </View>
                  <Text style={s.gridFolderName} numberOfLines={1}>{displayName}</Text>
                  <Text style={s.gridFolderCount}>{item._count || 0} record{item._count !== 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              );
            }
            const subLabel = item._count > 0
              ? `${item._count} record${item._count !== 1 ? 's' : ''}${item._newCount > 0 ? ` · ${item._newCount} new` : ''}`
              : (item.folder_type === 'hospital' ? 'Hospital folder' : item.folder_type === 'doctor' ? 'Medical Practitioner folder' : 'Personal');
            return (
              <TouchableOpacity style={s.folderCard} onPress={nav}>
                <View style={{ position: 'relative', marginRight: 2 }}>
                  <View style={[s.folderIconBox, { backgroundColor: folderIconBg(item.folder_type), overflow: 'hidden' }]}>
                    {item._image
                      ? <Image source={{ uri: item._image }} style={{ width: 48, height: 48, borderRadius: 14 }} />
                      : initials
                        ? <Text style={s.initialsTextList}>{initials}</Text>
                        : folderIcon(item.folder_type)}
                  </View>
                  {item._newCount > 0 && <View style={s.newBadge}><Text style={s.newBadgeText}>{item._newCount}</Text></View>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.folderName} numberOfLines={1}>{displayName}</Text>
                  <Text style={s.folderSub}>{subLabel}</Text>
                </View>
                <TouchableOpacity style={{ padding: 4 }} onPress={() => setOptionsFolder(item)}>
                  <Ionicons name="ellipsis-vertical" size={18} color={C.muted2} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color={C.muted2} />
              </TouchableOpacity>
            );
          }}
        />
      )}
      </View>{/* end contentCard */}

      {/* Upload FAB */}
      <TouchableOpacity
        style={s.uploadFab}
        onPress={() => navigation.navigate('UploadRecord', { folderId: 'personal', folderName: 'Personal Records', userId })}
        activeOpacity={0.85}
      >
        <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        <Text style={s.uploadFabText}>Upload Record</Text>
      </TouchableOpacity>

      {/* Delete Folder Confirm */}
      <Modal visible={!!deleteFolderTarget} animationType="slide" transparent onRequestClose={() => setDeleteFolderTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#EAE5DA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: 6 }}>Delete Folder?</Text>
            <Text style={{ fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', marginBottom: 24, lineHeight: 20 }}>
              Records inside won't be deleted — only the folder is removed.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteFolderTarget(null)} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EDE9E0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#7A8785' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doDeleteFolder} style={{ flex: 1, padding: 14, borderRadius: 13, backgroundColor: '#EF4444', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// PIN screen styles
const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },
  hdr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, backgroundColor: '#083236' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#fff', textAlign: 'center' },
  paperCard: { flex: 1, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  body: { flex: 1, alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, paddingBottom: 100, gap: 20 },
  pinCard: {
    width: '100%', borderWidth: 1, borderColor: C.cardBorder, borderRadius: 20,
    padding: 24, alignItems: 'center', gap: 8, backgroundColor: C.card,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
  },
  pinIconBox: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', borderWidth: 3, borderColor: C.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  pinTitle:    { fontSize: 17, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  pinGreeting: { fontSize: 22, fontFamily: 'Montserrat_800ExtraBold', color: C.textPrimary, textAlign: 'center', marginTop: -2 },
  pinSub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', marginBottom: 6, lineHeight: 20 },
  dotsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotFilled: { backgroundColor: C.teal },
  dotEmpty: { backgroundColor: C.cardBorder },
  pinError: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.red, marginTop: 4 },
  numpad: { width: '100%', gap: 12 },
  numRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  numKey: { width: 80, height: 64, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center', justifyContent: 'center' },
  numKeyAction: { backgroundColor: C.paper, borderColor: C.cardBorder },
  numKeyOk: { backgroundColor: C.teal, borderWidth: 0 },
  numKeyText: { fontSize: 22, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  forgotPin: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
});

// Forgot PIN modal styles
const fp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, alignItems: 'center', gap: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5E5', marginBottom: 8 },
  iconRow: { alignItems: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(11,126,138,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', textAlign: 'center' },
  sub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785', textAlign: 'center', lineHeight: 20 },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', width: '100%' },
  otpBox: {
    width: 44, height: 52, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
    fontSize: 20, fontFamily: 'Montserrat_700Bold', color: '#0C2E30',
  },
  otpBoxFilled: { borderColor: '#0B7E8A', backgroundColor: '#E6F5F5' },
  verifyBtn: {
    width: '100%', height: 52, backgroundColor: '#0B7E8A',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnDisabled: { backgroundColor: '#A3A3A3' },
  verifyBtnText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#0B7E8A' },
  dot: { fontSize: 13, color: '#A3A3A3' },
});

// Main screen styles
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#083236' },
  contentCard: { flex: 1, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  hdrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, backgroundColor: '#083236' },
  backBtnLight: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  addBtnLight: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#fff', textAlign: 'left' },

  secBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(11,126,138,0.08)',
    paddingHorizontal: 20, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  secText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },

  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.card },
  filterChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterChipText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  filterChipTextActive: { color: '#fff', fontFamily: 'Montserrat_600SemiBold' },

  folderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder,
    padding: 14, marginBottom: 10,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  folderIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  folderName: { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: C.textPrimary, marginBottom: 2 },
  folderSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  // New-record badge — sits outside the icon box, clear of the rounded corner
  newBadge: {
    position: 'absolute', top: -5, right: -7,
    backgroundColor: C.teal, borderRadius: 9, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: C.card,
    zIndex: 10,
  },
  newBadgeText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Grid folder view
  gridFolderCard: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 4 },
  gridFolderIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  gridFolderName: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary, textAlign: 'center' },
  gridFolderCount: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center' },

  // Initials avatar text
  initialsTextList: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: C.teal },
  initialsTextGrid: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: C.teal },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 22, backgroundColor: C.paperDark, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  // Create folder modal
  modalContainer: { flex: 1, backgroundColor: C.paper },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder, backgroundColor: C.card,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  modalCancel: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  tabRow: { flexDirection: 'row', margin: 16, backgroundColor: C.paperDark, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: C.ink },
  tabText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  tabTextActive: { color: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, paddingVertical: 0 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder,
    padding: 14, marginBottom: 8,
  },
  resultIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  resultName: { fontSize: 14.5, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  resultSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },
  emptySearch: { alignItems: 'center', paddingVertical: 40 },
  emptySearchText: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },

  // Options bottom sheet
  optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 32, paddingTop: 12 },
  optionsHandle: { width: 40, height: 4, backgroundColor: C.cardBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  optionsTitle: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.textPrimary, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  optionsDivider: { height: 1, backgroundColor: C.cardBorder },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16 },
  optionIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(11,126,138,0.1)', alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },

  // Upload FAB
  uploadFab: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.teal, paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 100,
    shadowColor: C.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  uploadFabText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Rename modal
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  renameModal: { width: '100%', backgroundColor: C.card, borderRadius: 20, padding: 24, gap: 16 },
  renameTitle: { fontSize: 17, fontFamily: 'Montserrat_700Bold', color: C.textPrimary, textAlign: 'center' },
  renameInput: {
    backgroundColor: C.paper, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  renameBtns: { flexDirection: 'row', gap: 12 },
  renameCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center', backgroundColor: C.paper },
  renameCancelText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  renameSave: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.teal, alignItems: 'center' },
  renameSaveText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});
