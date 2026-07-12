import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image, Modal,
  Animated, Easing, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { NetworkDiagnostic } from '../utils/networkDiagnostic';

const C = {
  paper: '#F5F3EE', paperDark: '#EDE9E0', card: '#FFFFFF', cardBorder: '#EAE5DA',
  ink: '#0C2E30', teal: '#0B7E8A', tealHero1: '#0C6570', tealHero2: '#083236',
  gold: '#D4A843', goldBg: 'rgba(212,168,67,0.12)', goldBorder: 'rgba(212,168,67,0.3)',
  muted: '#7A8785', muted2: '#97A2A0', textPrimary: '#16211F', textBody: '#5C6B69',
};

type Role = 'patient' | 'doctor' | 'hospital_admin';

function HBridgeMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44">
      <Path d="M0 0 h8 v44 h-8z M32 0 h8 v44 h-8z" fill="#3DA0AC" />
      <Path d="M12 6 h6 v30 h-6z M22 6 h6 v30 h-6z" fill="#D4A843" />
      <Rect x="12" y="18" width="16" height="6" fill="#D4A843" />
    </Svg>
  );
}

const getPasswordStrength = (p: string): { score: number; label: string; color: string } => {
  if (!p) return { score: 0, label: '', color: C.cardBorder };
  let score = 0;
  if (p.length >= 8)  score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { score: 1, label: 'Weak',        color: '#EF4444' };
  if (score <= 2) return { score: 2, label: 'Fair',        color: '#F97316' };
  if (score <= 3) return { score: 3, label: 'Good',        color: C.gold };
  if (score <= 4) return { score: 4, label: 'Strong',      color: '#22C55E' };
  return             { score: 5, label: 'Very Strong', color: C.teal };
};

