import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Animated, StatusBar, KeyboardAvoidingView, Platform,
  Image, Easing, Dimensions, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width: SW } = Dimensions.get('window');

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.10)',
  tealDark: '#083236', gold: '#D4A843', goldBg: 'rgba(212,168,67,0.12)',
};

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PATIENT_ALLERGIES = [
  'Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa Drugs', 'Latex',
  'Peanuts', 'Shellfish', 'Dairy/Milk', 'Eggs', 'Gluten', 'Pollen', 'Dust', 'Pet Dander', 'None',
];

const PATIENT_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'HIV/AIDS',
  'Sickle Cell', 'Cancer', 'Epilepsy', 'Arthritis', 'Kidney Disease', 'Depression', 'None',
];

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const PREF_CONSULT = ['In-Person', 'Video Call', 'Phone Call', 'Home Visit'];

const CONSULT_TYPES = [
  { key: 'audio',     label: 'Audio Call' },
  { key: 'video',     label: 'Video Call' },
  { key: 'in_person', label: 'In-Person'  },
  { key: 'follow_up', label: 'Follow-Up'  },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SPECIALTIES = [
  'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology',
  'General Practice', 'Gynaecology', 'Neurology', 'Oncology',
  'Ophthalmology', 'Orthopaedics', 'Paediatrics', 'Psychiatry',
  'Pulmonology', 'Radiology', 'Surgery', 'Urology',
];

type Phase = 'intro' | 'questionnaire' | 'congrats';
type Props = { navigation: any };

export default function OnboardingScreen({ navigation }: Props) {
  const [phase, setPhase]       = useState<Phase>('intro');
  const [step, setStep]         = useState(0);
  const [saving, setSaving]     = useState(false);
  const [userType, setUserType] = useState<'patient' | 'doctor' | null>(null);
  const [userName, setUserName] = useState('');
  const [doctorSpecialty, setDoctorSpecialty] = useState('');
  const fade    = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOp    = useRef(new Animated.Value(0)).current;
  const sparkle    = useRef(new Animated.Value(0)).current;

  // Shared
  const [statePickerOpen, setStatePickerOpen] = useState(false);

  // Patient data
  const [patientState, setPatientState]   = useState('');
  const [bloodType, setBloodType]         = useState('');
  const [gender, setGender]               = useState('');
  const [height, setHeight]               = useState('');
  const [weight, setWeight]               = useState('');
  const [allergies, setAllergies]         = useState<string[]>([]);
  const [conditions, setConditions]       = useState<string[]>([]);
  const [prefConsult, setPrefConsult]     = useState<string[]>([]);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Doctor data
  const [doctorGender, setDoctorGender]       = useState('');
  const [doctorState, setDoctorState]         = useState('');
  const [doctorProfTitle, setDoctorProfTitle] = useState('Dr.');   // loaded from doctors.title
  const [doctorProfBody, setDoctorProfBody]   = useState('NMA');   // regulatory body label
  const [doctorLicFmt, setDoctorLicFmt]       = useState('NMA/YYYY/000000');
  const [yearsExp, setYearsExp]               = useState('');
  const [secondarySpecialty, setSecondarySpecialty] = useState('');
  const [consultTypes, setConsultTypes]       = useState<string[]>([]);
  const [availDays, setAvailDays]             = useState<string[]>([]);
  const [nmaNumber, setNmaNumber]             = useState('');
  const [consultFee, setConsultFee]           = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('user_type, full_name').eq('id', user.id).maybeSingle();

      // Hospital admins don't go through the patient/doctor questionnaire
      if (data?.user_type === 'hospital_admin') {
        await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);
        await AsyncStorage.setItem('hospital_spotlight_pending', 'true');
        navigation.goBack();
        return;
      }

      const type = data?.user_type === 'doctor' ? 'doctor' : 'patient';
      setUserType(type);
      setUserName(
        (data?.full_name || '')
          .replace(/^(dr\.?|prof\.?|nurse\.?|pharm\.?)\s+/i, '')
          .split(' ')[0] || 'there'
      );

      if (type === 'doctor') {
        const { data: docData } = await supabase.from('doctors').select('specialty, title, medical_license').eq('user_id', user.id).maybeSingle();
        setDoctorSpecialty(docData?.specialty || '');
        // Derive regulatory body from title (stored at signup)
        const titleToBody: Record<string, { body: string; format: string }> = {
          'Nurse':   { body: 'NMCN', format: 'NMCN/YYYY/000000' },
          'Pharm.':  { body: 'PCN',  format: 'PCN/REN/YYYY/000' },
          'Physio.': { body: 'MRTB', format: 'MRTB/YYYY/000000' },
          'Rad.':    { body: 'RRBN', format: 'RRBN/YYYY/000000' },
        };
        // Dentists also have 'Dr.' title — detect by license prefix
        const lic = (docData?.medical_license || '').toUpperCase();
        let mapped: { body: string; format: string };
        if (lic.startsWith('MDCN')) {
          mapped = { body: 'MDCN', format: 'MDCN/YYYY/000000' };
        } else {
          mapped = titleToBody[docData?.title || ''] || { body: 'NMA', format: 'NMA/YYYY/000000' };
        }
        setDoctorProfTitle(docData?.title || 'Dr.');
        setDoctorProfBody(mapped.body);
        setDoctorLicFmt(mapped.format);
      }

      // Restore saved progress (if user was mid-questionnaire and app was killed)
      const savedPhase = await AsyncStorage.getItem('ob_phase');
      const savedStep  = await AsyncStorage.getItem('ob_step');
      if (savedPhase === 'questionnaire' && savedStep !== null) {
        setPhase('questionnaire');
        setStep(parseInt(savedStep, 10));
      }
    })();
  }, []);

  // Persist progress so the app can resume if killed mid-questionnaire
  useEffect(() => {
    if (phase === 'questionnaire') {
      AsyncStorage.setItem('ob_phase', 'questionnaire');
      AsyncStorage.setItem('ob_step', String(step));
    }
  }, [phase, step]);

  // Congrats animation
  useEffect(() => {
    if (phase !== 'congrats') return;
    checkScale.setValue(0);
    checkOp.setValue(0);
    sparkle.setValue(0);
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, tension: 180, friction: 10, useNativeDriver: true }),
        Animated.timing(checkOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkle, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(sparkle, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    }, 200);
  }, [phase]);

  const TOTAL_STEPS = 4;

  const goTo = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const next = () => { if (step < TOTAL_STEPS - 1) goTo(step + 1); };
  const back = () => { if (step > 0) goTo(step - 1); };

  const toggleChip = (item: string, list: string[], setList: (v: string[]) => void, exclusive?: string) => {
    if (exclusive && item === exclusive) { setList([exclusive]); return; }
    const cleaned = exclusive ? list.filter(i => i !== exclusive) : list;
    if (cleaned.includes(item)) setList(cleaned.filter(i => i !== item));
    else setList([...cleaned, item]);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (userType === 'patient') {
        await supabase.from('profiles').update({
          gender: gender || null,
          state: patientState || null,
          blood_type: bloodType || null,
          height_cm: height ? parseInt(height) : null,
          weight_kg: weight ? parseFloat(weight) : null,
          allergies: allergies.length ? allergies : null,
          conditions: conditions.length ? conditions : null,
          preferred_consultation_types: prefConsult.length ? prefConsult : null,
          emergency_contact_name: emergencyName || null,
          emergency_contact_phone: emergencyPhone || null,
          onboarding_complete: true,
        }).eq('id', user.id);
      } else {
        // Save doctor-specific fields to both tables so profile screen reflects them immediately
        await supabase.from('profiles').update({
          onboarding_complete: true,
          gender: doctorGender || null,
          state: doctorState || null,
          years_experience: yearsExp ? parseInt(yearsExp) : null,
          consultation_fee: consultFee ? parseFloat(consultFee) : null,
        }).eq('id', user.id);
        await supabase.from('doctors').update({
          years_experience: yearsExp ? parseInt(yearsExp) : null,
          secondary_specialty: secondarySpecialty || null,
          consultation_types: consultTypes.length ? consultTypes : null,
          availability_days: availDays.length ? availDays : null,
          nma_number: nmaNumber || null,
          consultation_fee: consultFee ? parseFloat(consultFee) : null,
        }).eq('user_id', user.id);
      }

      // Clear saved questionnaire progress now that it's complete
      await AsyncStorage.removeItem('ob_phase');
      await AsyncStorage.removeItem('ob_step');

      // Personalised welcome notification
      const doctorLabel = doctorSpecialty ? `${doctorSpecialty} specialist` : 'medical practitioner';
      const workerTitle = doctorProfTitle.replace(/\.$/, '');
      const welcomeTitle = userType === 'doctor'
        ? `Welcome, ${workerTitle} ${userName}!`
        : userType === 'hospital_admin'
          ? `Welcome, ${userName}!`
          : 'Welcome to Hbridge!';
      const welcomeMessage = userType === 'doctor'
        ? `Your profile is live. As an Hbridge ${doctorLabel}, patients can now find and book consultations with you. Thank you for helping bridge the healthcare gap across Nigeria.`
        : userType === 'hospital_admin'
          ? `Your hospital admin account is active. Manage incoming records, oversee your staff, and access your full dashboard at hbridge.ng/hospital. Welcome aboard.`
          : `Hi ${userName || 'there'}! Your health profile is set up. Book consultations, manage records, and get AI-powered health guidance — all in one place. We're glad you're here.`;
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: welcomeTitle,
        message: welcomeMessage,
        type: 'system',
        is_read: false,
        created_at: new Date().toISOString(),
        data: { role: userType },
      });

      // Flag for spotlight tour on first home screen visit (role-specific key)
      if (userType === 'hospital_admin') {
        await AsyncStorage.setItem('hospital_spotlight_pending', 'true');
      } else if (userType === 'doctor') {
        await AsyncStorage.setItem('doctor_spotlight_pending', 'true');
      } else {
        await AsyncStorage.setItem('spotlight_pending', 'true');
      }

      // Send welcome email (fire-and-forget — don't block onboarding if it fails)
      if (user.email) {
        const doctorLabel2 = doctorSpecialty || '';
        supabase.functions.invoke('send-welcome-email', {
          body: { name: userName, email: user.email, userType, specialty: doctorLabel2 },
        }).catch(() => { /* silent — email failure must not block onboarding */ });
      }

    } catch { /* columns may not exist yet — still proceed */ }
    finally { setSaving(false); }

    setPhase('congrats');
  };

  const skip = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);
    } catch { /* ignore */ }
    navigation.goBack();
  };

  const handleStartExploring = () => navigation.goBack();

  // ─── INTRO PHASE ───────────────────────────────────────────────────────────

  if (phase === 'intro') {
    if (userType === null) {
      return (
        <SafeAreaView style={ss.container} edges={['top', 'bottom']}>
          <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={ss.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
        <View style={ss.introWrap}>
          {/* Top logo area */}
          <View style={ss.introLogoArea}>
            <View style={ss.introLogoRing}>
              <Image source={require('../../assets/hbridge3.png')} style={ss.introLogo} resizeMode="cover" />
            </View>
            <View style={ss.introPulse} />
          </View>

          {/* Text content */}
          <View style={ss.introContent}>
            <Text style={ss.introHello}>Hello, {userName || 'welcome'}!</Text>
            <Text style={ss.introTitle}>Before we begin,</Text>
            <Text style={ss.introTitle}>tell us about yourself</Text>
            <Text style={ss.introDesc}>
              We need a brief overview of your{' '}
              {userType === 'doctor' ? 'professional background' : 'health profile'}{' '}
              to personalise your experience and connect you with the right care.
            </Text>
            <Text style={ss.introTime}>
              <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.6)" />
              {'  '}This takes about 1–2 minutes.
            </Text>
          </View>

          {/* Buttons */}
          <View style={ss.introBtns}>
            <TouchableOpacity style={ss.introStartBtn} onPress={() => setPhase('questionnaire')}>
              <Text style={ss.introStartText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#083236" />
            </TouchableOpacity>
            <TouchableOpacity style={ss.introSkipBtn} onPress={skip}>
              <Text style={ss.introSkipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── CONGRATULATIONS PHASE ─────────────────────────────────────────────────

  if (phase === 'congrats') {
    const glowOp = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
    return (
      <SafeAreaView style={ss.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
        <View style={ss.congratsWrap}>
          {/* Animated checkmark */}
          <View style={ss.congratsIconArea}>
            <Animated.View style={[ss.congratsGlow, { opacity: glowOp }]} />
            <Animated.View style={[ss.congratsCheck, { transform: [{ scale: checkScale }], opacity: checkOp }]}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </Animated.View>
          </View>

          <Text style={ss.congratsTitle}>You're all set,{'\n'}{userName || 'welcome'}!</Text>
          <Text style={ss.congratsDesc}>
            Your {userType === 'doctor' ? 'professional profile' : 'health profile'} is ready.
          </Text>

          {/* Hbridge welcome note card */}
          <View style={ss.welcomeCard}>
            <View style={ss.welcomeCardHeader}>
              <Image source={require('../../assets/hbridge3.png')} style={ss.welcomeCardLogo} resizeMode="cover" />
              <View>
                <Text style={ss.welcomeCardFrom}>A note from Hbridge</Text>
                <Text style={ss.welcomeCardDate}>Welcome</Text>
              </View>
            </View>
            <Text style={ss.welcomeCardBody}>
              {userType === 'doctor'
                ? `${doctorProfTitle.replace(/\.$/, '')} ${userName}${doctorSpecialty ? ` · ${doctorSpecialty}` : ''} — thank you for joining Hbridge. Our mission is to bridge the gap between patients and quality healthcare across Nigeria. Your presence helps thousands of patients access the care they need.`
                : `Hi ${userName}, Hbridge was built to make quality healthcare accessible to every Nigerian — wherever they are. With Hbridge, you can book consultations, manage your medical records securely, and get AI-powered health guidance. Your health, your control.`}
            </Text>
            <Text style={ss.welcomeCardSign}>— The Hbridge Team</Text>
          </View>

          <TouchableOpacity style={ss.congratsBtn} onPress={handleStartExploring}>
            <Text style={ss.congratsBtnText}>Start Exploring</Text>
            <Ionicons name="arrow-forward" size={18} color="#083236" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── QUESTIONNAIRE PHASE ───────────────────────────────────────────────────

  if (userType === null) {
    return (
      <SafeAreaView style={ss.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
        </View>
      </SafeAreaView>
    );
  }

  const stepTitles = userType === 'patient'
    ? ['About You', 'Allergies', 'Health Conditions', 'Emergency Contact']
    : ['Your Experience', 'Services Offered', 'Availability', 'Credentials & Fees'];

  const stepIcons: any[] = userType === 'patient'
    ? ['person', 'alert-circle', 'medkit', 'call']
    : ['school', 'list', 'calendar', 'card'];

  const stepSubs = userType === 'patient'
    ? ['Help us personalise your care', 'Things your doctor should know', 'Any existing conditions?', 'Who should we call in an emergency?']
    : ['Your background helps patients find you', 'What types of consultations do you offer?', 'When are you generally available?', 'Licence and pricing information'];

  const renderPatientStep0 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <Text style={ss.sectionLabel}>GENDER</Text>
      <View style={ss.chipRow}>
        {GENDERS.map(g => (
          <TouchableOpacity key={g} style={[ss.chip, gender === g && ss.chipActive]} onPress={() => setGender(gender === g ? '' : g)}>
            <Text style={[ss.chipText, gender === g && ss.chipTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[ss.sectionLabel, { marginTop: 20 }]}>BLOOD TYPE</Text>
      <View style={ss.chipRow}>
        {BLOOD_TYPES.map(bt => (
          <TouchableOpacity key={bt} style={[ss.chip, bloodType === bt && ss.chipActive]} onPress={() => setBloodType(bt)}>
            <Text style={[ss.chipText, bloodType === bt && ss.chipTextActive]}>{bt}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[ss.sectionLabel, { marginTop: 20 }]}>STATE OF RESIDENCE</Text>
      <TouchableOpacity style={ss.stateBtn} onPress={() => setStatePickerOpen(true)}>
        <Ionicons name="location-outline" size={16} color={patientState ? C.teal : C.muted} />
        <Text style={[ss.stateBtnText, patientState && { color: C.text }]}>
          {patientState || 'Select your state'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.muted} />
      </TouchableOpacity>
      <Text style={[ss.sectionLabel, { marginTop: 20 }]}>HEIGHT & WEIGHT</Text>
      <View style={ss.rowInputs}>
        <View style={ss.inputWrap}>
          <Text style={ss.inputLabel}>Height (cm)</Text>
          <TextInput style={ss.input} placeholder="e.g. 175" placeholderTextColor={C.muted} keyboardType="numeric" value={height} onChangeText={setHeight} />
        </View>
        <View style={ss.inputWrap}>
          <Text style={ss.inputLabel}>Weight (kg)</Text>
          <TextInput style={ss.input} placeholder="e.g. 70" placeholderTextColor={C.muted} keyboardType="numeric" value={weight} onChangeText={setWeight} />
        </View>
      </View>
    </ScrollView>
  );

  const renderPatientStep1 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <Text style={ss.sectionLabel}>SELECT ALL THAT APPLY</Text>
      <View style={ss.chipRow}>
        {PATIENT_ALLERGIES.map(a => {
          const active = allergies.includes(a);
          return <TouchableOpacity key={a} style={[ss.chip, active && ss.chipActive]} onPress={() => toggleChip(a, allergies, setAllergies, 'None')}><Text style={[ss.chipText, active && ss.chipTextActive]}>{a}</Text></TouchableOpacity>;
        })}
      </View>
    </ScrollView>
  );

  const renderPatientStep2 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <Text style={ss.sectionLabel}>SELECT ALL THAT APPLY</Text>
      <View style={ss.chipRow}>
        {PATIENT_CONDITIONS.map(c => {
          const active = conditions.includes(c);
          return <TouchableOpacity key={c} style={[ss.chip, active && ss.chipActive]} onPress={() => toggleChip(c, conditions, setConditions, 'None')}><Text style={[ss.chipText, active && ss.chipTextActive]}>{c}</Text></TouchableOpacity>;
        })}
      </View>
    </ScrollView>
  );

  const renderPatientStep3 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <Text style={ss.sectionLabel}>PREFERRED CONSULTATION TYPE</Text>
      <View style={ss.chipRow}>
        {PREF_CONSULT.map(p => {
          const active = prefConsult.includes(p);
          return (
            <TouchableOpacity key={p} style={[ss.chip, active && ss.chipActive]} onPress={() => toggleChip(p, prefConsult, setPrefConsult)}>
              <Text style={[ss.chipText, active && ss.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[ss.sectionLabel, { marginTop: 24 }]}>EMERGENCY CONTACT</Text>
      <View style={ss.fieldGroup}>
        <Text style={ss.inputLabel}>Full Name</Text>
        <TextInput style={ss.inputFull} placeholder="Contact's full name" placeholderTextColor={C.muted} value={emergencyName} onChangeText={setEmergencyName} />
      </View>
      <View style={[ss.fieldGroup, { marginTop: 14 }]}>
        <Text style={ss.inputLabel}>Phone Number</Text>
        <TextInput style={ss.inputFull} placeholder="+234 800 000 0000" placeholderTextColor={C.muted} keyboardType="phone-pad" value={emergencyPhone} onChangeText={setEmergencyPhone} />
      </View>
      <View style={ss.infoBox}>
        <Ionicons name="information-circle" size={16} color={C.teal} />
        <Text style={ss.infoText}>This person will be contacted in an emergency when you cannot speak for yourself.</Text>
      </View>
    </ScrollView>
  );

  const renderDoctorStep0 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <View style={ss.fieldGroup}>
        <Text style={ss.inputLabel}>Gender</Text>
        <View style={ss.chipRow}>
          {GENDERS.map(g => (
            <TouchableOpacity key={g} style={[ss.chip, doctorGender === g && ss.chipActive]} onPress={() => setDoctorGender(doctorGender === g ? '' : g)}>
              <Text style={[ss.chipText, doctorGender === g && ss.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={[ss.fieldGroup, { marginTop: 14 }]}>
        <Text style={ss.inputLabel}>State of Practice</Text>
        <TouchableOpacity style={ss.stateBtn} onPress={() => setStatePickerOpen(true)}>
          <Ionicons name="location-outline" size={16} color={doctorState ? C.teal : C.muted} />
          <Text style={[ss.stateBtnText, doctorState && { color: C.text }]}>
            {doctorState || 'Select your state'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={C.muted} />
        </TouchableOpacity>
      </View>
      <View style={[ss.fieldGroup, { marginTop: 14 }]}>
        <Text style={ss.inputLabel}>Years of Experience</Text>
        <TextInput style={ss.inputFull} placeholder="e.g. 8" placeholderTextColor={C.muted} keyboardType="numeric" value={yearsExp} onChangeText={setYearsExp} />
      </View>
      <View style={[ss.fieldGroup, { marginTop: 14 }]}>
        <Text style={ss.inputLabel}>Secondary Specialty (optional)</Text>
        <Text style={ss.sectionLabel}>CHOOSE ONE</Text>
        <View style={ss.chipRow}>
          {SPECIALTIES.map(sp => (
            <TouchableOpacity key={sp} style={[ss.chip, secondarySpecialty === sp && ss.chipActive]} onPress={() => setSecondarySpecialty(secondarySpecialty === sp ? '' : sp)}>
              <Text style={[ss.chipText, secondarySpecialty === sp && ss.chipTextActive]}>{sp}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderDoctorStep1 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <Text style={ss.sectionLabel}>SELECT ALL THAT APPLY</Text>
      <View style={ss.chipRow}>
        {CONSULT_TYPES.map(ct => {
          const active = consultTypes.includes(ct.key);
          return <TouchableOpacity key={ct.key} style={[ss.chip, active && ss.chipActive]} onPress={() => toggleChip(ct.key, consultTypes, setConsultTypes)}><Text style={[ss.chipText, active && ss.chipTextActive]}>{ct.label}</Text></TouchableOpacity>;
        })}
      </View>
    </ScrollView>
  );

  const renderDoctorStep2 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <Text style={ss.sectionLabel}>AVAILABLE DAYS</Text>
      <View style={ss.chipRow}>
        {DAYS.map(d => {
          const active = availDays.includes(d);
          return <TouchableOpacity key={d} style={[ss.chip, active && ss.chipActive]} onPress={() => toggleChip(d, availDays, setAvailDays)}><Text style={[ss.chipText, active && ss.chipTextActive]}>{d}</Text></TouchableOpacity>;
        })}
      </View>
    </ScrollView>
  );

  const renderDoctorStep3 = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.stepScroll}>
      <View style={ss.fieldGroup}>
        <Text style={ss.inputLabel}>{doctorProfBody} Licence Number</Text>
        <Text style={ss.rangeHint}>Format: {doctorLicFmt}</Text>
        <TextInput style={ss.inputFull} placeholder={doctorLicFmt} placeholderTextColor={C.muted} value={nmaNumber} onChangeText={text => setNmaNumber(text.toUpperCase())} autoCapitalize="characters" />
      </View>
      <View style={[ss.fieldGroup, { marginTop: 14 }]}>
        <Text style={ss.inputLabel}>Consultation Fee (₦)</Text>
        <TextInput style={ss.inputFull} placeholder="e.g. 5000" placeholderTextColor={C.muted} keyboardType="numeric" value={consultFee} onChangeText={setConsultFee} />
      </View>
      <View style={ss.infoBox}>
        <Ionicons name="information-circle" size={16} color={C.teal} />
        <Text style={ss.infoText}>Your fee helps patients understand the cost before booking. You can update this anytime from your profile.</Text>
      </View>
    </ScrollView>
  );

  const renderStep = () => {
    if (userType === 'patient') {
      if (step === 0) return renderPatientStep0();
      if (step === 1) return renderPatientStep1();
      if (step === 2) return renderPatientStep2();
      return renderPatientStep3();
    }
    if (step === 0) return renderDoctorStep0();
    if (step === 1) return renderDoctorStep1();
    if (step === 2) return renderDoctorStep2();
    return renderDoctorStep3();
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={ss.header}>
          <View style={ss.headerTop}>
            <View style={ss.headerIconWrap}>
              <Ionicons name={stepIcons[step]} size={26} color="#ffffff" />
            </View>
            <TouchableOpacity onPress={skip} style={ss.skipBtn}>
              <Text style={ss.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
          <Text style={ss.headerTitle}>{stepTitles[step]}</Text>
          <Text style={ss.headerSub}>{stepSubs[step]}</Text>
          <View style={ss.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[ss.dot, i === step && ss.dotActive]} />
            ))}
          </View>
        </View>

        <View style={ss.card}>
          <Animated.View style={[{ flex: 1 }, { opacity: fade }]}>
            {renderStep()}
          </Animated.View>
          <View style={ss.footer}>
            {step > 0 ? (
              <TouchableOpacity style={ss.backBtn} onPress={back}>
                <Ionicons name="arrow-back" size={20} color={C.teal} />
                <Text style={ss.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity style={[ss.nextBtn, saving && { opacity: 0.6 }]} onPress={isLastStep ? finish : next} disabled={saving}>
              <Text style={ss.nextBtnText}>{isLastStep ? (saving ? 'Saving...' : 'Finish') : 'Continue'}</Text>
              {!saving && <Ionicons name="arrow-forward" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* State picker modal — shared for patient & doctor */}
      <Modal visible={statePickerOpen} transparent animationType="slide">
        <View style={ss.stateOverlay}>
          <View style={ss.stateSheet}>
            <View style={ss.stateSheetHeader}>
              <Text style={ss.stateSheetTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setStatePickerOpen(false)}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={NIGERIAN_STATES}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const currentState = userType === 'doctor' ? doctorState : patientState;
                const active = currentState === item;
                return (
                  <TouchableOpacity
                    style={[ss.stateItem, active && ss.stateItemActive]}
                    onPress={() => {
                      if (userType === 'doctor') setDoctorState(item);
                      else setPatientState(item);
                      setStatePickerOpen(false);
                    }}
                  >
                    <Text style={[ss.stateItemText, active && ss.stateItemTextActive]}>{item}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={C.teal} />}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.tealDark },

  // ── INTRO ──────────────────────────────────────
  introWrap: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingTop: 32, paddingBottom: 40 },
  introLogoArea: { alignItems: 'center', marginTop: 16 },
  introLogoRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  introLogo: { width: 110, height: 110 },
  introPulse: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  introContent: { flex: 1, justifyContent: 'center', paddingVertical: 32 },
  introHello: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', marginBottom: 6 },
  introTitle: { fontSize: 30, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', letterSpacing: -0.5, lineHeight: 36 },
  introDesc: { fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.72)', lineHeight: 24, marginTop: 18 },
  introTime: { fontSize: 12.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.55)', marginTop: 14 },
  introBtns: { gap: 12 },
  introStartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#D4A843', borderRadius: 16, paddingVertical: 16 },
  introStartText: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#083236' },
  introSkipBtn: { alignItems: 'center', paddingVertical: 12 },
  introSkipText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.55)' },

  // ── CONGRATULATIONS ────────────────────────────
  congratsWrap: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 0 },
  congratsIconArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 24, width: 120, height: 120 },
  congratsGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(11,126,138,0.35)' },
  congratsCheck: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  congratsTitle: { fontSize: 28, fontFamily: 'Montserrat_800ExtraBold', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 36, marginBottom: 8 },
  congratsDesc: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 24 },
  welcomeCard: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', width: '100%', marginBottom: 28 },
  welcomeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  welcomeCardLogo: { width: 38, height: 38, borderRadius: 19 },
  welcomeCardFrom: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
  welcomeCardDate: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  welcomeCardBody: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  welcomeCardSign: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: 'rgba(255,255,255,0.5)', marginTop: 12, textAlign: 'right' },
  congratsBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#D4A843', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 },
  congratsBtnText: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#083236' },

  // ── QUESTIONNAIRE ──────────────────────────────
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)', alignItems: 'center', justifyContent: 'center' },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  skipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.75)' },
  headerTitle: { fontSize: 28, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 4 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.30)' },
  dotActive: { width: 22, backgroundColor: '#ffffff' },
  card: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  stepScroll: { padding: 24, paddingBottom: 12 },
  sectionLabel: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  chipActive: { backgroundColor: C.tealLight, borderColor: C.teal },
  chipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  chipTextActive: { color: C.teal, fontFamily: 'SpaceGrotesk_500Medium' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  inputWrap: { flex: 1 },
  fieldGroup: {},
  inputLabel: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.muted, marginBottom: 4 },
  rangeHint: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  inputFull: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.tealLight, borderRadius: 12, padding: 14, marginTop: 20 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.border, gap: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4 },
  backBtnText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.teal, borderRadius: 14, paddingVertical: 14 },
  nextBtnText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#ffffff' },

  // State picker
  stateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  stateBtnText: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  stateOverlay: { flex: 1, backgroundColor: 'rgba(8,50,54,0.55)', justifyContent: 'flex-end' },
  stateSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '72%', paddingTop: 8,
  },
  stateSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  stateSheetTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C.text },
  stateItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  stateItemActive: { backgroundColor: C.tealLight },
  stateItemText: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text },
  stateItemTextActive: { color: C.teal, fontFamily: 'SpaceGrotesk_500Medium' },
});
