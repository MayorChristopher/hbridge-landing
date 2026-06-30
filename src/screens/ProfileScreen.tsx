import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, Modal, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Toast } from '../utils/toast';

const C = { bg:'#FFFFFF', surface:'#F5F7FA', text:'#171717', muted:'#555F6D', border:'#E2E8EF', teal:'#0B7E8A', tealDark:'#005F63' };

export default function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vitals, setVitals] = useState<any>(null);
  const [counts, setCounts] = useState({ appointments: 0, records: 0, doctors: 0 });
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({ 
    full_name: '', phone: '', date_of_birth: '', gender: '', address: '',
    // Doctor fields
    title: '', specialization: '', medical_license: '', consultation_fee: '', years_experience: '', bio: ''
  });
  const [vitalsForm, setVitalsForm] = useState({ heart_rate: '', blood_pressure: '', temperature: '', oxygen_saturation: '' });
  const [saving, setSaving] = useState(false);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { count: apptCount }, { count: recCount }, { count: docCount }, { data: vitalsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('patient_id', user.id),
        supabase.from('medical_records').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('patient_id', user.id),
        supabase.from('vitals').select('*').eq('patient_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setProfile(prof);
      setCounts({ appointments: apptCount || 0, records: recCount || 0, doctors: docCount || 0 });
      setVitals(vitalsData);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadProfile(); setRefreshing(false); };

  const uploadProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to upload profile picture');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
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
        formData.append('file', {
          uri: asset.uri,
          name: fileName,
          type: `image/${fileExt}`,
        } as any);

        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const supabaseUrl = (supabase as any).supabaseUrl as string;
        
        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${filePath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-upsert': 'true',
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload failed');
        }

        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);

        const { error } = await supabase.from('profiles').update({
          profile_image: publicUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);

        if (error) throw error;

        if (profile?.user_type === 'doctor') {
          await supabase.from('doctors').update({
            profile_image: publicUrl,
          }).eq('user_id', user.id);
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
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      date_of_birth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      address: profile?.address || '',
      // Doctor fields
      title: profile?.title || 'Dr.',
      specialization: profile?.specialization || '',
      medical_license: profile?.medical_license || '',
      consultation_fee: profile?.consultation_fee?.toString() || '',
      years_experience: profile?.years_experience?.toString() || '',
      bio: profile?.bio || '',
    });
    setVitalsForm({ heart_rate: '', blood_pressure: '', temperature: '', oxygen_saturation: '' });
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editForm.full_name.trim()) { Toast.showError('Full name is required'); return; }
    setSaving(true);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Update profile
      const profileData = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        date_of_birth: editForm.date_of_birth.trim() || null,
        gender: editForm.gender.trim() || null,
        address: editForm.address.trim() || null,
        updated_at: new Date().toISOString(),
      };
      
      // Add doctor fields if user is a doctor
      if (profile?.user_type === 'doctor') {
        Object.assign(profileData, {
          title: editForm.title.trim() || 'Dr.',
          specialization: editForm.specialization.trim() || null,
          medical_license: editForm.medical_license.trim() || null,
          consultation_fee: editForm.consultation_fee ? parseInt(editForm.consultation_fee) : null,
          years_experience: editForm.years_experience ? parseInt(editForm.years_experience) : null,
          bio: editForm.bio.trim() || null,
        });
      }
      
      const { error } = await supabase.from('profiles').update(profileData).eq('id', user.id);
      if (error) throw error;
      
      // Update doctors table if user is a doctor
      if (profile?.user_type === 'doctor') {
        const { error: doctorError } = await supabase.from('doctors').upsert({
          user_id: user.id,
          full_name: editForm.full_name.trim(),
          title: editForm.title.trim() || 'Dr.',
          specialization: editForm.specialization.trim() || 'General Practice',
          medical_license: editForm.medical_license.trim() || 'PENDING',
          consultation_fee: editForm.consultation_fee ? parseInt(editForm.consultation_fee) : 0,
          years_experience: editForm.years_experience ? parseInt(editForm.years_experience) : 0,
          bio: editForm.bio.trim() || null,
          profile_image: profile?.profile_image || null,
          verification_status: 'verified',
          is_available: true,
          average_rating: 0,
          total_reviews: 0,
        }, { onConflict: 'user_id' });
        
        if (doctorError) console.error('Doctor update error:', doctorError);
      }
      
      // Handle vitals for patients
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

  const patientMenuItems = [
    { icon:'person-outline', label:'Edit Profile', onPress: openEdit },
    { icon:'calendar-outline', label:'My Appointments', onPress:() => navigation.navigate('Appointments') },
    { icon:'document-text-outline', label:'Medical Records', onPress:() => navigation.navigate('MedicalRecords') },
    { icon:'notifications-outline', label:'Notifications', onPress:() => navigation.navigate('Notifications') },
    { icon:'shield-checkmark-outline', label:'Privacy Settings', onPress:() => navigation.navigate('PrivacySettings') },
    { icon:'shield-outline', label:'Emergency SOS', onPress:() => navigation.navigate('Emergency') },
  ];

  const doctorMenuItems = [
    { icon:'person-outline', label:'Edit Profile', onPress: openEdit },
    { icon:'calendar-outline', label:'Appointments', onPress:() => navigation.navigate('DoctorAppointmentRequests') },
    { icon:'people-outline', label:'My Patients', onPress:() => navigation.navigate('Patients') },
    { icon:'documents-outline', label:'Shared Records', onPress:() => navigation.navigate('DoctorCaseFiles') },
    { icon:'notifications-outline', label:'Notifications', onPress:() => navigation.navigate('Notifications') },
    { icon:'shield-checkmark-outline', label:'Privacy Settings', onPress:() => navigation.navigate('PrivacySettings') },
  ];

  const menuItems = profile?.user_type === 'doctor' ? doctorMenuItems : patientMenuItems;

  const GENDERS = ['male', 'female'];
  const userTypeLabel = profile?.user_type === 'doctor' ? 'Doctor' : profile?.user_type === 'hospital_admin' ? 'Hospital Admin' : 'Patient';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

        {/* Sign Out Confirmation Modal */}
        <Modal visible={signOutVisible} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.confirmModal}>
              <View style={s.confirmHandle} />
              <View style={s.confirmIconBox}>
                <Ionicons name="log-out-outline" size={28} color="#EF4444" />
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
          <SafeAreaView style={s.modalContainer} edges={['top']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={saveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={C.teal} /> : <Text style={s.modalSave}>Save</Text>}
              </TouchableOpacity>
            </View>
          <ScrollView contentContainerStyle={s.modalBody}>
            <Text style={s.fieldLabel}>FULL NAME *</Text>
            <TextInput style={s.fieldInput} value={editForm.full_name}
              onChangeText={v => setEditForm(f => ({...f, full_name: v}))}
              placeholder="Enter full name" placeholderTextColor={C.muted} />

            <Text style={s.fieldLabel}>PHONE NUMBER</Text>
            <TextInput style={s.fieldInput} value={editForm.phone}
              onChangeText={v => setEditForm(f => ({...f, phone: v}))}
              placeholder="e.g. +2348012345678" placeholderTextColor={C.muted} keyboardType="phone-pad" />

            <Text style={s.fieldLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
            <TextInput style={s.fieldInput} value={editForm.date_of_birth}
              onChangeText={v => setEditForm(f => ({...f, date_of_birth: v}))}
              placeholder="e.g. 1990-05-20" placeholderTextColor={C.muted} />

            <Text style={s.fieldLabel}>GENDER</Text>
            <View style={s.genderRow}>
              {GENDERS.map(g => (
                <TouchableOpacity key={g} style={[s.genderBtn, editForm.gender === g && s.genderBtnActive]}
                  onPress={() => setEditForm(f => ({...f, gender: g}))}>
                  <Text style={[s.genderBtnText, editForm.gender === g && s.genderBtnTextActive]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>ADDRESS</Text>
            <TextInput style={[s.fieldInput, {height:80, textAlignVertical:'top'}]}
              value={editForm.address}
              onChangeText={v => setEditForm(f => ({...f, address: v}))}
              placeholder="Enter your address" placeholderTextColor={C.muted} multiline />

            {/* Doctor-specific fields */}
            {profile?.user_type === 'doctor' && (
              <>
                <View style={s.vitalsSectionDivider}>
                  <MaterialCommunityIcons name="stethoscope" size={14} color={C.teal} />
                  <Text style={s.vitalsModalTitle}>Professional Details</Text>
                </View>

                <Text style={s.fieldLabel}>TITLE / PREFIX</Text>
                <TextInput style={s.fieldInput} value={editForm.title}
                  onChangeText={v => setEditForm(f => ({...f, title: v}))}
                  placeholder="e.g. Dr., Prof., Pharm." placeholderTextColor={C.muted} />

                <Text style={s.fieldLabel}>SPECIALIZATION *</Text>
                <TextInput style={s.fieldInput} value={editForm.specialization}
                  onChangeText={v => setEditForm(f => ({...f, specialization: v}))}
                  placeholder="e.g. Cardiology, Pediatrics" placeholderTextColor={C.muted} />

                <Text style={s.fieldLabel}>MEDICAL LICENSE NUMBER *</Text>
                <TextInput style={s.fieldInput} value={editForm.medical_license}
                  onChangeText={v => setEditForm(f => ({...f, medical_license: v}))}
                  placeholder="Your medical license number" placeholderTextColor={C.muted} />

                <Text style={s.fieldLabel}>CONSULTATION FEE (₦)</Text>
                <TextInput style={s.fieldInput} value={editForm.consultation_fee}
                  onChangeText={v => setEditForm(f => ({...f, consultation_fee: v}))}
                  placeholder="e.g. 5000" placeholderTextColor={C.muted} keyboardType="numeric" />

                <Text style={s.fieldLabel}>YEARS OF EXPERIENCE</Text>
                <TextInput style={s.fieldInput} value={editForm.years_experience}
                  onChangeText={v => setEditForm(f => ({...f, years_experience: v}))}
                  placeholder="e.g. 5" placeholderTextColor={C.muted} keyboardType="numeric" />

                <Text style={s.fieldLabel}>BIO / ABOUT</Text>
                <TextInput style={[s.fieldInput, {height:100, textAlignVertical:'top'}]}
                  value={editForm.bio}
                  onChangeText={v => setEditForm(f => ({...f, bio: v}))}
                  placeholder="Tell patients about yourself and your practice..." placeholderTextColor={C.muted} multiline />
              </>
            )}

            {/* Patient vitals section */}
            {profile?.user_type === 'patient' && (
              <>
                <View style={s.vitalsSectionDivider}>
                  <Ionicons name="heart" size={14} color={C.teal} />
                  <Text style={s.vitalsModalTitle}>Update Vitals (optional)</Text>
                </View>

                <Text style={s.fieldLabel}>HEART RATE (BPM)</Text>
                <TextInput style={s.fieldInput} value={vitalsForm.heart_rate}
                  onChangeText={v => setVitalsForm(f => ({...f, heart_rate: v}))}
                  placeholder="e.g. 72" placeholderTextColor={C.muted} keyboardType="numeric" />

                <Text style={s.fieldLabel}>BLOOD PRESSURE (mmHg)</Text>
                <TextInput style={s.fieldInput} value={vitalsForm.blood_pressure}
                  onChangeText={v => setVitalsForm(f => ({...f, blood_pressure: v}))}
                  placeholder="e.g. 120/80" placeholderTextColor={C.muted} />

                <Text style={s.fieldLabel}>TEMPERATURE (°C)</Text>
                <TextInput style={s.fieldInput} value={vitalsForm.temperature}
                  onChangeText={v => setVitalsForm(f => ({...f, temperature: v}))}
                  placeholder="e.g. 36.6" placeholderTextColor={C.muted} keyboardType="decimal-pad" />

                <Text style={s.fieldLabel}>OXYGEN SATURATION (SpO2 %)</Text>
                <TextInput style={s.fieldInput} value={vitalsForm.oxygen_saturation}
                  onChangeText={v => setVitalsForm(f => ({...f, oxygen_saturation: v}))}
                  placeholder="e.g. 98" placeholderTextColor={C.muted} keyboardType="numeric" />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}>

        {/* ── TEAL  top band ── */}
        <View style={s.heroCard}>
          <TouchableOpacity style={s.editIconBtn} onPress={openEdit}>
            <Ionicons name="create-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* ── White card that slides up, avatar straddles ── */}
        <View style={s.heroCardBottom}>
          {/* Avatar pinned at top center, half overlapping TEAL  */}
          <View style={s.avatarWrapper}>
            <View style={s.avatarRing}>
              {profile?.profile_image
                ? <Image source={{uri: profile.profile_image}} style={s.avatar} />
                : <View style={s.avatarFallback}>
                    {profile?.user_type === 'doctor'
                      ? <MaterialCommunityIcons name="stethoscope" size={38} color={C.teal} />
                      : <Ionicons name="person" size={38} color={C.teal} />}
                  </View>}
            </View>
            <TouchableOpacity 
              style={s.cameraBtn} 
              onPress={uploadProfileImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Name + email + badge */}
          <Text style={s.heroName}>{profile?.full_name || 'User'}</Text>
          <Text style={s.heroEmail}>{profile?.email || ''}</Text>
          <View style={s.heroBadge}>
            {profile?.user_type === 'doctor'
              ? <MaterialCommunityIcons name="stethoscope" size={13} color="#ffffff" />
              : <Ionicons name="person" size={11} color="#ffffff" />}
            <Text style={s.heroBadgeText}>{userTypeLabel}</Text>
          </View>

          <View style={s.heroDivider} />

          {/* Stats */}
          <View style={s.statsRow}>
            <TouchableOpacity style={s.statItem} onPress={() => navigation.navigate('Appointments')}>
              <Text style={s.statVal}>{counts.appointments}</Text>
              <Text style={s.statLabel}>Appointments</Text>
            </TouchableOpacity>
            <View style={s.statSep} />
            <TouchableOpacity style={s.statItem} onPress={() => navigation.navigate('MedicalRecords')}>
              <Text style={s.statVal}>{counts.records}</Text>
              <Text style={s.statLabel}>Records</Text>
            </TouchableOpacity>
            <View style={s.statSep} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{counts.doctors}</Text>
              <Text style={s.statLabel}>Consultations</Text>
            </View>
          </View>

          {/* Vitals TEAL  sub-card - patients only */}
          {profile?.user_type !== 'doctor' && (
            <View style={s.vitalsCard}>
              <Text style={s.vitalsHeading}>CURRENT VITALS</Text>
              <View style={s.vitalsRow}>
                <View style={s.vitalItem}>
                  <Ionicons name="heart" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={s.vitalVal}>{vitals?.heart_rate ?? '--'}</Text>
                  <Text style={s.vitalLbl}>BPM</Text>
                </View>
                <View style={s.vitalItem}>
                  <Ionicons name="speedometer-outline" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={s.vitalVal}>{vitals?.blood_pressure ?? '--'}</Text>
                  <Text style={s.vitalLbl}>BP</Text>
                </View>
                <View style={s.vitalItem}>
                  <Ionicons name="thermometer-outline" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={s.vitalVal}>{vitals?.temperature ?? '--'}</Text>
                  <Text style={s.vitalLbl}>Temp °C</Text>
                </View>
                <View style={s.vitalItem}>
                  <Ionicons name="water-outline" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={s.vitalVal}>{vitals?.oxygen_saturation ?? '--'}</Text>
                  <Text style={s.vitalLbl}>SpO2 %</Text>
                </View>
              </View>
            </View>
          )}

          {/* Doctor professional info card */}
          {profile?.user_type === 'doctor' && (
            <View style={s.doctorInfoCard}>
              <View style={s.doctorInfoRow}>
                <MaterialCommunityIcons name="stethoscope" size={16} color="#0B7E8A" />
                <Text style={s.doctorInfoLabel}>Specialization</Text>
                <Text style={s.doctorInfoValue}>{profile?.specialization || 'Not set'}</Text>
              </View>
              <View style={s.doctorInfoRow}>
                <Ionicons name="card-outline" size={16} color="#0B7E8A" />
                <Text style={s.doctorInfoLabel}>License</Text>
                <Text style={s.doctorInfoValue}>{profile?.medical_license || 'Not set'}</Text>
              </View>
              <View style={s.doctorInfoRow}>
                <Ionicons name="cash-outline" size={16} color="#0B7E8A" />
                <Text style={s.doctorInfoLabel}>Consultation Fee</Text>
                <Text style={s.doctorInfoValue}>{profile?.consultation_fee ? `₦${Number(profile.consultation_fee).toLocaleString()}` : 'Contact for fee'}</Text>
              </View>
              <View style={[s.doctorInfoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="time-outline" size={16} color="#0B7E8A" />
                <Text style={s.doctorInfoLabel}>Experience</Text>
                <Text style={s.doctorInfoValue}>{profile?.years_experience ? `${profile.years_experience} years` : 'Not set'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Menu */}
        <View style={s.menuSection}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} style={[s.menuItem, i === menuItems.length - 1 && {borderBottomWidth:0}]} onPress={item.onPress}>
              <View style={s.menuIconBox}><Ionicons name={item.icon as any} size={20} color={C.teal} /></View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <View style={s.signOutSection}>
          <TouchableOpacity style={s.signOutBtn} onPress={() => setSignOutVisible(true)}>
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <View style={{height: 110}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0B7E8A' },

  // Hero: teal background
  heroCard: {
    backgroundColor: '#0B7E8A',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 56,
    alignItems: 'center',
  },
  heroCardBottom: {
    backgroundColor: C.bg,
    marginHorizontal: 16,
    borderRadius: 20,
    marginTop: -56,          // pull up to overlap the TEAL  section
    paddingTop: 64,          // room for the avatar half that hangs into white
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  editIconBtn: {
    alignSelf: 'flex-end',
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  // Avatar sits centered, half in TEAL  half in white
  avatarWrapper: {
    position: 'absolute',
    top: -52,              // half of avatar height (104/2)
    alignSelf: 'center',
  },
  avatarRing: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: C.teal,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E6F5F5', alignItems:'center', justifyContent:'center' },
  cameraBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  heroName: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 3, textAlign: 'center' },
  heroEmail: { fontSize: 13, color: C.muted, marginBottom: 10, textAlign: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#D4A843', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#D4A843',
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  heroDivider: { width: '100%', height: 1, backgroundColor: C.border, marginVertical: 16 },

  // Stats (inside white card)
  statsRow: { flexDirection: 'row', width: '100%' },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statVal: { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.muted, textAlign: 'center' },
  statSep: { width: 1, height: 36, backgroundColor: C.border },

  // Vitals (inside white card, TEAL  tint)
  vitalsCard: {
    width: '100%', backgroundColor: C.teal,
    borderRadius: 14, padding: 16, marginTop: 4,
  },
  vitalsHeading: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.8, marginBottom: 12 },
  vitalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  vitalItem: { alignItems: 'center', gap: 4 },
  vitalVal: { fontSize: 15, fontWeight: '700', color: '#fff' },
  vitalLbl: { fontSize: 10, color: 'rgba(255,255,255,0.75)' },

  // Menu
  menuSection: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: C.bg, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 14,
  },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E6F5F5', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: C.text },

  // Sign out
  signOutSection: { marginHorizontal: 16, marginTop: 12 },
  signOutBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical: 16 },
  signOutText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  // Modal
  modalContainer: { flex:1, backgroundColor: C.bg },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border },
  modalTitle: { fontSize:17, fontWeight:'700', color:C.text },
  modalCancel: { fontSize:15, color:C.muted },
  modalSave: { fontSize:15, fontWeight:'700', color:C.teal },
  modalBody: { padding:20, gap:6, paddingBottom:60 },
  fieldLabel: { fontSize:11, fontWeight:'700', color:C.muted, marginTop:16, marginBottom:5, letterSpacing:0.8 },
  fieldInput: { backgroundColor:C.surface, borderRadius:10, paddingHorizontal:14, paddingVertical:12, fontSize:15, color:C.text, borderWidth:1, borderColor:C.border },
  genderRow: { flexDirection:'row', gap:10, marginTop:4 },
  genderBtn: { flex:1, paddingVertical:12, borderRadius:10, borderWidth:1, borderColor:C.border, alignItems:'center' },
  genderBtnActive: { backgroundColor:C.teal, borderColor:C.teal },
  genderBtnText: { fontSize:14, fontWeight:'500', color:C.text },
  genderBtnTextActive: { color:'#fff' },
  // Confirm modal
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  confirmModal: { 
    backgroundColor:C.bg, 
    borderTopLeftRadius:20, 
    borderTopRightRadius:20, 
    padding:24, 
    paddingBottom:40,
    alignItems:'center', 
    gap:12 
  },
  confirmHandle: { width:40, height:4, backgroundColor:C.border, borderRadius:2, marginBottom:8 },
  confirmIconBox: { width:64, height:64, borderRadius:32, backgroundColor:'#fee2e2', alignItems:'center', justifyContent:'center', marginBottom:8 },
  confirmTitle: { fontSize:20, fontWeight:'700', color:C.text },
  confirmDesc: { fontSize:15, color:C.muted, textAlign:'center', lineHeight:22, marginBottom:16 },
  confirmBtns: { flexDirection:'row', gap:12, width:'100%' },
  confirmCancel: { flex:1, paddingVertical:16, borderRadius:14, borderWidth:1, borderColor:C.border, alignItems:'center' },
  confirmCancelText: { fontSize:16, fontWeight:'600', color:C.text },
  confirmAction: { flex:1, paddingVertical:16, borderRadius:14, backgroundColor:'#EF4444', alignItems:'center' },
  confirmActionText: { fontSize:16, fontWeight:'700', color:'#fff' },
  vitalsSectionDivider: { flexDirection:'row', alignItems:'center', gap:8, marginTop:24, paddingTop:20, borderTopWidth:1, borderTopColor:C.border, marginBottom:4 },
  vitalsModalTitle: { fontSize:14, fontWeight:'700', color:C.text },

  // Doctor info card
  doctorInfoCard: { width: '100%', marginTop: 16, backgroundColor: '#F5F7FA', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8EF', overflow: 'hidden' },
  doctorInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8EF' },
  doctorInfoLabel: { fontSize: 12, color: '#555F6D', flex: 1 },
  doctorInfoValue: { fontSize: 13, fontWeight: '600', color: '#171717', flex: 2, textAlign: 'right' },
});
