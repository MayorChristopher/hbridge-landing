import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, Image,
  RefreshControl, Modal, TextInput, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Toast } from '../utils/toast';
import { useToast } from '../components/ToastProvider';

const C = {
  paper: '#F5F3EE', paperDark: '#EDE9E0', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', tealHero1: '#0C6570', tealHero2: '#083236',
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
  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', date_of_birth: '', gender: '', address: '',
    title: '', specialization: '', medical_license: '', consultation_fee: '', years_experience: '', bio: '',
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

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { count: apptCount }, { count: recCount }, { count: docCount }, { data: vitalsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('patient_id', user.id),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('patient_id', user.id),
        supabase.from('vitals').select('*').eq('patient_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setProfile(prof);
      setCounts({ appointments: apptCount || 0, records: recCount || 0, doctors: docCount || 0 });
      setVitals(vitalsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadProfile(); setRefreshing(false); };

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
        if (profile?.user_type === 'doctor') {
          await supabase.from('doctors').update({ profile_image: publicUrl }).eq('user_id', user.id);
        }
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
      address: profile?.address || '', title: profile?.title || 'Dr.',
      specialization: profile?.specialization || '', medical_license: profile?.medical_license || '',
      consultation_fee: profile?.consultation_fee?.toString() || '',
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
      consultation_types: profile?.consultation_types || [],
      availability_days: profile?.availability_days || [],
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
      const profileData: any = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        date_of_birth: editForm.date_of_birth.trim() || null,
        gender: editForm.gender.trim() || null,
        address: editForm.address.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (profile?.user_type === 'patient') {
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
      if (profile?.user_type === 'doctor') {
        Object.assign(profileData, {
          title: editForm.title.trim() || 'Dr.',
          specialization: editForm.specialization.trim() || null,
          medical_license: editForm.medical_license.trim() || null,
          consultation_fee: editForm.consultation_fee ? parseInt(editForm.consultation_fee) : null,
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
      if (profile?.user_type === 'doctor') {
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
        }, { onConflict: 'user_id' });
        if (doctorError) console.error('Doctor update error:', doctorError);
      }
      const v = vitalsForm;
      if (profile?.user_type === 'patient' && (v.heart_rate || v.blood_pressure || v.temperature || v.oxygen_saturation)) {
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
    { key: 'video', label: 'Video' },
    { key: 'audio', label: 'Audio' },
    { key: 'in-person', label: 'In-Person' },
    { key: 'home-visit', label: 'Home Visit' },
  ];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleArr = (item: string, arr: string[], setArr: (v: string[]) => void, exclusive?: string) => {
    if (exclusive && item === exclusive) { setArr([exclusive]); return; }
    const cleaned = exclusive ? arr.filter(i => i !== exclusive) : arr;
    if (cleaned.includes(item)) setArr(cleaned.filter(i => i !== item));
    else setArr([...cleaned, item]);
  };

  const patientMenuItems = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: openEdit },
    { icon: 'calendar-outline', label: 'My Appointments', onPress: () => navigation.navigate('Appointments') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-checkmark-outline', label: 'Privacy Settings', onPress: () => navigation.navigate('PrivacySettings') },
    { icon: 'shield-outline', label: 'Emergency SOS', onPress: () => navigation.navigate('Emergency') },
  ];

  const doctorMenuItems = [
    { icon: 'person-outline', label: 'Edit Profile', onPress: openEdit },
    { icon: 'calendar-outline', label: 'Appointments', onPress: () => navigation.navigate('DoctorAppointmentRequests') },
    { icon: 'people-outline', label: 'My Patients', onPress: () => navigation.navigate('Patients') },
    { icon: 'documents-outline', label: 'Shared Records', onPress: () => navigation.navigate('DoctorCaseFiles') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-checkmark-outline', label: 'Privacy Settings', onPress: () => navigation.navigate('PrivacySettings') },
  ];

  const menuItems = profile?.user_type === 'doctor' ? doctorMenuItems : patientMenuItems;
  const userTypeLabel = profile?.user_type === 'doctor' ? 'Doctor' : profile?.user_type === 'hospital_admin' ? 'Hospital Admin' : 'Patient';
  const GENDERS = ['male', 'female'];

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

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={s.editContainer} edges={['top']}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={() => setEditVisible(false)}>
              <Text style={s.editCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.editTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={saveEdit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={s.editSave}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.editBody}>
            <Text style={s.fieldLbl}>FULL NAME *</Text>
            <TextInput style={s.fieldInput} value={editForm.full_name} onChangeText={v => setEditForm(f => ({ ...f, full_name: v }))} placeholder="Enter full name" placeholderTextColor={C.muted2} />

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

            {profile?.user_type === 'doctor' && (
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
                <View style={s.duoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>CONSULTATION FEE (₦)</Text>
                    <TextInput style={s.fieldInput} value={editForm.consultation_fee} onChangeText={v => setEditForm(f => ({ ...f, consultation_fee: v }))} placeholder="e.g. 5000" placeholderTextColor={C.muted2} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>YEARS EXPERIENCE</Text>
                    <TextInput style={s.fieldInput} value={editForm.years_experience} onChangeText={v => setEditForm(f => ({ ...f, years_experience: v }))} placeholder="e.g. 5" placeholderTextColor={C.muted2} keyboardType="numeric" />
                  </View>
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

            {profile?.user_type === 'patient' && (
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.heroOrb} />

          {/* Edit button top-right */}
          <TouchableOpacity style={s.editBtn} onPress={openEdit}>
            <Ionicons name="create-outline" size={17} color="#fff" />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={s.avatarWrap}>
            <View style={s.avatarRing}>
              {profile?.profile_image
                ? <Image source={{ uri: profile.profile_image }} style={s.avatarImg} />
                : <View style={s.avatarFallback}>
                    {profile?.user_type === 'doctor'
                      ? <MaterialCommunityIcons name="stethoscope" size={36} color={C.teal} />
                      : <Ionicons name="person" size={36} color={C.teal} />}
                  </View>}
            </View>
            <TouchableOpacity style={s.cameraBtn} onPress={uploadProfileImage} disabled={uploadingImage}>
              {uploadingImage
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />}
            </TouchableOpacity>
          </View>

          {/* Name + type badge */}
          <Text style={s.heroName}>{profile?.full_name || 'User'}</Text>
          <Text style={s.heroEmail}>{profile?.email || ''}</Text>
          {profile?.phone ? (
            <Text style={s.heroPhone}>{profile.phone}</Text>
          ) : null}
          <View style={s.heroBadge}>
            {profile?.user_type === 'doctor'
              ? <MaterialCommunityIcons name="stethoscope" size={11} color="#fff" />
              : <Ionicons name="person" size={10} color="#fff" />}
            <Text style={s.heroBadgeText}>{userTypeLabel}</Text>
          </View>
        </View>

        {/* ── Paper card ── */}
        <View style={s.paperCard}>

        {/* ── Stats rail ── */}
        <View style={s.statsRail}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{counts.appointments}</Text>
            <Text style={s.statLabel}>Appointments</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{counts.records}</Text>
            <Text style={s.statLabel}>Records</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{counts.doctors}</Text>
            <Text style={s.statLabel}>Consultations</Text>
          </View>
        </View>

        {/* ── Vitals card (patients only) ── */}
        {profile?.user_type !== 'doctor' && (
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
        {profile?.user_type === 'patient' && (profile?.blood_type || profile?.height_cm || Array.isArray(profile?.allergies) && profile.allergies.length > 0 || Array.isArray(profile?.conditions) && profile.conditions.length > 0 || profile?.emergency_contact_name) && (
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
        {profile?.user_type === 'doctor' && (
          <View style={s.doctorCard}>
            {[
              { icon: 'stethoscope', label: 'Specialization', value: profile?.specialization || 'Not set', mat: true },
              profile?.secondary_specialty && { icon: 'stethoscope', label: 'Secondary', value: profile.secondary_specialty, mat: true },
              { icon: 'card-outline', label: 'License', value: profile?.medical_license || 'Not set', mat: false },
              profile?.nma_number && { icon: 'document-text-outline', label: 'NMA No.', value: profile.nma_number, mat: false },
              { icon: 'cash-outline', label: 'Consultation Fee', value: profile?.consultation_fee ? `₦${Number(profile.consultation_fee).toLocaleString()}` : 'Contact for fee', mat: false },
              { icon: 'time-outline', label: 'Experience', value: profile?.years_experience ? `${profile.years_experience} years` : 'Not set', mat: false },
              profile?.consultation_types?.length && { icon: 'videocam-outline', label: 'Consults via', value: profile.consultation_types.join(', '), mat: false },
              profile?.availability_days?.length && { icon: 'calendar-outline', label: 'Available', value: profile.availability_days.join(', '), mat: false, last: true },
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

        <View style={{ height: 40 }} />
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
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: C.tealHero2,
  },
  heroOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -70,
    right: -40,
  },
  editBtn: {
    alignSelf: 'flex-end',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 28,
    borderWidth: 3, borderColor: C.gold,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#E7F1F0',
  },
  avatarImg: { width: 96, height: 96 },
  avatarFallback: { width: 96, height: 96, borderRadius: 28, backgroundColor: '#E7F1F0', alignItems: 'center', justifyContent: 'center' },
  cameraBtn: {
    position: 'absolute', bottom: -2, right: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.tealHero2,
  },
  heroName: { fontSize: 21, fontFamily: 'Montserrat_700Bold', color: '#fff', textAlign: 'center', letterSpacing: -0.3 },
  heroEmail: { fontSize: 12.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 3, textAlign: 'center' },
  heroPhone: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.55)', marginTop: 2, textAlign: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, backgroundColor: 'rgba(212,168,67,0.25)',
    borderRadius: 100, paddingHorizontal: 13, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.4)',
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

  // Confirm sign-out modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 28 },
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
});
