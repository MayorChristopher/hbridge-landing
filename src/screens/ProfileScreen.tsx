import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Image,
  RefreshControl, Modal, TextInput, ActivityIndicator, StatusBar, DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Toast } from '../utils/toast';
import { useToast } from '../components/ToastProvider';
import { shareApp, shareDoctor } from '../utils/share';

const C = {
  paper: '#F5F3EE', paperDark: '#EDE9E0', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)', tealHero1: '#0C6570', tealHero2: '#083236',
  gold: '#D4A843', goldBg: 'rgba(212,168,67,0.12)', goldBorder: 'rgba(212,168,67,0.3)',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
  red: '#EF4444',
};

export default function ProfileScreen({ navigation }: any) {
  const toast = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vitals, setVitals] = useState<any>(null);
  const [counts, setCounts] = useState({ appointments: 0, records: 0, doctors: 0 });
  const [editVisible, setEditVisible] = useState(false);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', date_of_birth: '', gender: '', address: '', state: '',
    hospital_name: '',
    hosp_type: '', hosp_phone: '', hosp_emergency_phone: '',
    hosp_address: '', hosp_city: '', hosp_lga: '', hosp_state: '',
    hosp_emergency_services: false, hosp_services: [] as string[],
    title: '', specialization: '', medical_license: '', consultation_fee: '', years_experience: '', bio: '',
    consultation_fees: {} as Record<string, string>,
    // Patient onboarding fields
    blood_type: '', height_cm: '', weight_kg: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    allergies: [] as string[], conditions: [] as string[],
    preferred_consultation_types: [] as string[],
    // Doctor onboarding fields
    nma_number: '', secondary_specialty: '',
    consultation_types: [] as string[], availability_days: [] as string[],
  });
  const [vitalsForm, setVitalsForm] = useState({ heart_rate: '', blood_pressure: '', temperature: '', oxygen_saturation: '' });
  const [saving, setSaving] = useState(false);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('patient');

  // ── Feedback modal ────────────────────────────────────────────────────────
  const [feedbackVisible, setFeedbackVisible]     = useState(false);
  const [feedbackCategory, setFeedbackCategory]   = useState<'suggestion'|'bug_report'|'improvement'|'general'>('suggestion');
  const [feedbackMessage, setFeedbackMessage]     = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // ── Hospital row (hospital_admin only) ───────────────────────────────────
  const [hospitalRow, setHospitalRow]     = useState<any>(null);

  // ── Payout account state (doctors only) ──────────────────────────────────
  const [doctorRow, setDoctorRow]         = useState<any>(null);
  const [payoutVisible, setPayoutVisible] = useState(false);
  const [payoutBank, setPayoutBank]       = useState<{ name: string; code: string } | null>(null);
  const [payoutAcct, setPayoutAcct]       = useState('');
  const [verifiedName, setVerifiedName]   = useState('');
  const [verifying, setVerifying]         = useState(false);
  const [payoutSaving, setPayoutSaving]   = useState(false);
  const [bankSearch, setBankSearch]       = useState('');

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { data: vitalsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('vitals').select('*').eq('patient_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setProfile(prof);
      setVitals(vitalsData);

      const storedRole = await AsyncStorage.getItem(`active_role_${user.id}`);
      const role = storedRole || prof?.user_type || 'patient';
      setActiveRole(role);

      if (role === 'doctor') {
        const { data: doc } = await supabase.from('doctors').select('id,paystack_subaccount,bank_code,account_number,consultation_types,availability_days').eq('user_id', user.id).maybeSingle();
        setDoctorRow(doc);
        if (doc?.id) {
          const [{ count: apptCount }, { count: recCount }, { count: patCount }] = await Promise.all([
            supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('doctor_id', doc.id),
            supabase.from('medical_record_access').select('*', { count: 'exact', head: true }).eq('doctor_id', doc.id).eq('is_active', true),
            supabase.from('consultations').select('patient_id', { count: 'exact', head: true }).eq('doctor_id', doc.id),
          ]);
          setCounts({ appointments: apptCount || 0, records: recCount || 0, doctors: patCount || 0 });
        }
      } else if (role === 'hospital_admin') {
        const hospitalName = prof?.hospital_name || prof?.full_name;
        if (hospitalName) {
          let { data: hosp } = await supabase.from('hospitals').select('*').ilike('name', `%${hospitalName}%`).maybeSingle();
          if (!hosp) {
            // Auto-create hospital row for admins who registered before this was implemented
            const { data: created } = await supabase.from('hospitals').insert({
              name: hospitalName.trim(), is_active: true, rating: 0, total_reviews: 0,
              type: 'General', category: 'Private', address: 'Pending', city: 'Pending', state: 'Pending',
            }).select().maybeSingle();
            hosp = created;
          }
          setHospitalRow(hosp || null);
          if (hosp?.id) {
            const [{ data: accessRows }, { data: doctors }, { data: patients }] = await Promise.all([
              supabase.from('medical_record_access').select('id, medical_records!inner(id)').eq('hospital_id', hosp.id).eq('is_active', true),
              supabase.from('medical_record_access').select('doctor_id').eq('hospital_id', hosp.id).eq('is_active', true).not('doctor_id', 'is', null),
              supabase.from('medical_record_access').select('patient_id').eq('hospital_id', hosp.id).eq('is_active', true),
            ]);
            const recCount = (accessRows || []).length;
            const uniqueDoctors  = new Set((doctors  || []).map((r: any) => r.doctor_id).filter(Boolean)).size;
            const uniquePatients = new Set((patients || []).map((r: any) => r.patient_id).filter(Boolean)).size;
            setCounts({ appointments: uniquePatients, records: recCount || 0, doctors: uniqueDoctors });
          } else {
            setCounts({ appointments: 0, records: 0, doctors: 0 });
          }
        } else {
          setCounts({ appointments: 0, records: 0, doctors: 0 });
        }
      } else {
        const [{ count: apptCount }, { count: recCount }, { count: docCount }] = await Promise.all([
          supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('patient_id', user.id),
          supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('patient_id', user.id).not('status', 'eq', 'cancelled'),
        ]);
        setCounts({ appointments: apptCount || 0, records: recCount || 0, doctors: docCount || 0 });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadProfile(); setRefreshing(false); };

  // ── Nigerian banks (name + Paystack bank code) ────────────────────────────
  const NIGERIAN_BANKS = [
    { name: 'Access Bank',            code: '044' },
    { name: 'Citibank Nigeria',        code: '023' },
    { name: 'EcoBank Nigeria',         code: '050' },
    { name: 'Fidelity Bank',           code: '070' },
    { name: 'First Bank of Nigeria',   code: '011' },
    { name: 'First City Monument Bank (FCMB)', code: '214' },
    { name: 'Globus Bank',             code: '103' },
    { name: 'Guaranty Trust Bank (GTB)', code: '058' },
    { name: 'Heritage Bank',           code: '030' },
    { name: 'Keystone Bank',           code: '082' },
    { name: 'Kuda Bank',               code: '090267' },
    { name: 'Moniepoint MFB',          code: '090405' },
    { name: 'Opay',                    code: '999992' },
    { name: 'Palmpay',                 code: '999991' },
    { name: 'Polaris Bank',            code: '076' },
    { name: 'Providus Bank',           code: '101' },
    { name: 'Stanbic IBTC Bank',       code: '221' },
    { name: 'Standard Chartered Bank', code: '068' },
    { name: 'Sterling Bank',           code: '232' },
    { name: 'Union Bank of Nigeria',   code: '032' },
    { name: 'United Bank for Africa (UBA)', code: '033' },
    { name: 'Unity Bank',              code: '215' },
    { name: 'VFD Microfinance Bank',   code: '090110' },
    { name: 'Wema Bank',               code: '035' },
    { name: 'Zenith Bank',             code: '057' },
  ];

  const filteredBanks = bankSearch.trim()
    ? NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : NIGERIAN_BANKS;

  const openPayoutModal = () => {
    // Pre-fill if already saved
    if (doctorRow?.bank_code) {
      const bank = NIGERIAN_BANKS.find(b => b.code === doctorRow.bank_code);
      if (bank) setPayoutBank(bank);
    }
    setPayoutAcct(doctorRow?.account_number || '');
    setVerifiedName('');
    setBankSearch('');
    setPayoutVisible(true);
  };

  const verifyAccount = async () => {
    if (!payoutBank || payoutAcct.length < 10) {
      toast.showWarning('Incomplete', 'Select a bank and enter a 10-digit account number');
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-subaccount', {
        body: { action: 'verify', bank_code: payoutBank.code, account_number: payoutAcct },
      });
      if (error || data?.error) throw new Error(data?.error || 'Verification failed');
      setVerifiedName(data.account_name);
    } catch (e: any) {
      toast.showError('Verification Failed', e.message || 'Could not verify account. Check the details and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const savePayout = async () => {
    if (!verifiedName) { toast.showWarning('Verify first', 'Please verify your account number before saving'); return; }
    if (!doctorRow?.id) return;
    setPayoutSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-subaccount', {
        body: {
          action: 'create',
          bank_code: payoutBank!.code,
          account_number: payoutAcct,
          doctor_id: doctorRow.id,
          business_name: profile?.full_name || 'Doctor',
          email: (await supabase.auth.getUser()).data.user?.email || undefined,
          phone: profile?.phone || undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || 'Failed to save payout account');
      setDoctorRow((prev: any) => ({
        ...prev,
        paystack_subaccount: data.subaccount_code,
        bank_code: payoutBank!.code,
        account_number: payoutAcct,
      }));
      setPayoutVisible(false);
      toast.showSuccess('Payout Account Saved', `Payments will now be split automatically. You receive 85% of each consultation fee.`);
    } catch (e: any) {
      toast.showError('Save Failed', e.message);
    } finally {
      setPayoutSaving(false);
    }
  };

  const uploadProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.showWarning('Permission needed', 'Allow photo access to upload your profile picture');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        const asset = result.assets[0];
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `profiles/${fileName}`;
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: fileName, type: `image/${fileExt}` } as any);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const supabaseUrl = (supabase as any).supabaseUrl as string;
        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${filePath}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
          body: formData,
        });
        if (!uploadResponse.ok) throw new Error('Upload failed');
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
        const { error } = await supabase.from('profiles').update({ profile_image: publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
        if (error) throw error;
        if (activeRole === 'doctor') {
          await supabase.from('doctors').update({ profile_image: publicUrl }).eq('user_id', user.id);
        }
        DeviceEventEmitter.emit('profile_image_updated', publicUrl);
        await loadProfile();
        Toast.showSuccess('Profile picture updated!');
      }
    } catch (error: any) {
      Toast.showError(error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutVisible(false);
    await supabase.auth.signOut();
  };

  const openEdit = () => {
    setEditForm({
      full_name: profile?.full_name || '', phone: profile?.phone || '',
      date_of_birth: profile?.date_of_birth || '', gender: profile?.gender || '',
      address: profile?.address || '', state: profile?.state || '',
      hospital_name: profile?.hospital_name || '',
      hosp_type: hospitalRow?.type || '',
      hosp_phone: hospitalRow?.phone || '',
      hosp_emergency_phone: hospitalRow?.emergency_phone || '',
      hosp_address: hospitalRow?.address || '',
      hosp_city: hospitalRow?.city || '',
      hosp_lga: hospitalRow?.lga || '',
      hosp_state: hospitalRow?.state || '',
      hosp_emergency_services: hospitalRow?.emergency_services || false,
      hosp_services: Array.isArray(hospitalRow?.services) ? hospitalRow.services : [],
      title: profile?.title || 'Dr.',
      specialization: profile?.specialization || '', medical_license: profile?.medical_license || '',
      consultation_fee: profile?.consultation_fee?.toString() || '',
      consultation_fees: Object.fromEntries(
        Object.entries(profile?.consultation_fees || {}).map(([k, v]) => [k, String(v)])
      ),
      years_experience: profile?.years_experience?.toString() || '', bio: profile?.bio || '',
      // Onboarding data — pre-populated so user can review/edit
      blood_type: profile?.blood_type || '',
      height_cm: profile?.height_cm?.toString() || '',
      weight_kg: profile?.weight_kg?.toString() || '',
      emergency_contact_name: profile?.emergency_contact_name || '',
      emergency_contact_phone: profile?.emergency_contact_phone || '',
      allergies: Array.isArray(profile?.allergies) ? profile.allergies : [],
      conditions: Array.isArray(profile?.conditions) ? profile.conditions : [],
      preferred_consultation_types: Array.isArray(profile?.preferred_consultation_types) ? profile.preferred_consultation_types : [],
      nma_number: profile?.nma_number || '',
      secondary_specialty: profile?.secondary_specialty || '',
      // prefer doctorRow values (authoritative) — fall back to profiles table
      consultation_types: (doctorRow?.consultation_types || profile?.consultation_types || [])
        .map((k: string) => ({ 'In-Person': 'in_person', 'in-person': 'in_person', 'Video Call': 'video', 'Audio Call': 'audio', 'Phone Call': 'audio', 'Follow-Up': 'follow_up', 'follow-up': 'follow_up', 'Home Visit': 'in_person', 'Emergency': 'in_person' }[k] ?? k)),
      availability_days: doctorRow?.availability_days || profile?.availability_days || [],
    });
    setVitalsForm({
      heart_rate: vitals?.heart_rate?.toString() || '',
      blood_pressure: vitals?.blood_pressure || '',
      temperature: vitals?.temperature?.toString() || '',
      oxygen_saturation: vitals?.oxygen_saturation?.toString() || '',
    });
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editForm.full_name.trim()) { Toast.showError('Full name is required'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (activeRole === 'hospital_admin') {
        const profileData: any = {
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          updated_at: new Date().toISOString(),
        };
        if (editForm.hospital_name.trim()) profileData.hospital_name = editForm.hospital_name.trim();
        const { error: profErr } = await supabase.from('profiles').update(profileData).eq('id', user.id);
        if (profErr) throw profErr;
        const hospName = editForm.hospital_name.trim() || profile?.hospital_name || '';
        const hospPayload = {
          name: hospName,
          type: editForm.hosp_type || hospitalRow?.type || 'General',
          category: hospitalRow?.category || 'Private',
          address: editForm.hosp_address.trim() || hospitalRow?.address || 'Pending',
          city: editForm.hosp_city.trim() || hospitalRow?.city || 'Pending',
          state: editForm.hosp_state.trim() || hospitalRow?.state || 'Pending',
          phone: editForm.hosp_phone.trim() || null,
          lga: editForm.hosp_lga.trim() || null,
          emergency_services: editForm.hosp_emergency_services,
          services: editForm.hosp_services.length > 0 ? editForm.hosp_services : null,
          is_active: true,
        };
        if (hospitalRow?.id) {
          const { error: hospErr } = await supabase.from('hospitals').update(hospPayload).eq('id', hospitalRow.id);
          if (hospErr) throw hospErr;
        } else if (hospName) {
          const { error: hospErr } = await supabase.from('hospitals').insert({ ...hospPayload, rating: 0, total_reviews: 0 });
          if (hospErr) throw hospErr;
        }
        setEditVisible(false);
        await loadProfile();
        Toast.showSuccess('Facility profile updated!');
        return;
      }

      const profileData: any = {
        full_name: editForm.full_name.replace(/^(dr\.?|nurse\.?|prof\.?)\s+/i, '').trim(),
        phone: editForm.phone.trim() || null,
        date_of_birth: editForm.date_of_birth.trim() || null,
        gender: editForm.gender.trim() || null,
        address: editForm.address.trim() || null,
        state: editForm.state.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (activeRole === 'patient') {
        Object.assign(profileData, {
          blood_type: editForm.blood_type || null,
          height_cm: editForm.height_cm ? parseFloat(editForm.height_cm) : null,
          weight_kg: editForm.weight_kg ? parseFloat(editForm.weight_kg) : null,
          allergies: editForm.allergies.length > 0 ? editForm.allergies : null,
          conditions: editForm.conditions.length > 0 ? editForm.conditions : null,
          emergency_contact_name: editForm.emergency_contact_name.trim() || null,
          emergency_contact_phone: editForm.emergency_contact_phone.trim() || null,
          preferred_consultation_types: editForm.preferred_consultation_types.length > 0 ? editForm.preferred_consultation_types : null,
        });
      }
      if (activeRole === 'doctor') {
        Object.assign(profileData, {
          title: editForm.title.trim() || 'Dr.',
          specialization: editForm.specialization.trim() || null,
          medical_license: editForm.medical_license.trim() || null,
          consultation_fee: editForm.consultation_fee ? parseInt(editForm.consultation_fee) : null,
          consultation_fees: Object.fromEntries(
            Object.entries(editForm.consultation_fees)
              .filter(([, v]) => v.trim() !== '')
              .map(([k, v]) => [k, parseInt(v)])
          ),
          years_experience: editForm.years_experience ? parseInt(editForm.years_experience) : null,
          bio: editForm.bio.trim() || null,
          nma_number: editForm.nma_number.trim() || null,
          secondary_specialty: editForm.secondary_specialty.trim() || null,
          consultation_types: editForm.consultation_types.length > 0 ? editForm.consultation_types : null,
          availability_days: editForm.availability_days.length > 0 ? editForm.availability_days : null,
        });
      }
      const { error } = await supabase.from('profiles').update(profileData).eq('id', user.id);
      if (error) throw error;
      if (activeRole === 'doctor') {
        const { error: doctorError } = await supabase.from('doctors').upsert({
          user_id: user.id, full_name: editForm.full_name.trim(),
          title: editForm.title.trim() || 'Dr.',
          specialization: editForm.specialization.trim() || 'General Practice',
          medical_license: editForm.medical_license.trim() || 'PENDING',
          consultation_fee: editForm.consultation_fee ? parseInt(editForm.consultation_fee) : 0,
          years_experience: editForm.years_experience ? parseInt(editForm.years_experience) : 0,
          bio: editForm.bio.trim() || null, profile_image: profile?.profile_image || null,
          verification_status: 'verified', is_available: true,
          nma_number: editForm.nma_number.trim() || null,
          secondary_specialty: editForm.secondary_specialty.trim() || null,
          consultation_types: editForm.consultation_types.length > 0 ? editForm.consultation_types : null,
          availability_days: editForm.availability_days.length > 0 ? editForm.availability_days : null,
          consultation_fees: Object.fromEntries(
            Object.entries(editForm.consultation_fees)
              .filter(([, v]) => v.trim() !== '')
              .map(([k, v]) => [k, parseInt(v)])
          ),
        }, { onConflict: 'user_id' });
        if (doctorError) console.error('Doctor update error:', doctorError);
      }
      const v = vitalsForm;
      if (activeRole === 'patient' && (v.heart_rate || v.blood_pressure || v.temperature || v.oxygen_saturation)) {
        await supabase.from('vitals').insert({
          patient_id: user.id,
          heart_rate: v.heart_rate ? parseInt(v.heart_rate) : null,
          blood_pressure: v.blood_pressure.trim() || null,
          temperature: v.temperature ? parseFloat(v.temperature) : null,
          oxygen_saturation: v.oxygen_saturation ? parseInt(v.oxygen_saturation) : null,
          recorded_at: new Date().toISOString(),
        });
      }
      setEditVisible(false);
      await loadProfile();
      Toast.showSuccess('Profile updated!');
    } catch (e: any) { Toast.showError(e.message); }
    finally { setSaving(false); }
  };

  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const ALLERGY_OPTIONS = ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa Drugs', 'Latex', 'Peanuts', 'Shellfish', 'Dairy/Milk', 'Eggs', 'Gluten', 'Pollen', 'Dust', 'Pet Dander', 'None'];
  const CONDITION_OPTIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'HIV/AIDS', 'Sickle Cell', 'Cancer', 'Epilepsy', 'Arthritis', 'Kidney Disease', 'Depression', 'None'];
  const CONSULT_TYPES = [
    { key: 'audio',     label: 'Audio Call' },
    { key: 'video',     label: 'Video Call' },
    { key: 'in_person', label: 'In-Person'  },
    { key: 'follow_up', label: 'Follow-Up'  },
  ];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleArr = (item: string, arr: string[], setArr: (v: string[]) => void, exclusive?: string) => {
    if (exclusive && item === exclusive) { setArr([exclusive]); return; }
    const cleaned = exclusive ? arr.filter(i => i !== exclusive) : arr;
    if (cleaned.includes(item)) setArr(cleaned.filter(i => i !== item));
    else setArr([...cleaned, item]);
  };

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) { toast.showError('Required', 'Please write your message.'); return; }
    setFeedbackSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const record = {
        user_id: user?.id ?? null,
        user_name: profile?.full_name ?? null,
        user_type: profile?.user_type ?? null,
        category: feedbackCategory,
        message: feedbackMessage.trim(),
      };
      const { error } = await supabase.from('feedback').insert(record);
      if (error) throw error;

      // Trigger email notification directly
      await supabase.functions.invoke('notify-feedback', {
        body: { record: { ...record, created_at: new Date().toISOString() } },
      });

      setFeedbackVisible(false);
      setFeedbackMessage('');
      setFeedbackCategory('suggestion');
      toast.showSuccess('Thank you!', 'Your feedback has been received.');
    } catch (e: any) {
      toast.showError('Error', e.message ?? 'Could not send feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const patientMenuItems = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: openEdit },
    { icon: 'calendar-outline', label: 'My Appointments', onPress: () => navigation.navigate('Appointments') },
    { icon: 'documents-outline', label: 'Medical Records', onPress: () => navigation.navigate('Main', { screen: 'Records' }) },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-checkmark-outline', label: 'Privacy Settings', onPress: () => navigation.navigate('PrivacySettings') },
    { icon: 'shield-outline', label: 'Emergency SOS', onPress: () => navigation.navigate('Emergency') },
    { icon: 'chatbox-ellipses-outline', label: 'Send Feedback', onPress: () => setFeedbackVisible(true) },
    { icon: 'share-social-outline', label: 'Share Hbridge', onPress: shareApp },
  ];

  const doctorMenuItems = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: openEdit },
    { icon: 'calendar-outline', label: 'Appointments', onPress: () => navigation.navigate('DoctorAppointmentRequests') },
    { icon: 'people-outline', label: 'My Patients', onPress: () => navigation.navigate('Patients') },
    { icon: 'documents-outline', label: 'Shared Records', onPress: () => navigation.navigate('Main', { screen: 'DoctorCaseFiles' }) },
    { icon: 'business-outline', label: 'Hospital Affiliations', onPress: () => navigation.navigate('HospitalAffiliation') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-checkmark-outline', label: 'Privacy Settings', onPress: () => navigation.navigate('PrivacySettings') },
    { icon: 'chatbox-ellipses-outline', label: 'Send Feedback', onPress: () => setFeedbackVisible(true) },
    { icon: 'share-social-outline', label: 'Share My Profile', onPress: () => shareDoctor(profile) },
    { icon: 'share-outline', label: 'Share Hbridge', onPress: shareApp },
  ];

  const hospitalMenuItems = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: openEdit },
    { icon: 'folder-open-outline', label: 'Hospital Records', onPress: () => navigation.navigate('Main', { screen: 'HospitalRecords' }) },
    { icon: 'people-outline', label: 'Staff Directory', onPress: () => navigation.navigate('Main', { screen: 'HospitalStaff' }) },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-checkmark-outline', label: 'Privacy Settings', onPress: () => navigation.navigate('PrivacySettings') },
    { icon: 'chatbox-ellipses-outline', label: 'Send Feedback', onPress: () => setFeedbackVisible(true) },
    { icon: 'share-social-outline', label: 'Share Hbridge', onPress: shareApp },
  ];

  const menuItems = activeRole === 'doctor' ? doctorMenuItems : activeRole === 'hospital_admin' ? hospitalMenuItems : patientMenuItems;
  const userTypeLabel = activeRole === 'doctor' ? 'Medical Practitioner' : activeRole === 'hospital_admin' ? 'Hospital Admin' : 'Patient';
  const GENDERS = ['male', 'female'];
  const HOSPITAL_TYPES = [
    { key: 'private', label: 'Private' }, { key: 'teaching', label: 'Teaching' },
    { key: 'government', label: 'Government' }, { key: 'specialist', label: 'Specialist' },
    { key: 'state', label: 'State' }, { key: 'federal', label: 'Federal' },
  ];
  const HOSPITAL_SERVICES = [
    'Outpatient Care', 'Inpatient Care', 'Emergency Care', 'Surgery',
    'Maternity', 'Pediatrics', 'Cardiology', 'Radiology/Imaging',
    'Laboratory', 'Pharmacy', 'Physiotherapy', 'Dialysis',
    'ICU', 'Oncology', 'Dentistry', 'Ophthalmology',
    'Psychiatry', 'ENT', 'Orthopaedics', 'Telemedicine',
  ];
  const NIGERIAN_STATES = [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT (Abuja)','Gombe',
    'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
    'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers',
    'Sokoto','Taraba','Yobe','Zamfara',
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Sign Out Confirmation Modal */}
      <Modal visible={signOutVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.confirmModal}>
            <View style={s.confirmIconBox}>
              <Ionicons name="log-out-outline" size={28} color={C.red} />
            </View>
            <Text style={s.confirmTitle}>Sign Out</Text>
            <Text style={s.confirmDesc}>Are you sure you want to sign out of your account?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => setSignOutVisible(false)}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmAction} onPress={handleSignOut}>
                <Text style={s.confirmActionText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={feedbackVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.confirmModal, { padding: 0, overflow: 'hidden', width: '100%' }]}>

            {/* Header */}
            <LinearGradient colors={[C.tealHero1, C.tealHero2]} style={s.fbHeader}>
              <TouchableOpacity
                style={s.fbCloseBtn}
                onPress={() => setFeedbackVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <View style={s.fbHeaderIconWrap}>
                <Ionicons name="chatbox-ellipses" size={26} color="#fff" />
              </View>
              <Text style={s.fbHeaderTitle}>Send Feedback</Text>
              <Text style={s.fbHeaderSub}>Suggestions, improvements, or issues — we read everything</Text>
            </LinearGradient>

            <View style={{ padding: 20, gap: 16 }}>
              {/* Category chips */}
              <View>
                <Text style={s.fbLabel}>CATEGORY</Text>
                <View style={s.fbChips}>
                  {([
                    { key: 'suggestion',  label: 'Suggestion',  icon: 'bulb-outline' },
                    { key: 'improvement', label: 'Improvement', icon: 'trending-up-outline' },
                    { key: 'bug_report',  label: 'Bug Report',  icon: 'bug-outline' },
                    { key: 'general',     label: 'General',     icon: 'mail-outline' },
                  ] as const).map(({ key, label, icon }) => (
                    <TouchableOpacity
                      key={key}
                      style={[s.fbChip, feedbackCategory === key && s.fbChipActive]}
                      onPress={() => setFeedbackCategory(key)}
                    >
                      <Ionicons
                        name={icon as any}
                        size={13}
                        color={feedbackCategory === key ? C.teal : C.muted}
                      />
                      <Text style={[s.fbChipText, feedbackCategory === key && s.fbChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Message */}
              <View>
                <Text style={s.fbLabel}>MESSAGE</Text>
                <TextInput
                  style={s.fbTextarea}
                  value={feedbackMessage}
                  onChangeText={setFeedbackMessage}
                  placeholder="Describe your suggestion, improvement, or issue in detail…"
                  placeholderTextColor={C.muted2}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              {/* Buttons */}
              <View style={s.confirmBtns}>
                <TouchableOpacity style={s.confirmCancel} onPress={() => setFeedbackVisible(false)}>
                  <Text style={s.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.confirmAction, { backgroundColor: C.teal }]} onPress={submitFeedback} disabled={feedbackSubmitting}>
                  {feedbackSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.confirmActionText}>Send</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={s.editContainer} edges={['top']}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Text style={s.editCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.editTitle}>{activeRole === 'hospital_admin' ? 'Edit Facility' : 'Edit Profile'}</Text>
            <TouchableOpacity onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={s.editSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.editBody}>
            <Text style={s.fieldLbl}>{activeRole === 'hospital_admin' ? 'ADMIN NAME *' : 'FULL NAME *'}</Text>
            <TextInput style={s.fieldInput} value={editForm.full_name} onChangeText={v => setEditForm(f => ({ ...f, full_name: v }))} placeholder="Enter full name" placeholderTextColor={C.muted2} />
            {activeRole === 'doctor' && (
              <Text style={s.fieldHint}>Enter your name only — your title will be added automatically</Text>
            )}

            {activeRole === 'hospital_admin' && (
              <>
                <Text style={s.fieldLbl}>HOSPITAL NAME *</Text>
                <TextInput
                  style={s.fieldInput}
                  value={editForm.hospital_name}
                  onChangeText={v => setEditForm(f => ({ ...f, hospital_name: v }))}
                  placeholder="Enter hospital name"
                  placeholderTextColor={C.muted2}
                />
              </>
            )}

            {activeRole !== 'hospital_admin' && (
              <>
                <Text style={s.fieldLbl}>PHONE NUMBER</Text>
                <TextInput style={s.fieldInput} value={editForm.phone} onChangeText={v => setEditForm(f => ({ ...f, phone: v }))} placeholder="e.g. +2348012345678" placeholderTextColor={C.muted2} keyboardType="phone-pad" />

                <Text style={s.fieldLbl}>DATE OF BIRTH (YYYY-MM-DD)</Text>
                <TextInput style={s.fieldInput} value={editForm.date_of_birth} onChangeText={v => setEditForm(f => ({ ...f, date_of_birth: v }))} placeholder="e.g. 1990-05-20" placeholderTextColor={C.muted2} />

                <Text style={s.fieldLbl}>GENDER</Text>
                <View style={s.genderRow}>
                  {GENDERS.map(g => (
                    <TouchableOpacity key={g} style={[s.genderBtn, editForm.gender === g && s.genderBtnActive]} onPress={() => setEditForm(f => ({ ...f, gender: g }))}>
                      <Text style={[s.genderBtnText, editForm.gender === g && s.genderBtnTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLbl}>ADDRESS</Text>
                <TextInput style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]} value={editForm.address} onChangeText={v => setEditForm(f => ({ ...f, address: v }))} placeholder="Enter your address" placeholderTextColor={C.muted2} multiline />

                <Text style={s.fieldLbl}>STATE</Text>
                <TouchableOpacity style={s.stateBtn} onPress={() => setStatePickerOpen(true)}>
                  <Ionicons name="location-outline" size={16} color={editForm.state ? C.teal : C.muted2} />
                  <Text style={[s.stateBtnText, editForm.state && { color: C.ink }]}>
                    {editForm.state || 'Select state'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={C.muted2} />
                </TouchableOpacity>
              </>
            )}

            {activeRole === 'hospital_admin' && (
              <>
                <View style={s.sectionDiv}>
                  <Ionicons name="person-outline" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Admin Contact</Text>
                </View>
                <Text style={s.fieldLbl}>ADMIN PHONE</Text>
                <TextInput style={s.fieldInput} value={editForm.phone} onChangeText={v => setEditForm(f => ({ ...f, phone: v }))} placeholder="e.g. +2348012345678" placeholderTextColor={C.muted2} keyboardType="phone-pad" />

                <View style={s.sectionDiv}>
                  <MaterialCommunityIcons name="hospital-building" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Facility Details</Text>
                </View>

                <Text style={s.fieldLbl}>HOSPITAL TYPE</Text>
                <View style={s.chipWrap}>
                  {HOSPITAL_TYPES.map(t => {
                    const active = editForm.hosp_type === t.key;
                    return (
                      <TouchableOpacity key={t.key} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => setEditForm(f => ({ ...f, hosp_type: active ? '' : t.key }))}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.fieldLbl}>HOSPITAL PHONE</Text>
                <TextInput style={s.fieldInput} value={editForm.hosp_phone} onChangeText={v => setEditForm(f => ({ ...f, hosp_phone: v }))} placeholder="e.g. +2348012345678" placeholderTextColor={C.muted2} keyboardType="phone-pad" />

                <Text style={s.fieldLbl}>EMERGENCY PHONE</Text>
                <TextInput style={s.fieldInput} value={editForm.hosp_emergency_phone} onChangeText={v => setEditForm(f => ({ ...f, hosp_emergency_phone: v }))} placeholder="24/7 emergency line" placeholderTextColor={C.muted2} keyboardType="phone-pad" />

                <Text style={s.fieldLbl}>STREET ADDRESS</Text>
                <TextInput style={[s.fieldInput, { height: 72, textAlignVertical: 'top' }]} value={editForm.hosp_address} onChangeText={v => setEditForm(f => ({ ...f, hosp_address: v }))} placeholder="Enter hospital address" placeholderTextColor={C.muted2} multiline />

                <View style={s.duoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>CITY</Text>
                    <TextInput style={s.fieldInput} value={editForm.hosp_city} onChangeText={v => setEditForm(f => ({ ...f, hosp_city: v }))} placeholder="e.g. Lagos" placeholderTextColor={C.muted2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>LGA</Text>
                    <TextInput style={s.fieldInput} value={editForm.hosp_lga} onChangeText={v => setEditForm(f => ({ ...f, hosp_lga: v }))} placeholder="e.g. Ikeja" placeholderTextColor={C.muted2} />
                  </View>
                </View>

                <Text style={s.fieldLbl}>STATE</Text>
                <TouchableOpacity style={s.stateBtn} onPress={() => setStatePickerOpen(true)}>
                  <Ionicons name="location-outline" size={16} color={editForm.hosp_state ? C.teal : C.muted2} />
                  <Text style={[s.stateBtnText, editForm.hosp_state && { color: C.ink }]}>
                    {editForm.hosp_state || 'Select state'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={C.muted2} />
                </TouchableOpacity>

                <Text style={s.fieldLbl}>24/7 EMERGENCY SERVICES</Text>
                <TouchableOpacity
                  style={[s.genderBtn, { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }, editForm.hosp_emergency_services && s.genderBtnActive]}
                  onPress={() => setEditForm(f => ({ ...f, hosp_emergency_services: !f.hosp_emergency_services }))}
                >
                  <Ionicons name={editForm.hosp_emergency_services ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={editForm.hosp_emergency_services ? C.teal : C.muted2} />
                  <Text style={[s.genderBtnText, editForm.hosp_emergency_services && s.genderBtnTextActive]}>
                    {editForm.hosp_emergency_services ? 'Yes — Available 24/7' : 'No emergency services'}
                  </Text>
                </TouchableOpacity>

                <View style={s.sectionDiv}>
                  <Ionicons name="medical-outline" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Services Offered</Text>
                </View>
                <View style={s.chipWrap}>
                  {HOSPITAL_SERVICES.map(svc => {
                    const active = editForm.hosp_services.includes(svc);
                    return (
                      <TouchableOpacity key={svc} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => setEditForm(f => {
                          const next = active ? f.hosp_services.filter(s => s !== svc) : [...f.hosp_services, svc];
                          return { ...f, hosp_services: next };
                        })}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{svc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {activeRole === 'doctor' && (
              <>
                <View style={s.sectionDiv}>
                  <MaterialCommunityIcons name="stethoscope" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Professional Details</Text>
                </View>
                <Text style={s.fieldLbl}>TITLE / PREFIX</Text>
                <TextInput style={s.fieldInput} value={editForm.title} onChangeText={v => setEditForm(f => ({ ...f, title: v }))} placeholder="e.g. Dr., Prof." placeholderTextColor={C.muted2} />
                <Text style={s.fieldLbl}>SPECIALIZATION *</Text>
                <TextInput style={s.fieldInput} value={editForm.specialization} onChangeText={v => setEditForm(f => ({ ...f, specialization: v }))} placeholder="e.g. Cardiology" placeholderTextColor={C.muted2} />
                <Text style={s.fieldLbl}>SECONDARY SPECIALTY</Text>
                <TextInput style={s.fieldInput} value={editForm.secondary_specialty} onChangeText={v => setEditForm(f => ({ ...f, secondary_specialty: v }))} placeholder="e.g. Internal Medicine" placeholderTextColor={C.muted2} />
                <Text style={s.fieldLbl}>MEDICAL LICENSE NUMBER *</Text>
                <TextInput style={s.fieldInput} value={editForm.medical_license} onChangeText={v => setEditForm(f => ({ ...f, medical_license: v }))} placeholder="Your medical license number" placeholderTextColor={C.muted2} />
                <Text style={s.fieldLbl}>NMA NUMBER</Text>
                <TextInput style={s.fieldInput} value={editForm.nma_number} onChangeText={v => setEditForm(f => ({ ...f, nma_number: v }))} placeholder="e.g. NMA-12345" placeholderTextColor={C.muted2} />
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLbl}>YEARS EXPERIENCE</Text>
                  <TextInput style={s.fieldInput} value={editForm.years_experience} onChangeText={v => setEditForm(f => ({ ...f, years_experience: v }))} placeholder="e.g. 5" placeholderTextColor={C.muted2} keyboardType="numeric" />
                </View>
                <Text style={s.fieldLbl}>CONSULTATION TYPES</Text>
                <View style={s.chipWrap}>
                  {CONSULT_TYPES.map(t => {
                    const active = editForm.consultation_types.includes(t.key);
                    return (
                      <TouchableOpacity key={t.key} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => setEditForm(f => { const arr = f.consultation_types; const next = arr.includes(t.key) ? arr.filter(i => i !== t.key) : [...arr, t.key]; return { ...f, consultation_types: next }; })}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Per-type fees — only for selected types */}
                {editForm.consultation_types.length > 0 && (
                  <>
                    <Text style={s.fieldLbl}>FEES PER CONSULTATION TYPE (₦)</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2, marginBottom: 8, marginTop: -4 }}>
                      Set a price for each type. Leave blank to use the default fee.
                    </Text>
                    {CONSULT_TYPES.filter(t => editForm.consultation_types.includes(t.key)).map(t => (
                      <View key={t.key} style={s.duoRow}>
                        <View style={{ width: 100 }}>
                          <Text style={[s.fieldLbl, { marginTop: 0 }]}>{t.label.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            style={s.fieldInput}
                            value={editForm.consultation_fees[t.key] ?? ''}
                            onChangeText={v => setEditForm(f => ({ ...f, consultation_fees: { ...f.consultation_fees, [t.key]: v } }))}
                            placeholder="e.g. 5000"
                            placeholderTextColor={C.muted2}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    ))}
                    <Text style={s.fieldLbl}>DEFAULT FEE (₦) — fallback if type fee not set</Text>
                    <TextInput style={s.fieldInput} value={editForm.consultation_fee} onChangeText={v => setEditForm(f => ({ ...f, consultation_fee: v }))} placeholder="e.g. 5000" placeholderTextColor={C.muted2} keyboardType="numeric" />
                  </>
                )}
                {editForm.consultation_types.length === 0 && (
                  <>
                    <Text style={s.fieldLbl}>CONSULTATION FEE (₦)</Text>
                    <TextInput style={s.fieldInput} value={editForm.consultation_fee} onChangeText={v => setEditForm(f => ({ ...f, consultation_fee: v }))} placeholder="e.g. 5000" placeholderTextColor={C.muted2} keyboardType="numeric" />
                  </>
                )}

                <Text style={s.fieldLbl}>AVAILABLE DAYS</Text>
                <View style={s.chipWrap}>
                  {DAYS.map(d => {
                    const active = editForm.availability_days.includes(d);
                    return (
                      <TouchableOpacity key={d} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => setEditForm(f => { const arr = f.availability_days; const next = arr.includes(d) ? arr.filter(i => i !== d) : [...arr, d]; return { ...f, availability_days: next }; })}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.fieldLbl}>BIO / ABOUT</Text>
                <TextInput style={[s.fieldInput, { height: 100, textAlignVertical: 'top' }]} value={editForm.bio} onChangeText={v => setEditForm(f => ({ ...f, bio: v }))} placeholder="Tell patients about yourself..." placeholderTextColor={C.muted2} multiline />
              </>
            )}

            {activeRole === 'patient' && (
              <>
                <View style={s.sectionDiv}>
                  <Ionicons name="fitness" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Health Information</Text>
                </View>
                <Text style={s.fieldLbl}>BLOOD TYPE</Text>
                <View style={s.chipWrap}>
                  {BLOOD_TYPES.map(bt => {
                    const active = editForm.blood_type === bt;
                    return (
                      <TouchableOpacity key={bt} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => setEditForm(f => ({ ...f, blood_type: active ? '' : bt }))}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{bt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.duoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>HEIGHT (cm)</Text>
                    <TextInput style={s.fieldInput} value={editForm.height_cm} onChangeText={v => setEditForm(f => ({ ...f, height_cm: v }))} placeholder="e.g. 170" placeholderTextColor={C.muted2} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>WEIGHT (kg)</Text>
                    <TextInput style={s.fieldInput} value={editForm.weight_kg} onChangeText={v => setEditForm(f => ({ ...f, weight_kg: v }))} placeholder="e.g. 70" placeholderTextColor={C.muted2} keyboardType="decimal-pad" />
                  </View>
                </View>
                <Text style={s.fieldLbl}>ALLERGIES</Text>
                <View style={s.chipWrap}>
                  {ALLERGY_OPTIONS.map(a => {
                    const active = editForm.allergies.includes(a);
                    return (
                      <TouchableOpacity key={a} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => toggleArr(a, editForm.allergies, v => setEditForm(f => ({ ...f, allergies: v })), 'None')}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{a}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={s.fieldLbl}>MEDICAL CONDITIONS</Text>
                <View style={s.chipWrap}>
                  {CONDITION_OPTIONS.map(c => {
                    const active = editForm.conditions.includes(c);
                    return (
                      <TouchableOpacity key={c} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => toggleArr(c, editForm.conditions, v => setEditForm(f => ({ ...f, conditions: v })), 'None')}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.sectionDiv}>
                  <Ionicons name="videocam-outline" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Telemedicine Preferences</Text>
                </View>
                <Text style={s.fieldLbl}>PREFERRED CONSULTATION TYPE</Text>
                <View style={s.chipWrap}>
                  {[{key:'Video Call', label:'Video Call'}, {key:'In-Person', label:'In-Person'}, {key:'Phone Call', label:'Phone Call'}, {key:'Home Visit', label:'Home Visit'}].map(t => {
                    const active = editForm.preferred_consultation_types.includes(t.key);
                    return (
                      <TouchableOpacity key={t.key} style={[s.editChip, active && s.editChipActive]}
                        onPress={() => setEditForm(f => { const arr = f.preferred_consultation_types; const next = arr.includes(t.key) ? arr.filter(i => i !== t.key) : [...arr, t.key]; return { ...f, preferred_consultation_types: next }; })}>
                        <Text style={[s.editChipText, active && s.editChipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.sectionDiv}>
                  <Ionicons name="call-outline" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Emergency Contact</Text>
                </View>
                <Text style={s.fieldLbl}>CONTACT NAME</Text>
                <TextInput style={s.fieldInput} value={editForm.emergency_contact_name} onChangeText={v => setEditForm(f => ({ ...f, emergency_contact_name: v }))} placeholder="e.g. John Doe" placeholderTextColor={C.muted2} />
                <Text style={s.fieldLbl}>CONTACT PHONE</Text>
                <TextInput style={s.fieldInput} value={editForm.emergency_contact_phone} onChangeText={v => setEditForm(f => ({ ...f, emergency_contact_phone: v }))} placeholder="e.g. +2348012345678" placeholderTextColor={C.muted2} keyboardType="phone-pad" />
                <View style={s.sectionDiv}>
                  <Ionicons name="heart" size={14} color={C.teal} />
                  <Text style={s.sectionDivText}>Update Vitals (optional)</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.fieldLbl}>HEART RATE (BPM)</Text>
                  <Text style={s.rangeHint}>Normal: 60–100 bpm</Text>
                </View>
                <TextInput style={s.fieldInput} value={vitalsForm.heart_rate} onChangeText={v => setVitalsForm(f => ({ ...f, heart_rate: v }))} placeholder="e.g. 72" placeholderTextColor={C.muted2} keyboardType="numeric" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.fieldLbl}>BLOOD PRESSURE (mmHg)</Text>
                  <Text style={s.rangeHint}>Normal: 90/60–120/80</Text>
                </View>
                <TextInput style={s.fieldInput} value={vitalsForm.blood_pressure} onChangeText={v => setVitalsForm(f => ({ ...f, blood_pressure: v }))} placeholder="e.g. 120/80" placeholderTextColor={C.muted2} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.fieldLbl}>TEMPERATURE (°C)</Text>
                  <Text style={s.rangeHint}>Normal: 36.1–37.2 °C</Text>
                </View>
                <TextInput style={s.fieldInput} value={vitalsForm.temperature} onChangeText={v => setVitalsForm(f => ({ ...f, temperature: v }))} placeholder="e.g. 36.6" placeholderTextColor={C.muted2} keyboardType="decimal-pad" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.fieldLbl}>OXYGEN SATURATION (SpO2 %)</Text>
                  <Text style={s.rangeHint}>Normal: 95–100%</Text>
                </View>
                <TextInput style={s.fieldInput} value={vitalsForm.oxygen_saturation} onChangeText={v => setVitalsForm(f => ({ ...f, oxygen_saturation: v }))} placeholder="e.g. 98" placeholderTextColor={C.muted2} keyboardType="numeric" />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* State picker — rendered above edit modal */}
      <Modal visible={statePickerOpen} transparent animationType="slide">
        <View style={s.stateOverlay}>
          <View style={s.stateSheet}>
            <View style={s.stateSheetHeader}>
              <Text style={s.stateSheetTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStatePickerOpen(false)}>
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {NIGERIAN_STATES.map(st => {
                const currentState = activeRole === 'hospital_admin' ? editForm.hosp_state : editForm.state;
                const active = currentState === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[s.stateItem, active && s.stateItemActive]}
                    onPress={() => {
                      if (activeRole === 'hospital_admin') {
                        setEditForm(f => ({ ...f, hosp_state: st }));
                      } else {
                        setEditForm(f => ({ ...f, state: st }));
                      }
                      setStatePickerOpen(false);
                    }}
                  >
                    <Text style={[s.stateItemText, active && s.stateItemTextActive]}>{st}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={C.teal} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          {/* Background photo */}
          {profile?.profile_image
            ? <Image source={{ uri: profile.profile_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.tealHero2 }]} />
          }
          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(8,50,54,0.10)', 'rgba(8,50,54,0.55)', 'rgba(8,50,54,0.96)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Building icon when hospital_admin has no photo uploaded yet */}
          {activeRole === 'hospital_admin' && !profile?.profile_image && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 60, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' }}>
                <Ionicons name="business" size={34} color="#fff" />
              </View>
            </View>
          )}
          {(!profile?.profile_image && activeRole !== 'hospital_admin') && <View style={s.heroOrb} />}

          {/* Bottom row: name/badge left, action buttons right */}
          <View style={s.heroBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.heroBadge}>
                {activeRole === 'doctor'
                  ? <MaterialCommunityIcons name="stethoscope" size={11} color="#fff" />
                  : activeRole === 'hospital_admin'
                  ? <Ionicons name="business" size={10} color="#fff" />
                  : <Ionicons name="person" size={10} color="#fff" />}
                <Text style={s.heroBadgeText}>{userTypeLabel}</Text>
              </View>
              <Text style={s.heroName} numberOfLines={1}>
                {activeRole === 'hospital_admin'
                  ? (profile?.hospital_name || 'Set Hospital Name')
                  : (profile?.full_name || 'User')}
              </Text>
              <Text style={s.heroEmail} numberOfLines={1}>{profile?.email || ''}</Text>
              {profile?.phone ? <Text style={s.heroPhone} numberOfLines={1}>{profile.phone}</Text> : null}
              {profile?.hbridge_id ? (
                <View style={s.heroIdRow}>
                  <Ionicons name="id-card-outline" size={11} color="rgba(255,255,255,0.7)" />
                  <Text style={s.heroIdText}>{profile.hbridge_id}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.heroActions}>
              {/* Share — only for patient/doctor */}
              {activeRole !== 'hospital_admin' && (
                <TouchableOpacity
                  style={s.heroActionBtn}
                  onPress={() => activeRole === 'doctor' ? shareDoctor(profile) : shareApp()}
                >
                  <Ionicons name="share-social-outline" size={18} color="#fff" />
                </TouchableOpacity>
              )}
              {/* Camera — upload personal photo (patient/doctor) or hospital logo */}
              <TouchableOpacity style={s.heroActionBtn} onPress={uploadProfileImage} disabled={uploadingImage}>
                {uploadingImage
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera-outline" size={18} color="#fff" />}
              </TouchableOpacity>
              {/* Edit profile */}
              <TouchableOpacity style={s.heroActionBtn} onPress={openEdit}>
                <Ionicons name="create-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Paper card ── */}
        <View style={s.paperCard}>

        {/* ── Stats rail ── */}
        <View style={s.statsRail}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{counts.appointments}</Text>
            <Text style={s.statLabel}>{activeRole === 'hospital_admin' ? 'Patients' : 'Appointments'}</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{counts.records}</Text>
            <Text style={s.statLabel}>{activeRole === 'doctor' ? 'Shared Records' : activeRole === 'hospital_admin' ? 'Records' : 'Records'}</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{counts.doctors}</Text>
            <Text style={s.statLabel}>{activeRole === 'doctor' ? 'Patients' : activeRole === 'hospital_admin' ? 'Practitioners' : 'Consultations'}</Text>
          </View>
        </View>

        {/* ── Switch account card (multi-role users only) ── */}
        {((profile?.user_types as string[] | null) ?? []).some(r => r === 'doctor' || r === 'hospital_admin') &&
         ((profile?.user_types as string[] | null)?.length ?? 0) > 1 && (
          <TouchableOpacity
            style={s.switchAccountCard}
            onPress={() => DeviceEventEmitter.emit('show_role_picker')}
            activeOpacity={0.85}
          >
            <View style={s.switchAccountLeft}>
              <View style={s.switchAccountIconRing}>
                <Ionicons name="swap-horizontal" size={20} color={C.gold} />
              </View>
              <View>
                <Text style={s.switchAccountTitle}>Switch Account</Text>
                <Text style={s.switchAccountSub}>
                  Active: <Text style={{ color: C.gold, fontFamily: 'Montserrat_600SemiBold' }}>
                    {activeRole === 'hospital_admin' ? 'Hospital Admin' : activeRole === 'doctor' ? 'Practitioner' : 'Patient'}
                  </Text>
                </Text>
              </View>
            </View>
            <View style={s.switchAccountArrow}>
              <Ionicons name="chevron-forward" size={16} color={C.gold} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Vitals card (patients only) ── */}
        {activeRole === 'patient' && (
          <LinearGradient colors={[C.tealHero1, C.tealHero2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.vitalsCard}>
            <Text style={s.vitalsHeading}>CURRENT VITALS</Text>
            <View style={s.vitalsRow}>
              {[
                { icon: 'heart', val: vitals?.heart_rate ?? '--', lbl: 'BPM' },
                { icon: 'speedometer-outline', val: vitals?.blood_pressure ?? '--', lbl: 'BP' },
                { icon: 'thermometer-outline', val: vitals?.temperature ?? '--', lbl: 'Temp °C' },
                { icon: 'water-outline', val: vitals?.oxygen_saturation ?? '--', lbl: 'SpO2 %' },
              ].map((v, i) => (
                <View key={i} style={s.vitalItem}>
                  <Ionicons name={v.icon as any} size={15} color="rgba(255,255,255,0.8)" />
                  <Text style={s.vitalVal}>{v.val}</Text>
                  <Text style={s.vitalLbl}>{v.lbl}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        )}

        {/* ── Patient health summary card ── */}
        {activeRole === 'patient' && (profile?.blood_type || profile?.height_cm || Array.isArray(profile?.allergies) && profile.allergies.length > 0 || Array.isArray(profile?.conditions) && profile.conditions.length > 0 || profile?.emergency_contact_name) && (
          <View style={s.doctorCard}>
            {profile?.blood_type && (
              <View style={s.docInfoRow}>
                <View style={s.docInfoIcon}><Ionicons name="water" size={16} color={C.teal} /></View>
                <Text style={s.docInfoLabel}>Blood Type</Text>
                <Text style={s.docInfoValue}>{profile.blood_type}</Text>
              </View>
            )}
            {(profile?.height_cm || profile?.weight_kg) && (
              <>
                <View style={s.rowDiv} />
                <View style={s.docInfoRow}>
                  <View style={s.docInfoIcon}><Ionicons name="body" size={16} color={C.teal} /></View>
                  <Text style={s.docInfoLabel}>Height / Weight</Text>
                  <Text style={s.docInfoValue}>
                    {profile?.height_cm ? `${profile.height_cm}cm` : '--'} / {profile?.weight_kg ? `${profile.weight_kg}kg` : '--'}
                  </Text>
                </View>
              </>
            )}
            {Array.isArray(profile?.allergies) && profile.allergies.length > 0 && (
              <>
                <View style={s.rowDiv} />
                <View style={s.docInfoRow}>
                  <View style={s.docInfoIcon}><Ionicons name="alert-circle" size={16} color={C.teal} /></View>
                  <Text style={s.docInfoLabel}>Allergies</Text>
                  <Text style={[s.docInfoValue, { fontSize: 11 }]} numberOfLines={2}>{profile.allergies.join(', ')}</Text>
                </View>
              </>
            )}
            {Array.isArray(profile?.conditions) && profile.conditions.length > 0 && (
              <>
                <View style={s.rowDiv} />
                <View style={s.docInfoRow}>
                  <View style={s.docInfoIcon}><MaterialCommunityIcons name="pill" size={16} color={C.teal} /></View>
                  <Text style={s.docInfoLabel}>Conditions</Text>
                  <Text style={[s.docInfoValue, { fontSize: 11 }]} numberOfLines={2}>{profile.conditions.join(', ')}</Text>
                </View>
              </>
            )}
            {Array.isArray(profile?.preferred_consultation_types) && profile.preferred_consultation_types.length > 0 && (
              <>
                <View style={s.rowDiv} />
                <View style={s.docInfoRow}>
                  <View style={s.docInfoIcon}><Ionicons name="videocam-outline" size={16} color={C.teal} /></View>
                  <Text style={s.docInfoLabel}>Prefers</Text>
                  <Text style={[s.docInfoValue, { fontSize: 11 }]} numberOfLines={2}>{profile.preferred_consultation_types.join(' · ')}</Text>
                </View>
              </>
            )}
            {profile?.emergency_contact_name && (
              <>
                <View style={s.rowDiv} />
                <View style={s.docInfoRow}>
                  <View style={s.docInfoIcon}><Ionicons name="call" size={16} color={C.teal} /></View>
                  <Text style={s.docInfoLabel}>Emergency</Text>
                  <Text style={s.docInfoValue} numberOfLines={1}>{profile.emergency_contact_name}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Doctor professional info card ── */}
        {activeRole === 'doctor' && (
          <View style={s.doctorCard}>
            {[
              { icon: 'stethoscope', label: 'Specialization', value: profile?.specialization || 'Not set', mat: true },
              profile?.secondary_specialty && { icon: 'stethoscope', label: 'Secondary', value: profile.secondary_specialty, mat: true },
              { icon: 'card-outline', label: 'License', value: profile?.medical_license || 'Not set', mat: false },
              profile?.nma_number && { icon: 'document-text-outline', label: 'NMA No.', value: profile.nma_number, mat: false },
              { icon: 'cash-outline', label: 'Consultation Fee', value: profile?.consultation_fee ? `₦${Number(profile.consultation_fee).toLocaleString()}` : 'Contact for fee', mat: false },
              { icon: 'time-outline', label: 'Experience', value: profile?.years_experience ? `${profile.years_experience} years` : 'Not set', mat: false },
              profile?.consultation_types?.length && { icon: 'videocam-outline', label: 'Consults via', value: profile.consultation_types.map((k: string) => CONSULT_TYPES.find(t => t.key === k)?.label ?? k).join(', '), mat: false },
              profile?.availability_days?.length && { icon: 'calendar-outline', label: 'Available', value: profile.availability_days.join(', '), mat: false },
              profile?.bio && { icon: 'information-circle-outline', label: 'About', value: profile.bio, mat: false, last: true },
            ].filter(Boolean).map((item: any, i, arr) => (
              <View key={i}>
                <View style={s.docInfoRow}>
                  <View style={s.docInfoIcon}>
                    {item.mat
                      ? <MaterialCommunityIcons name={item.icon} size={16} color={C.teal} />
                      : <Ionicons name={item.icon} size={16} color={C.teal} />}
                  </View>
                  <Text style={s.docInfoLabel}>{item.label}</Text>
                  <Text style={[s.docInfoValue, { fontSize: item.value.length > 20 ? 11 : 13 }]} numberOfLines={2}>{item.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.rowDiv} />}
              </View>
            ))}
          </View>
        )}

        {/* ── Payout account card (doctors only) ── */}
        {activeRole === 'doctor' && (
          <View style={s.doctorCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: doctorRow?.paystack_subaccount ? 'rgba(11,126,138,0.09)' : 'rgba(212,168,67,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={doctorRow?.paystack_subaccount ? 'wallet-outline' : 'wallet-outline'} size={17} color={doctorRow?.paystack_subaccount ? C.teal : C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C.ink }}>Payout Account</Text>
                  {doctorRow?.paystack_subaccount ? (
                    <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 }}>
                      {NIGERIAN_BANKS.find(b => b.code === doctorRow?.bank_code)?.name || 'Bank'} · ****{doctorRow.account_number?.slice(-4)}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.gold, marginTop: 2 }}>
                      Not set up — patients can book but you won't receive automatic payouts
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: doctorRow?.paystack_subaccount ? C.tealLight : 'rgba(212,168,67,0.12)', borderWidth: 1, borderColor: doctorRow?.paystack_subaccount ? 'rgba(11,126,138,0.2)' : 'rgba(212,168,67,0.3)' }}
                onPress={openPayoutModal}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontFamily: 'Montserrat_700Bold', color: doctorRow?.paystack_subaccount ? C.teal : C.gold }}>
                  {doctorRow?.paystack_subaccount ? 'Update' : 'Set Up'}
                </Text>
              </TouchableOpacity>
            </View>
            {doctorRow?.paystack_subaccount && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <View style={{ backgroundColor: 'rgba(11,126,138,0.06)', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={14} color={C.teal} />
                  <Text style={{ fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, flex: 1 }}>
                    85% of each consultation fee is automatically sent to your account. Hbridge retains 15%.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Payout modal ── */}
        <Modal visible={payoutVisible} animationType="slide" transparent onRequestClose={() => setPayoutVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,50,54,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }}>
              {/* Modal header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 }}>
                <Text style={{ fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.ink }}>Payout Account</Text>
                <TouchableOpacity onPress={() => setPayoutVisible(false)} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EDE9E0', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color={C.ink} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, paddingHorizontal: 20, paddingBottom: 16 }}>
                Enter the bank account where you want to receive your 85% consultation fee payouts.
              </Text>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
                {/* Bank search */}
                <View>
                  <Text style={{ fontSize: 10.5, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 1, marginBottom: 8 }}>SELECT BANK</Text>
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EAE5DA', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Ionicons name="search-outline" size={16} color={C.muted} />
                    <TextInput
                      style={{ flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.ink }}
                      placeholder="Search bank..."
                      placeholderTextColor={C.muted}
                      value={bankSearch}
                      onChangeText={v => { setBankSearch(v); setVerifiedName(''); }}
                    />
                  </View>
                  {payoutBank && (
                    <View style={{ backgroundColor: 'rgba(11,126,138,0.09)', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Ionicons name="checkmark-circle" size={16} color={C.teal} />
                      <Text style={{ fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.teal }}>{payoutBank.name}</Text>
                    </View>
                  )}
                  <View style={{ maxHeight: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EAE5DA', overflow: 'hidden' }}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredBanks.map((bank, i) => (
                        <TouchableOpacity
                          key={bank.code}
                          style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i < filteredBanks.length - 1 ? 1 : 0, borderColor: '#EAE5DA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: payoutBank?.code === bank.code ? 'rgba(11,126,138,0.06)' : 'transparent' }}
                          onPress={() => { setPayoutBank(bank); setBankSearch(''); setVerifiedName(''); }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.ink }}>{bank.name}</Text>
                          {payoutBank?.code === bank.code && <Ionicons name="checkmark" size={16} color={C.teal} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Account number */}
                <View>
                  <Text style={{ fontSize: 10.5, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 1, marginBottom: 8 }}>ACCOUNT NUMBER</Text>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: verifiedName ? C.teal : '#EAE5DA', padding: 14, fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.ink, letterSpacing: 2 }}
                    value={payoutAcct}
                    onChangeText={v => { setPayoutAcct(v.replace(/\D/g, '')); setVerifiedName(''); }}
                    placeholder="0000000000"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  {verifiedName ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(11,126,138,0.07)', borderRadius: 8, padding: 10 }}>
                      <Ionicons name="person-circle-outline" size={16} color={C.teal} />
                      <Text style={{ fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C.teal }}>{verifiedName}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Verify button */}
                {!verifiedName && (
                  <TouchableOpacity
                    style={{ backgroundColor: '#EDE9E0', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                    onPress={verifyAccount}
                    disabled={verifying}
                    activeOpacity={0.8}
                  >
                    {verifying
                      ? <ActivityIndicator color={C.teal} />
                      : <>
                          <Ionicons name="shield-checkmark-outline" size={16} color={C.teal} />
                          <Text style={{ fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.teal }}>Verify Account</Text>
                        </>}
                  </TouchableOpacity>
                )}

                {/* Save button */}
                {verifiedName ? (
                  <TouchableOpacity
                    style={{ backgroundColor: C.teal, borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                    onPress={savePayout}
                    disabled={payoutSaving}
                    activeOpacity={0.85}
                  >
                    {payoutSaving
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                          <Text style={{ fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' }}>Save Payout Account</Text>
                        </>}
                  </TouchableOpacity>
                ) : null}

                <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 16 }}>
                  By saving, you agree that Hbridge retains 15% of each consultation fee as a platform service charge. Payouts are processed by Paystack on the next business day.
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Menu ── */}
        <View style={s.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[s.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }]}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              <View style={s.menuIconBox}>
                <Ionicons name={item.icon as any} size={19} color={C.teal} />
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={17} color={C.muted2} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={s.signOutBtn} onPress={() => setSignOutVisible(true)} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={s.versionContainer}>
          <Text style={s.versionText}>Hbridge v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>

        <View style={{ height: 100 }} />
        </View>{/* end paperCard */}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.tealHero2 },

  paperCard: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Hero
  hero: {
    overflow: 'hidden',
    backgroundColor: C.tealHero2,
    minHeight: 320,
    justifyContent: 'flex-end',
  },
  heroOrb: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -100, right: -80,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    flexShrink: 0,
    paddingBottom: 4,
  },
  heroActionBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroName: { fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3, marginTop: 4 },
  heroEmail: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.68)', marginTop: 3 },
  heroPhone: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  heroIdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  heroIdText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,168,67,0.22)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.5)',
    marginBottom: 6,
  },
  heroBadgeText: { fontSize: 11.5, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Stats rail
  statsRail: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 5,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 20, fontFamily: 'Montserrat_800ExtraBold', color: C.ink },
  statLabel: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  statDiv: { width: 1, height: 36, backgroundColor: C.cardBorder },

  switchAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(212,168,67,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.28)',
  },
  switchAccountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchAccountIconRing: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(212,168,67,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  switchAccountTitle: { fontSize: 13.5, fontFamily: 'Montserrat_700Bold', color: C.ink, marginBottom: 2 },
  switchAccountSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  switchAccountArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(212,168,67,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Vitals card
  vitalsCard: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
  },
  vitalsHeading: { fontSize: 10.5, fontFamily: 'Montserrat_700Bold', color: 'rgba(255,255,255,0.8)', letterSpacing: 1.2, marginBottom: 14 },
  vitalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  vitalItem: { alignItems: 'center', gap: 4 },
  vitalVal: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  vitalLbl: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.7)' },

  // Doctor card
  doctorCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingVertical: 4,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  docInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  docInfoIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(11,126,138,0.1)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  docInfoLabel: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, flex: 1 },
  docInfoValue: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary, flex: 2, textAlign: 'right' },
  rowDiv: { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 14 },

  // Menu card
  menuCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder, gap: 14,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(11,126,138,0.09)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14.5, fontFamily: 'Montserrat_500Medium', color: C.textPrimary },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 20, marginTop: 12,
    backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  signOutText: { fontSize: 14.5, fontFamily: 'Montserrat_700Bold', color: C.red },

  versionContainer: { alignItems: 'center', marginTop: 20, marginBottom: 4 },
  versionText: { fontSize: 12, fontFamily: 'Montserrat_500Medium', color: C.muted, letterSpacing: 0.3 },

  // Edit modal
  editContainer: { flex: 1, backgroundColor: C.paper },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
    backgroundColor: C.card,
  },
  editTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  editCancel: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  editSave: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.teal },
  editBody: { padding: 20, gap: 6, paddingBottom: 60 },
  fieldLbl: { fontSize: 11, fontFamily: 'Montserrat_700Bold', color: C.muted, marginTop: 16, marginBottom: 5, letterSpacing: 0.8 },
  fieldHint: { fontSize: 11, fontFamily: 'Montserrat_400Regular', color: C.muted, marginTop: 4, marginLeft: 2 },
  rangeHint: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, marginTop: 16, marginBottom: 5 },
  fieldInput: {
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  genderRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  genderBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center', backgroundColor: C.card },
  genderBtnActive: { backgroundColor: C.teal, borderColor: C.teal },
  genderBtnText: { fontSize: 14, fontFamily: 'Montserrat_500Medium', color: C.textPrimary },
  genderBtnTextActive: { color: '#fff' },
  sectionDiv: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.cardBorder, marginBottom: 4 },
  sectionDivText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  editChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.card },
  editChipActive: { backgroundColor: 'rgba(11,126,138,0.1)', borderColor: C.teal },
  editChipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary },
  editChipTextActive: { fontFamily: 'SpaceGrotesk_500Medium', color: C.teal },
  duoRow: { flexDirection: 'row', gap: 12, marginTop: 4 },

  // State picker
  stateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  stateBtnText: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },
  stateOverlay: { flex: 1, backgroundColor: 'rgba(8,50,54,0.55)', justifyContent: 'flex-end' },
  stateSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '72%', paddingTop: 8,
  },
  stateSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  stateSheetTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.ink },
  stateItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  stateItemActive: { backgroundColor: 'rgba(11,126,138,0.08)' },
  stateItemText: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.ink },
  stateItemTextActive: { color: C.teal, fontFamily: 'SpaceGrotesk_500Medium' },

  // Confirm sign-out modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  confirmModal: {
    backgroundColor: C.card, borderRadius: 24,
    padding: 28, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 16,
  },
  confirmIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  confirmTitle: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: C.textPrimary },
  confirmDesc: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center', backgroundColor: C.paper },
  confirmCancelText: { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  confirmAction: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: C.red, alignItems: 'center' },
  confirmActionText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  // Feedback modal
  fbHeader:        { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20 },
  fbCloseBtn:      { position: 'absolute', top: 14, right: 16, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  fbHeaderIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  fbHeaderTitle:   { fontSize: 18, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', marginBottom: 4 },
  fbHeaderSub:     { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 18 },
  fbLabel:         { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 1, marginBottom: 8 },
  fbChips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fbChip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.paper },
  fbChipActive:    { borderColor: C.teal, backgroundColor: C.tealLight },
  fbChipText:      { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  fbChipTextActive:{ color: C.teal, fontFamily: 'Montserrat_600SemiBold' },
  fbTextarea:      {
    backgroundColor: C.paper, borderRadius: 14, borderWidth: 1.5, borderColor: C.cardBorder,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary,
    minHeight: 120,
  },
});
