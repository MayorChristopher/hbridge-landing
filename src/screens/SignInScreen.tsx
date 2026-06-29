import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { NetworkDiagnostic } from '../utils/networkDiagnostic';

const BIOMETRIC_EMAIL_KEY   = 'biometric_email';
const BIOMETRIC_PASS_KEY    = 'biometric_pass';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

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
        subTitle: 'Use your fingerprint or face to sign in',
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
    } catch (e: any) {
      console.warn('[Biometric] error:', e.message);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      toast.showWarning('Required Fields', 'Please fill in all fields.');
      return;
    }
    if (!validateEmail(email)) {
      toast.showError('Invalid Email', 'Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await NetworkDiagnostic.testWithRetry(
        () => supabase.auth.signInWithPassword({ email, password }),
        3, 1000
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Teal Header */}
          <View style={styles.header}>
            <View style={styles.headerBranding}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color="#ffffff" />
              </TouchableOpacity>
              <Image
                source={require('../../assets/hbridge3.png')}
                style={styles.headerLogo}
                resizeMode="cover"
              />
              <View style={styles.headerTitles}>
                <Text style={styles.headerTitle}>Welcome Back</Text>
                <Text style={styles.headerSubtitle}>Sign in to your Hbridge account</Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.card}>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#a3a3a3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#a3a3a3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#737373" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <Text style={styles.signInButtonText}>Signing in...</Text>
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Biometric */}
            {biometricAvailable && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="finger-print" size={26} color="#0B7E8A" />
                  <Text style={styles.biometricText}>
                    {biometricEnabled ? 'Sign in with Fingerprint' : 'Use Biometrics'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Sign Up Link */}
            <View style={styles.signUpSection}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signUpLink}>Sign up</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B7E8A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  headerBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    gap: 20,
  },

  // Inputs
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#404040',
  },
  forgotText: {
    fontSize: 13,
    color: '#0B7E8A',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#171717',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },

  // Button
  signInButton: {
    backgroundColor: '#0B7E8A',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#a3a3a3',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  dividerText: {
    fontSize: 13,
    color: '#a3a3a3',
    fontWeight: '500',
  },

  // Biometric
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0B7E8A',
    backgroundColor: '#E6F5F5',
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B7E8A',
  },

  // Sign up
  signUpSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  signUpText: {
    fontSize: 14,
    color: '#737373',
  },
  signUpLink: {
    fontSize: 14,
    color: '#0B7E8A',
    fontWeight: '700',
  },
});
