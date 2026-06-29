import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Image, Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

type Role = 'patient' | 'doctor' | 'hospital_admin';

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
  const [showForgot, setShowForgot]         = useState(false);
  const [medicalLicense, setMedicalLicense] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalName, setHospitalName]     = useState('');
  const toast = useToast();

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // ── Forgot password ────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) { toast.showWarning('Email Required', 'Enter your email to reset password.'); return; }
    if (!validateEmail(email)) { toast.showError('Invalid Email', 'Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        toast.showError('Reset Failed', 'Unable to send reset email. Try again.');
      } else {
        toast.showSuccess('Email Sent', 'Check your inbox for reset instructions.');
        setShowForgot(false);
      }
    } catch { toast.showError('Connection Error', 'Check your internet and try again.'); }
    finally { setLoading(false); }
  };

  // ── Sign in / Sign up ──────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !fullName)) {
      toast.showWarning('Required Fields', 'Please fill in all required fields.');
      return;
    }
    if (!validateEmail(email)) { toast.showError('Invalid Email', 'Enter a valid email address.'); return; }
    if (password.length < 8) { toast.showError('Weak Password', 'Password must be at least 8 characters.'); return; }

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

  // ── Forgot password screen ─────────────────────────────────────────────
  if (showForgot) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => setShowForgot(false)}>
            <Ionicons name="arrow-back" size={20} color="#171717" />
          </TouchableOpacity>

          {/* Logo */}
          <View style={s.logoWrap}>
            <View style={s.logoBox}>
              <Image source={require('../../assets/icon.png')} style={s.logoImg} resizeMode="contain" />
            </View>
            <Text style={s.appName}>Hbridge</Text>
            <Text style={s.tagline}>Reset your password</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Forgot Password</Text>
            <Text style={s.cardSubtitle}>Enter your email and we'll send you reset instructions.</Text>

            <View style={s.fieldWrap}>
              <Text style={s.label}>Email Address</Text>
              <View style={s.inputRow}>
                <Ionicons name="mail-outline" size={18} color="#737373" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#a3a3a3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{loading ? 'Sending...' : 'Send Reset Email'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.switchRow} onPress={() => setShowForgot(false)}>
              <Text style={s.switchText}>Remember your password? </Text>
              <Text style={s.switchLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main auth screen ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button (from Welcome screen) */}
          {navigation && (
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#171717" />
            </TouchableOpacity>
          )}

          {/* ── Logo & heading ── */}
          <View style={s.logoWrap}>
            <View style={s.logoBox}>
              <Image source={require('../../assets/icon.png')} style={s.logoImg} resizeMode="contain" />
            </View>
            <Text style={s.appName}>Hbridge</Text>
            <Text style={s.tagline}>
              {isLogin ? 'Welcome back to your health companion' : "Join Nigeria's leading health platform"}
            </Text>
          </View>

          {/* ── Tab switcher ── */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, isLogin && s.tabActive]}
              onPress={() => setIsLogin(true)}
            >
              <Text style={[s.tabText, isLogin && s.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, !isLogin && s.tabActive]}
              onPress={() => setIsLogin(false)}
            >
              <Text style={[s.tabText, !isLogin && s.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* ── Form card ── */}
          <View style={s.card}>

            {/* Sign-up only fields */}
            {!isLogin && (
              <>
                {/* Full name */}
                <View style={s.fieldWrap}>
                  <Text style={s.label}>Full Name *</Text>
                  <View style={s.inputRow}>
                    <Ionicons name="person-outline" size={18} color="#737373" style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Your full name"
                      placeholderTextColor="#a3a3a3"
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Phone */}
                <View style={s.fieldWrap}>
                  <Text style={s.label}>Phone Number</Text>
                  <View style={s.inputRow}>
                    <Ionicons name="call-outline" size={18} color="#737373" style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+234 XXX XXX XXXX"
                      placeholderTextColor="#a3a3a3"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Account type */}
                <View style={s.fieldWrap}>
                  <Text style={s.label}>Account Type *</Text>
                  <View style={s.roleRow}>
                    {([
                      { value: 'patient',        label: 'Patient',  icon: 'person'   },
                      { value: 'doctor',         label: 'Doctor',   icon: 'heart'    },
                      { value: 'hospital_admin', label: 'Hospital', icon: 'business' },
                    ] as const).map(r => (
                      <TouchableOpacity
                        key={r.value}
                        style={[s.roleCard, role === r.value && s.roleCardActive]}
                        onPress={() => setRole(r.value)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.roleIconWrap, role === r.value && s.roleIconWrapActive]}>
                          <Ionicons name={r.icon as any} size={20} color={role === r.value ? '#0B7E8A' : '#737373'} />
                        </View>
                        <Text style={[s.roleLabel, role === r.value && s.roleLabelActive]}>{r.label}</Text>
                        {role === r.value && (
                          <View style={s.roleCheck}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Doctor extras */}
                {role === 'doctor' && (
                  <>
                    <View style={s.fieldWrap}>
                      <Text style={s.label}>Medical License *</Text>
                      <View style={s.inputRow}>
                        <Ionicons name="document-text-outline" size={18} color="#737373" style={s.inputIcon} />
                        <TextInput
                          style={s.input}
                          value={medicalLicense}
                          onChangeText={setMedicalLicense}
                          placeholder="License number"
                          placeholderTextColor="#a3a3a3"
                          autoCapitalize="characters"
                        />
                      </View>
                    </View>
                    <View style={s.fieldWrap}>
                      <Text style={s.label}>Specialization *</Text>
                      <View style={s.inputRow}>
                        <Ionicons name="medkit-outline" size={18} color="#737373" style={s.inputIcon} />
                        <TextInput
                          style={s.input}
                          value={specialization}
                          onChangeText={setSpecialization}
                          placeholder="e.g. Cardiology, General Practice"
                          placeholderTextColor="#a3a3a3"
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Hospital extras */}
                {role === 'hospital_admin' && (
                  <View style={s.fieldWrap}>
                    <Text style={s.label}>Hospital Name *</Text>
                    <View style={s.inputRow}>
                      <Ionicons name="business-outline" size={18} color="#737373" style={s.inputIcon} />
                      <TextInput
                        style={s.input}
                        value={hospitalName}
                        onChangeText={setHospitalName}
                        placeholder="Hospital name"
                        placeholderTextColor="#a3a3a3"
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email Address *</Text>
              <View style={s.inputRow}>
                <Ionicons name="mail-outline" size={18} color="#737373" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#a3a3a3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <View style={s.labelRow}>
                <Text style={s.label}>Password *</Text>
                {isLogin && (
                  <TouchableOpacity onPress={() => setShowForgot(true)}>
                    <Text style={s.forgotLink}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color="#737373" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isLogin ? 'Your password' : 'Min. 8 characters'}
                  placeholderTextColor="#a3a3a3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#737373" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary button */}
            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <Text style={s.primaryBtnText}>Please wait...</Text>
                : <Text style={s.primaryBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
              }
            </TouchableOpacity>

            {/* Switch mode */}
            <TouchableOpacity style={s.switchRow} onPress={() => setIsLogin(v => !v)}>
              <Text style={s.switchText}>{isLogin ? "Don't have an account? " : 'Already have an account? '}</Text>
              <Text style={s.switchLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
            </TouchableOpacity>

            {/* Disclaimer (sign up only) */}
            {!isLogin && (
              <View style={s.disclaimer}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#0B7E8A" />
                <Text style={s.disclaimerText}>
                  By creating an account you agree to our{' '}
                  <Text
                    style={s.disclaimerLink}
                    onPress={() => Alert.alert('Terms of Service', 'Hbridge provides medical information for educational purposes only and is not a substitute for professional medical advice.')}
                  >Terms of Service</Text>
                  {' '}and{' '}
                  <Text
                    style={s.disclaimerLink}
                    onPress={() => Alert.alert('Privacy Policy', 'We encrypt all medical data and never share personal information with third parties.')}
                  >Privacy Policy</Text>
                  . Medical data is encrypted and HIPAA compliant.
                </Text>
              </View>
            )}
          </View>

          {/* Bottom spacer */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const TEAL   = '#0B7E8A';
const BLACK  = '#171717';
const GREY   = '#737373';
const LIGHT  = '#f5f5f5';
const BORDER = '#e5e5e5';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll:    { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: LIGHT, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },

  // Logo
  logoWrap: { alignItems: 'center', paddingVertical: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: LIGHT, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: BORDER,
    // Hbridge signature corner cut
    borderTopLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  logoImg:  { width: 52, height: 52 },
  appName:  { fontSize: 26, fontWeight: '700', color: BLACK, letterSpacing: -0.5, marginBottom: 6 },
  tagline:  { fontSize: 14, color: GREY, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  // Tab switcher
  tabRow: {
    flexDirection: 'row', backgroundColor: LIGHT,
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center',
  },
  tabActive:     { backgroundColor: TEAL  },
  tabText:       { fontSize: 14, fontWeight: '500', color: GREY },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 20, gap: 16,
  },
  cardTitle:    { fontSize: 20, fontWeight: '700', color: BLACK },
  cardSubtitle: { fontSize: 14, color: GREY, lineHeight: 20, marginTop: -8 },

  // Fields
  fieldWrap: { gap: 6 },
  labelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:     { fontSize: 13, fontWeight: '600', color: BLACK },
  forgotLink:{ fontSize: 13, color: TEAL, fontWeight: '600' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: LIGHT, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, height: 48,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, fontSize: 14, color: BLACK,
    paddingVertical: 0,
  },
  eyeBtn: { padding: 4 },

  // Role selector
  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8,
    backgroundColor: LIGHT, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    gap: 6, position: 'relative',
  },
  roleCardActive: { borderColor: TEAL, backgroundColor: '#E6F5F5' },
  roleIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  roleIconWrapActive: { borderColor: TEAL, backgroundColor: '#E8F5E9' },
  roleLabel:       { fontSize: 12, fontWeight: '600', color: GREY, textAlign: 'center' },
  roleLabelActive: { color: TEAL  },
  roleCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
  },

  // Primary button
  primaryBtn: {
    backgroundColor: TEAL, borderRadius: 12,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: { backgroundColor: '#a3a3a3' },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  // Switch
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
  switchText: { fontSize: 14, color: GREY },
  switchLink: { fontSize: 14, color: TEAL, fontWeight: '700' },

  // Disclaimer
  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#E6F5F5', borderRadius: 10,
    borderWidth: 1, borderColor: '#C8E6C9',
    padding: 12,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: '#2E7D32', lineHeight: 18 },
  disclaimerLink: { fontWeight: '700', textDecorationLine: 'underline' },
});
