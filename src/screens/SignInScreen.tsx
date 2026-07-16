import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { NetworkDiagnostic } from '../utils/networkDiagnostic';

const BIOMETRIC_EMAIL_KEY   = 'biometric_email';
const BIOMETRIC_PASS_KEY    = 'biometric_pass';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

const C = {
  paper: '#F5F3EE',
  paperDark: '#EDE9E0',
  card: '#FFFFFF',
  cardBorder: '#EAE5DA',
  ink: '#0C2E30',
  teal: '#0B7E8A',
  gold: '#D4A843',
  goldBg: 'rgba(212,168,67,0.12)',
  goldBorder: 'rgba(212,168,67,0.3)',
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

export default function SignInScreen({ navigation }: any) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled]     = useState(false);
  const toast = useToast();

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  useEffect(() => { checkBiometrics(); }, []);

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      const enabled    = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      setBiometricAvailable(compatible && enrolled);
      setBiometricEnabled(enabled === 'true');
      if (compatible && enrolled && enabled === 'true') {
        setTimeout(() => handleBiometricLogin(), 500);
      }
    } catch {}
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Hbridge',
        cancelLabel: 'Use Password',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        const savedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
        const savedPass  = await SecureStore.getItemAsync(BIOMETRIC_PASS_KEY);
        if (!savedEmail || !savedPass) {
          toast.showWarning('Setup Required', 'Please sign in with your password first to enable biometrics.');
          setBiometricEnabled(false);
          await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
          return;
        }
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email: savedEmail, password: savedPass });
        if (error) {
          toast.showError('Login Failed', 'Biometric login failed. Please use your password.');
        } else {
          toast.showSuccess('Welcome Back!', 'Signed in with biometrics.');
        }
        setLoading(false);
      }
    } catch {}
  };

  const handleSignIn = async () => {
    if (!email || !password) { toast.showWarning('Required Fields', 'Please fill in all fields.'); return; }
    if (!validateEmail(email)) { toast.showError('Invalid Email', 'Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const { error } = await NetworkDiagnostic.testWithRetry(
        () => supabase.auth.signInWithPassword({ email, password }), 3, 1000
      );
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.showError('Login Failed', 'Invalid email or password.');
        } else if (error.message.includes('Email not confirmed')) {
          toast.showWarning('Verify Email', 'Please verify your email before signing in.');
        } else {
          toast.showError('Login Error', 'Unable to sign in. Please try again.');
        }
      } else {
        if (biometricAvailable && !biometricEnabled) {
          offerBiometricSetup(email, password);
        } else {
          if (biometricEnabled) {
            await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
            await SecureStore.setItemAsync(BIOMETRIC_PASS_KEY, password);
          }
          toast.showSuccess('Welcome Back', 'Signed in to Hbridge.');
        }
      }
    } catch {
      toast.showError('Connection Error', 'Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  const offerBiometricSetup = async (em: string, pw: string) => {
    toast.showSuccess('Enable Fingerprint?', 'Tap the fingerprint button below to enable quick sign-in next time.');
    await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, em);
    await SecureStore.setItemAsync(BIOMETRIC_PASS_KEY, pw);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    setBiometricEnabled(true);
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
            <Image source={require('../../assets/hbridge3.png')} style={s.logoRounded} resizeMode="cover" />
            <Text style={s.headline}>Welcome back</Text>
            <Text style={s.subline}>Sign in to your health companion</Text>
          </View>

          {/* Segmented tabs */}
          <View style={s.segRow}>
            <View style={s.segActive}>
              <Text style={s.segActiveText}>Sign In</Text>
            </View>
            <TouchableOpacity style={s.segInactive} onPress={() => navigation.navigate('SignUp')}>
              <Text style={s.segInactiveText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Email address</Text>
            <View style={s.fieldRow}>
              <Ionicons name="mail-outline" size={19} color={C.teal} />
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
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <View style={s.fieldLabelRow}>
              <Text style={s.fieldLabel}>Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
                <Text style={s.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={s.fieldRow}>
              <Ionicons name="lock-closed-outline" size={19} color={C.teal} />
              <TextInput
                style={[s.fieldInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.muted2}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={19} color={C.muted2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In button */}
          <TouchableOpacity style={s.signInBtn} onPress={handleSignIn} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={['#0C6570', '#083C42']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.signInGradient}>
              <Text style={s.signInText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Biometric */}
          {biometricAvailable && (
            <>
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>
              <TouchableOpacity style={s.biometricBtn} onPress={handleBiometricLogin} disabled={loading} activeOpacity={0.8}>
                <Ionicons name="finger-print" size={24} color={C.teal} />
                <Text style={s.biometricText}>{biometricEnabled ? 'Sign in with Fingerprint' : 'Use Biometrics'}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Sign up link */}
          <View style={s.signupRow}>
            <Text style={s.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={s.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* Trust badge */}
          <View style={s.trustBadge}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#8A6A1F" />
            <Text style={s.trustText}>Bank-grade encryption · HIPAA-aligned. Your data stays private.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F3EE' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DA', alignItems: 'center', justifyContent: 'center', marginTop: 6 },

  heroSection: { alignItems: 'center', paddingTop: 26, paddingBottom: 22 },
  logoBox: { width: 66, height: 66, borderRadius: 20, borderTopLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: '#0C2E30', alignItems: 'center', justifyContent: 'center', shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
  logoRounded: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: '#0B7E8A', shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
  headline: { fontSize: 27, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginTop: 16, letterSpacing: -0.3 },
  subline: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#5C6B69', marginTop: 7 },

  segRow: { flexDirection: 'row', backgroundColor: '#EDE9E0', borderRadius: 14, padding: 4, marginBottom: 20 },
  segActive: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 11, backgroundColor: '#0B7E8A', shadowColor: '#0B7E8A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4 },
  segActiveText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  segInactive: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  segInactiveText: { fontSize: 14, fontFamily: 'Montserrat_500Medium', color: '#5C6B69' },

  fieldGroup: { gap: 7, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#16211F' },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotText: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#0B7E8A' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DA', borderRadius: 13, paddingHorizontal: 14, height: 50 },
  fieldInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: '#16211F', paddingVertical: 0 },

  signInBtn: { borderRadius: 15, overflow: 'hidden', marginTop: 4, shadowColor: '#083C42', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.26, shadowRadius: 22, elevation: 8 },
  signInGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  signInText: { fontSize: 15.5, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAE5DA' },
  dividerText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0' },

  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DA', borderRadius: 13, height: 50 },
  biometricText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#0C2E30' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  signupText: { fontSize: 13.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#5C6B69' },
  signupLink: { fontSize: 13.5, fontFamily: 'Montserrat_700Bold', color: '#0B7E8A' },

  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(212,168,67,0.1)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)', borderRadius: 12, padding: 12, marginTop: 16 },
  trustText: { flex: 1, fontSize: 11.5, fontFamily: 'SpaceGrotesk_500Medium', color: '#8A6A1F', lineHeight: 16 },
});