export default function SignUpScreen({ navigation }: any) {
  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [phone, setPhone]                 = useState('');
  const [password, setPassword]           = useState('');
  const [role, setRole]                   = useState<Role>('patient');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [medicalLicense, setMedicalLicense] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalName, setHospitalName]   = useState('');
  const [emailTouched, setEmailTouched]   = useState(false);
  const [phoneTouched, setPhoneTouched]   = useState(false);
  const [showOTP, setShowOTP]             = useState(false);
  const [otp, setOtp]                     = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const sheetY  = useRef(new Animated.Value(400)).current;
  const [kbHeight, setKbHeight] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  // Accepts: 08012345678 / 07012345678 / +2348012345678 / +234 801 234 5678
  const validatePhone = (v: string) => {
    if (!v.trim()) return true; // optional field
    const digits = v.replace(/[\s\-\(\)]/g, '');
    return /^(\+?234|0)[7-9][01]\d{8}$/.test(digits);
  };

  const emailValid = validateEmail(email);
  const phoneValid = validatePhone(phone);
  const strength = getPasswordStrength(password);

  // Start cooldown timer for resend
  const startCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const openOTPSheet = () => {
    setShowOTP(true);
    sheetY.setValue(400);
    Animated.spring(sheetY, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }).start(() => {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    });
  };

  const closeOTPSheet = () => {
    Animated.timing(sheetY, { toValue: 400, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setShowOTP(false);
      setOtp(['', '', '', '', '', '']);
    });
  };

  const handleOTPChange = (val: string, idx: number) => {
    // Handle paste of full 6-digit code
    if (val.length === 6 && /^\d{6}$/.test(val)) {
      const digits = val.split('');
      setOtp(digits);
      otpRefs.current[5]?.focus();
      return;
    }
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOTPKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const verifyOTP = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      toast.showWarning('Incomplete', 'Enter all 6 digits from your email.');
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        console.log('[OTP Error]', error.message, error.status);
        if (error.message?.toLowerCase().includes('expired')) {
          toast.showError('Code Expired', 'This code has expired. Tap "Resend code" to get a new one.');
        } else {
          toast.showError('Invalid Code', error.message || 'The code is incorrect. Double-check and try again.');
        }
        return;
      }

      // Save full profile after OTP verification
      const userId = data.user?.id;
      if (userId) {
        const profilePayload: any = {
          id: userId,
          email,
          full_name: fullName.replace(/^(dr\.?|nurse\.?|prof\.?)\s+/i, '').trim(),
          user_type: role,
          phone: phone?.trim() || null,
          medical_license: role === 'doctor' ? medicalLicense : null,
          specialization: role === 'doctor' ? specialization : null,
          hospital_name: role === 'hospital_admin' ? hospitalName : null,
          onboarding_complete: false,
          updated_at: new Date().toISOString(),
        };

        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });

        if (profileErr) {
          // Fallback: update existing row
          await supabase.from('profiles')
            .update({
              full_name: fullName.replace(/^(dr\.?|nurse\.?|prof\.?)\s+/i, '').trim(),
              user_type: role,
              phone: phone?.trim() || null,
              onboarding_complete: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }

        if (role === 'doctor') {
          await supabase.from('doctors').upsert({
            user_id: userId, full_name: fullName.replace(/^(dr\.?|nurse\.?|prof\.?)\s+/i, '').trim(),
            specialization: specialization || 'General Practice',
            medical_license: medicalLicense || 'PENDING',
            verification_status: 'verified', is_available: true,
            average_rating: 0, total_reviews: 0,
          }, { onConflict: 'user_id' });
        }
      }

      Animated.timing(sheetY, { toValue: 400, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        setShowOTP(false);
        setOtp(['', '', '', '', '', '']);
        toast.showSuccess('Email Verified!', 'Your account is ready. Welcome to Hbridge Nigeria!');
      });
    } catch {
      toast.showError('Error', 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      await supabase.auth.resend({ type: 'signup', email });
      startCooldown();
      toast.showSuccess('Code Sent', 'A new verification code has been sent to your email.');
    } catch {
      toast.showError('Error', 'Could not resend code. Please try again.');
    }
  };

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      toast.showWarning('Required Fields', 'Please fill in all required fields.');
      return;
    }
    if (!validateEmail(email)) {
      setEmailTouched(true);
      toast.showError('Invalid Email', 'Enter a valid email address.');
      return;
    }
    if (phone.trim() && !validatePhone(phone)) {
      setPhoneTouched(true);
      toast.showError('Invalid Phone', 'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678).');
      return;
    }
    if (password.length < 8) {
      toast.showError('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (role === 'doctor' && (!medicalLicense || !specialization)) {
      toast.showWarning('Doctor Info Required', 'Please provide medical license and specialization.');
      return;
    }
    if (role === 'hospital_admin' && !hospitalName) {
      toast.showWarning('Hospital Info Required', 'Please provide hospital name.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await NetworkDiagnostic.testWithRetry(
        () => supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } }),
        3, 1000
      );

      if (error) {
        if (error.message.includes('already registered')) {
          toast.showWarning('Account Exists', 'This email is already registered. Sign in instead.');
        } else if (error.message?.includes('Network') || error.message?.includes('timeout')) {
          toast.showError('Connection Error', 'Please check your internet connection and try again.');
        } else {
          toast.showError('Registration Error', error.message || 'Unable to create account.');
        }
        return;
      }

      if (data.user) {
        startCooldown();
        openOTPSheet();
      }
    } catch (error: any) {
      if (error.message?.includes('Network') || error.message?.includes('timeout')) {
        toast.showError('Connection Error', 'Please check your internet connection and try again.');
      } else {
        toast.showError('Registration Error', 'Unable to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'patient',        label: 'Patient',  ionIcon: 'person-outline',   matIcon: null,           description: 'Get medical care' },
    { value: 'doctor',         label: 'Doctor',   ionIcon: null,               matIcon: 'stethoscope',  description: 'Provide care' },
    { value: 'hospital_admin', label: 'Hospital', ionIcon: 'business-outline', matIcon: null,           description: 'Manage hospital' },
  ] as const;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.paper} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={C.textPrimary} />
          </TouchableOpacity>

          {/* Logo + headline */}
          <View style={s.heroSection}>
            <Image source={require('../../assets/hbridge3.png')} style={s.logoRounded} resizeMode="cover" />
            <Text style={s.headline}>Create Account</Text>
            <Text style={s.subline}>Join Nigeria's leading health platform</Text>
          </View>

          {/* Segmented tabs */}
          <View style={s.segRow}>
            <TouchableOpacity style={s.segInactive} onPress={() => navigation.navigate('SignIn')}>
              <Text style={s.segInactiveText}>Sign In</Text>
            </TouchableOpacity>
            <View style={s.segActive}>
              <Text style={s.segActiveText}>Create Account</Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Full Name <Text style={s.required}>*</Text></Text>
            <View style={s.fieldRow}>
              <Ionicons name="person-outline" size={19} color={C.teal} />
              <TextInput
                style={s.fieldInput}
                value={fullName} onChangeText={setFullName}
                placeholder="Your full name" placeholderTextColor={C.muted2}
                autoCapitalize="words"
              />
            </View>
            {role === 'doctor' && (
              <Text style={s.fieldHint}>Enter your name only — your title will be added automatically</Text>
            )}
          </View>

          {/* Email */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Email <Text style={s.required}>*</Text></Text>
            <View style={[s.fieldRow, emailTouched && email && !emailValid && s.fieldRowError, emailTouched && email && emailValid && s.fieldRowValid]}>
              <Ionicons name="mail-outline" size={19} color={emailTouched && email ? (emailValid ? '#22C55E' : '#EF4444') : C.teal} />
              <TextInput
                style={s.fieldInput}
                value={email}
                onChangeText={v => { setEmail(v); if (emailTouched) setEmailTouched(true); }}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@email.com" placeholderTextColor={C.muted2}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              />
              {emailTouched && email.length > 0 && (
                <Ionicons
                  name={emailValid ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={emailValid ? '#22C55E' : '#EF4444'}
                />
              )}
            </View>
            {emailTouched && email.length > 0 && !emailValid && (
              <Text style={s.fieldError}>Enter a valid email address</Text>
            )}
          </View>

          {/* Phone */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Phone Number</Text>
            <View style={[s.fieldRow, phoneTouched && phone && !phoneValid && s.fieldRowError, phoneTouched && phone && phoneValid && s.fieldRowValid]}>
              <Ionicons name="call-outline" size={19} color={phoneTouched && phone ? (phoneValid ? '#22C55E' : '#EF4444') : C.teal} />
              <TextInput
                style={s.fieldInput}
                value={phone}
                onChangeText={v => { setPhone(v); if (phoneTouched) setPhoneTouched(true); }}
                onBlur={() => { if (phone.trim()) setPhoneTouched(true); }}
                placeholder="08012345678 or +2348012345678" placeholderTextColor={C.muted2}
                keyboardType="phone-pad"
              />
              {phoneTouched && phone.length > 0 && (
                <Ionicons
                  name={phoneValid ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={phoneValid ? '#22C55E' : '#EF4444'}
                />
              )}
            </View>
            {phoneTouched && phone.length > 0 && !phoneValid && (
              <Text style={s.fieldError}>Use format: 08012345678 or +2348012345678</Text>
            )}
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Password <Text style={s.required}>*</Text></Text>
            <View style={s.fieldRow}>
              <Ionicons name="lock-closed-outline" size={19} color={C.teal} />
              <TextInput
                style={[s.fieldInput, { flex: 1 }]}
                value={password} onChangeText={setPassword}
                placeholder="Min. 8 characters" placeholderTextColor={C.muted2}
                secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={19} color={C.muted2} />
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={s.strengthRow}>
                <View style={s.strengthBars}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={[s.strengthBar, { backgroundColor: i <= strength.score ? strength.color : C.cardBorder }]} />
                  ))}
                </View>
                <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
          </View>

          {/* Role divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>I am a</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Role cards */}
          <View style={s.roleRow}>
            {roleOptions.map(opt => {
              const active = role === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.roleCard, active && s.roleCardActive]}
                  onPress={() => setRole(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={[s.roleIconBox, active && s.roleIconBoxActive]}>
                    {opt.ionIcon
                      ? <Ionicons name={opt.ionIcon as any} size={20} color={active ? '#fff' : C.muted2} />
                      : <MaterialCommunityIcons name={opt.matIcon as any} size={20} color={active ? '#fff' : C.muted2} />}
                  </View>
                  <Text style={[s.roleLabel, active && s.roleLabelActive]}>{opt.label}</Text>
                  <Text style={s.roleDesc}>{opt.description}</Text>
                  {active && (
                    <View style={s.roleCheck}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Doctor extra fields */}
          {role === 'doctor' && (
            <View style={s.extraFields}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Medical License (NMA) <Text style={s.required}>*</Text></Text>
                <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, marginBottom: 5 }}>Format: NMA/YYYY/000000</Text>
                <View style={s.fieldRow}>
                  <Ionicons name="document-text-outline" size={19} color={C.teal} />
                  <TextInput
                    style={s.fieldInput}
                    value={medicalLicense} onChangeText={text => setMedicalLicense(text.toUpperCase())}
                    placeholder="NMA/YYYY/000000" placeholderTextColor={C.muted2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Specialization <Text style={s.required}>*</Text></Text>
                <View style={s.fieldRow}>
                  <Ionicons name="medkit-outline" size={19} color={C.teal} />
                  <TextInput
                    style={s.fieldInput}
                    value={specialization} onChangeText={setSpecialization}
                    placeholder="e.g. Cardiology" placeholderTextColor={C.muted2}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Hospital extra fields */}
          {role === 'hospital_admin' && (
            <View style={s.extraFields}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Hospital Name <Text style={s.required}>*</Text></Text>
                <View style={s.fieldRow}>
                  <Ionicons name="business-outline" size={19} color={C.teal} />
                  <TextInput
                    style={s.fieldInput}
                    value={hospitalName} onChangeText={setHospitalName}
                    placeholder="Enter hospital name" placeholderTextColor={C.muted2}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Terms */}
          <TouchableOpacity
            style={s.termsBadge}
            activeOpacity={0.7}
            onPress={() => toast.showInfo('Terms & Privacy', 'Hbridge provides medical information for educational purposes only. We encrypt all medical data and never share personal information with third parties.')}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color="#8A6A1F" />
            <Text style={s.termsText}>
              By continuing you agree to our{' '}
              <Text style={s.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Create Account button */}
          <TouchableOpacity
            style={[s.createBtn, loading && { opacity: 0.65 }]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <Text style={s.createBtnText}>Sending code…</Text>
              : <>
                  <Text style={s.createBtnText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </>}
          </TouchableOpacity>

          {/* Sign in link */}
          <View style={s.signInRow}>
            <Text style={s.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={s.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP Verification Modal */}
      <Modal visible={showOTP} transparent animationType="none" statusBarTranslucent onRequestClose={closeOTPSheet}>
        <View style={s.otpScrim}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeOTPSheet} />
          <Animated.View style={[s.otpSheet, { transform: [{ translateY: sheetY }], paddingBottom: Math.max(44, kbHeight + 16) }]}>
            <View style={s.otpHandle} />

            {/* Icon */}
            <View style={s.otpIconWrap}>
              <Ionicons name="mail" size={28} color={C.teal} />
            </View>

            <Text style={s.otpTitle}>Check your email</Text>
            <Text style={s.otpSub}>
              We sent a 6-digit code to{'\n'}
              <Text style={s.otpEmail}>{email}</Text>
            </Text>

            {/* 6-box OTP input */}
            <View style={s.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => { otpRefs.current[i] = r; }}
                  style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={v => handleOTPChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  textAlign="center"
                />
              ))}
            </View>

            {/* Verify button */}
            <TouchableOpacity
              style={[s.otpVerifyBtn, (verifying || otp.join('').length < 6) && { opacity: 0.5 }]}
              onPress={verifyOTP}
              disabled={verifying || otp.join('').length < 6}
            >
              <Text style={s.otpVerifyText}>{verifying ? 'Verifying…' : 'Verify Email'}</Text>
              {!verifying && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
            </TouchableOpacity>

            {/* Resend */}
            <TouchableOpacity onPress={resendCode} disabled={resendCooldown > 0} style={s.otpResendBtn}>
              <Text style={[s.otpResendText, resendCooldown > 0 && { color: C.muted2 }]}>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get it? Resend code"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center', justifyContent: 'center', marginTop: 6 },

  heroSection: { alignItems: 'center', paddingTop: 22, paddingBottom: 20 },
  logoBox: { width: 66, height: 66, borderRadius: 20, borderTopLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', shadowColor: C.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
  logoRounded: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: '#0B7E8A', shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
  headline: { fontSize: 25, fontFamily: 'Montserrat_700Bold', color: C.ink, marginTop: 16, letterSpacing: -0.3 },
  subline: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.textBody, marginTop: 7 },

  segRow: { flexDirection: 'row', backgroundColor: C.paperDark, borderRadius: 14, padding: 4, marginBottom: 20 },
  segActive: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 11, backgroundColor: C.teal, shadowColor: C.teal, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4 },
  segActiveText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  segInactive: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  segInactiveText: { fontSize: 14, fontFamily: 'Montserrat_500Medium', color: C.textBody },

  fieldGroup: { gap: 7, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  fieldHint: { fontSize: 11, fontFamily: 'Montserrat_400Regular', color: C.muted, marginTop: 4, marginLeft: 2 },
  required: { color: '#EF4444' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 13, paddingHorizontal: 14, height: 50 },
  fieldRowError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  fieldRowValid: { borderColor: '#22C55E', backgroundColor: '#F0FDF4' },
  fieldInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary, paddingVertical: 0 },
  fieldError: { fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#EF4444', marginTop: 3, marginLeft: 2 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', minWidth: 68, textAlign: 'right' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  dividerText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2 },

  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  roleCard: {
    flex: 1, alignItems: 'center', gap: 5,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder,
    padding: 14, position: 'relative',
  },
  roleCardActive: { borderColor: C.teal, backgroundColor: 'rgba(11,126,138,0.06)' },
  roleIconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.paperDark, alignItems: 'center', justifyContent: 'center' },
  roleIconBoxActive: { backgroundColor: C.teal },
  roleLabel: { fontSize: 12.5, fontFamily: 'Montserrat_700Bold', color: C.textPrimary, textAlign: 'center' },
  roleLabelActive: { color: C.teal },
  roleDesc: { fontSize: 10.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted2, textAlign: 'center' },
  roleCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },

  extraFields: { gap: 0, marginBottom: 6 },

  termsBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.goldBorder, borderRadius: 12, padding: 12, marginBottom: 16 },
  termsText: { flex: 1, fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#8A6A1F', lineHeight: 17 },
  termsLink: { fontFamily: 'Montserrat_600SemiBold', color: '#7A5A10' },

  createBtn: { height: 52, borderRadius: 15, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: C.tealHero2, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 6 },
  createBtnText: { fontSize: 15.5, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  signInRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  signInText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.textBody },
  signInLink: { fontSize: 13.5, fontFamily: 'Montserrat_700Bold', color: C.teal },

  // OTP modal
  otpScrim: { flex: 1, backgroundColor: 'rgba(8,50,54,0.55)', justifyContent: 'flex-end' },
  otpSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, alignItems: 'center' },
  otpHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.cardBorder, marginBottom: 24 },
  otpIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(11,126,138,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  otpTitle: { fontSize: 22, fontFamily: 'Montserrat_800ExtraBold', color: C.ink, marginBottom: 8, letterSpacing: -0.3 },
  otpSub: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  otpEmail: { fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  otpRow: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  otpBox: { width: 36, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.paper, fontSize: 18, fontFamily: 'Montserrat_700Bold', color: C.ink, textAlign: 'center' },
  otpBoxFilled: { borderColor: C.teal, backgroundColor: 'rgba(11,126,138,0.06)' },
  otpVerifyBtn: { width: '100%', height: 52, backgroundColor: C.teal, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  otpVerifyText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  otpResendBtn: { paddingVertical: 8 },
  otpResendText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, textAlign: 'center' },
});
