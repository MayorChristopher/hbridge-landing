import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

type Role = 'patient' | 'doctor' | 'hospital_admin';

const C = {
  paper: '#F5F3EE',
  paperDark: '#EDE9E0',
  card: '#FFFFFF',
  border: '#EAE5DA',
  ink: '#0C2E30',
  teal: '#0B7E8A',
  tealLight: 'rgba(11,126,138,0.09)',
  gold: '#D4A843',
  goldBg: 'rgba(212,168,67,0.10)',
  goldBorder: 'rgba(212,168,67,0.28)',
  muted: '#7A8785',
  muted2: '#97A2A0',
  textPrimary: '#16211F',
  textBody: '#5C6B69',
};

function HBridgeMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44">
      <Path d="M0 0 h8 v44 h-8z M32 0 h8 v44 h-8z" fill="#3DA0AC" />
      <Path d="M12 6 h6 v30 h-6z M22 6 h6 v30 h-6z" fill="#D4A843" />
      <Rect x="12" y="18" width="16" height="6" fill="#D4A843" />
    </Svg>
  );
}

export default function AuthScreen({ route, navigation }: any) {
  const mode = route?.params?.mode || 'login';
  const [isLogin, setIsLogin]               = useState(mode === 'login');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [fullName, setFullName]             = useState('');
  const [phone, setPhone]                   = useState('');
  const [role, setRole]                     = useState<Role>('patient');
  const [showPassword, setShowPassword]     = useState(false);
  const [loading, setLoading]               = useState(false);
  const [medicalLicense, setMedicalLicense] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalName, setHospitalName]     = useState('');
  const toast = useToast();

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !fullName)) {
      toast.showWarning('Required Fields', 'Please fill in all required fields.');
      return;
    }
    if (!validateEmail(email)) { toast.showError('Invalid Email', 'Enter a valid email address.'); return; }
    if (password.length < 8)   { toast.showError('Weak Password', 'Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.showError('Login Failed', 'Invalid email or password.');
          } else if (error.message.includes('Email not confirmed')) {
            toast.showWarning('Verify Email', 'Please verify your email before signing in.');
          } else {
            toast.showError('Login Error', 'Unable to sign in. Try again.');
          }
        } else {
          toast.showSuccess('Welcome Back', 'Signed in to Hbridge.');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, phone } },
        });
        if (error) {
          if (error.message.includes('already registered')) {
            toast.showWarning('Account Exists', 'This email is already registered. Sign in instead.');
          } else {
            toast.showError('Registration Error', error.message || 'Unable to create account.');
          }
        } else if (data.user) {
          await new Promise(r => setTimeout(r, 500));
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            phone: phone || null,
            user_type: role,
            medical_license: role === 'doctor' ? medicalLicense : null,
            specialization: role === 'doctor' ? specialization : null,
            hospital_name: role === 'hospital_admin' ? hospitalName : null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
          toast.showSuccess('Account Created', 'Welcome to Hbridge!');
          await supabase.auth.signInWithPassword({ email, password });
        }
      }
    } catch { toast.showError('Connection Error', 'Check your internet and try again.'); }
    finally { setLoading(false); }
  };

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
            <View style={s.logoBox}>
              <HBridgeMark size={32} />
            </View>
            <Text style={s.headline}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
            <Text style={s.subline}>
              {isLogin ? 'Sign in to your health companion' : "Join Nigeria's leading health platform"}
            </Text>
          </View>

          {/* Segmented tabs */}
          <View style={s.segRow}>
            <TouchableOpacity
              style={[s.seg, isLogin && s.segActive]}
              onPress={() => setIsLogin(true)}
            >
              <Text style={[s.segText, isLogin && s.segTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.seg, !isLogin && s.segActive]}
              onPress={() => setIsLogin(false)}
            >
              <Text style={[s.segText, !isLogin && s.segTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Sign-up only fields */}
          {!isLogin && (
            <>
              <Field label="Full Name" icon="person-outline">
                <TextInput
                  style={s.fieldInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor={C.muted2}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Phone Number" icon="call-outline">
                <TextInput
                  style={s.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+234 XXX XXX XXXX"
                  placeholderTextColor={C.muted2}
                  keyboardType="phone-pad"
                />
              </Field>

              {/* Account type */}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Account Type</Text>
                <View style={s.roleRow}>
                  {([
                    { value: 'patient',        label: 'Patient',  icon: 'person-outline'   },
                    { value: 'doctor',         label: 'Doctor',   icon: 'heart-outline'    },
                    { value: 'hospital_admin', label: 'Hospital', icon: 'business-outline' },
                  ] as const).map(r => {
                    const active = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[s.roleCard, active && s.roleCardActive]}
                        onPress={() => setRole(r.value)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.roleIconBox, active && s.roleIconBoxActive]}>
                          <Ionicons name={r.icon as any} size={20} color={active ? C.teal : C.muted} />
                        </View>
                        <Text style={[s.roleLabel, active && s.roleLabelActive]}>{r.label}</Text>
                        {active && (
                          <View style={s.roleCheck}>
                            <Ionicons name="checkmark" size={9} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Doctor extras */}
              {role === 'doctor' && (
                <>
                  <Field label="Medical License" icon="document-text-outline">
                    <TextInput
                      style={s.fieldInput}
                      value={medicalLicense}
                      onChangeText={setMedicalLicense}
                      placeholder="License number"
                      placeholderTextColor={C.muted2}
                      autoCapitalize="characters"
                    />
                  </Field>
                  <Field label="Specialization" icon="medkit-outline">
                    <TextInput
                      style={s.fieldInput}
                      value={specialization}
                      onChangeText={setSpecialization}
                      placeholder="e.g. Cardiology, General Practice"
                      placeholderTextColor={C.muted2}
                      autoCapitalize="words"
                    />
                  </Field>
                </>
              )}

              {/* Hospital extras */}
              {role === 'hospital_admin' && (
                <Field label="Hospital Name" icon="business-outline">
                  <TextInput
                    style={s.fieldInput}
                    value={hospitalName}
                    onChangeText={setHospitalName}
                    placeholder="Hospital name"
                    placeholderTextColor={C.muted2}
                    autoCapitalize="words"
                  />
                </Field>
              )}
            </>
          )}

          {/* Email */}
          <Field label="Email address" icon="mail-outline">
            <TextInput
              style={s.fieldInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={C.muted2}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          {/* Password */}
          <View style={s.fieldGroup}>
            <View style={s.fieldLabelRow}>
              <Text style={s.fieldLabel}>Password</Text>
              {isLogin && (
                <TouchableOpacity onPress={() => navigation.navigate('ResetPassword', { initialEmail: email })}>
                  <Text style={s.forgotText}>Forgot?</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.fieldRow}>
              <Ionicons name="lock-closed-outline" size={19} color={C.teal} />
              <TextInput
                style={[s.fieldInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
                placeholderTextColor={C.muted2}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={19} color={C.muted2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary button */}
          <TouchableOpacity style={s.primaryBtn} onPress={handleAuth} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={['#0C6570', '#083C42']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.primaryGradient}>
              <Text style={s.primaryBtnText}>{loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Switch mode */}
          <View style={s.switchRow}>
            <Text style={s.switchText}>{isLogin ? "Don't have an account? " : 'Already have an account? '}</Text>
            <TouchableOpacity onPress={() => setIsLogin(v => !v)}>
              <Text style={s.switchLink}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer (sign up only) */}
          {!isLogin && (
            <View style={s.disclaimer}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#8A6A1F" />
              <Text style={s.disclaimerText}>
                By creating an account you agree to our{' '}
                <Text style={s.disclaimerLink} onPress={() => navigation.navigate('PrivacySettings')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={s.disclaimerLink} onPress={() => navigation.navigate('PrivacySettings')}>Privacy Policy</Text>
                . Your medical data is encrypted and secure.
              </Text>
            </View>
          )}

          {/* Trust badge */}
          <View style={s.trustBadge}>
            <Ionicons name="lock-closed-outline" size={14} color="#8A6A1F" />
            <Text style={s.trustText}>Bank-grade encryption · NDPR compliant · Your data stays private.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        <Ionicons name={icon as any} size={19} color={C.teal} />
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.paper },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },

  heroSection: { alignItems: 'center', paddingTop: 26, paddingBottom: 22 },
  logoBox: {
    width: 66, height: 66, borderRadius: 20,
    borderTopLeftRadius: 6, borderBottomRightRadius: 6,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 20, elevation: 10,
    marginBottom: 14,
  },
  headline: { fontSize: 27, fontFamily: 'Montserrat_700Bold', color: C.ink, letterSpacing: -0.3 },
  subline:  { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.textBody, marginTop: 7, textAlign: 'center' },

  segRow: {
    flexDirection: 'row', backgroundColor: C.paperDark,
    borderRadius: 14, padding: 4, marginBottom: 20,
  },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 11 },
  segActive: {
    backgroundColor: C.teal,
    shadowColor: C.teal, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  segText:       { fontSize: 14, fontFamily: 'Montserrat_500Medium', color: C.textBody },
  segTextActive: { fontFamily: 'Montserrat_700Bold', color: '#fff' },

  fieldGroup:   { gap: 7, marginBottom: 16 },
  fieldLabel:   { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.textPrimary },
  fieldLabelRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotText:   { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.teal },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 13, paddingHorizontal: 14, height: 50,
  },
  fieldInput: {
    flex: 1, fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular', color: C.textPrimary,
    paddingVertical: 0,
  },

  // Role selector
  roleRow:         { flexDirection: 'row', gap: 10 },
  roleCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: C.card, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.border,
    gap: 6, position: 'relative',
  },
  roleCardActive:  { borderColor: C.teal, backgroundColor: C.tealLight },
  roleIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: C.paperDark,
    alignItems: 'center', justifyContent: 'center',
  },
  roleIconBoxActive: { backgroundColor: 'rgba(11,126,138,0.15)' },
  roleLabel:       { fontSize: 11.5, fontFamily: 'Montserrat_600SemiBold', color: C.muted },
  roleLabelActive: { color: C.teal },
  roleCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    borderRadius: 15, overflow: 'hidden', marginBottom: 4,
    shadowColor: '#083C42', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26, shadowRadius: 22, elevation: 8,
  },
  primaryGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:  { fontSize: 15.5, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, marginBottom: 20 },
  switchText:{ fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: C.textBody },
  switchLink:{ fontSize: 13.5, fontFamily: 'Montserrat_700Bold', color: C.teal },

  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  disclaimerText: { flex: 1, fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B4E12', lineHeight: 18 },
  disclaimerLink: { fontFamily: 'SpaceGrotesk_500Medium', textDecorationLine: 'underline' },

  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 12, padding: 12,
  },
  trustText: { flex: 1, fontSize: 11.5, fontFamily: 'SpaceGrotesk_500Medium', color: '#8A6A1F', lineHeight: 16 },
});
