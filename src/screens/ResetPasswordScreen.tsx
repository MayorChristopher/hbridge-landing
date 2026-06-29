import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

type Step = 'email' | 'otp' | 'password';

export default function ResetPasswordScreen({ navigation }: any) {
  const [email, setEmail]               = useState('');
  const [otp, setOtp]                   = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [step, setStep]                 = useState<Step>('email');
  const toast = useToast();

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const getPasswordStrength = (p: string) => {
    if (!p) return { score: 0, label: '', color: '#e5e5e5' };
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score: 1, label: 'Weak',        color: '#ef4444' };
    if (score <= 2) return { score: 2, label: 'Fair',        color: '#f97316' };
    if (score <= 3) return { score: 3, label: 'Good',        color: '#eab308' };
    if (score <= 4) return { score: 4, label: 'Strong',      color: '#22c55e' };
    return             { score: 5, label: 'Very Strong', color: '#0B7E8A' };
  };
  const strength = getPasswordStrength(newPassword);

  const handleSendOtp = async (isResend = false) => {
    if (!email) { toast.showWarning('Required', 'Enter your email address.'); return; }
    if (!validateEmail(email)) { toast.showError('Invalid Email', 'Enter a valid email address.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        toast.showError('Error', error.message);
      } else {
        toast.showSuccess(isResend ? 'New Code Sent' : 'Code Sent', 'Check your email for the reset code.');
        setOtp('');
        setStep('otp');
      }
    } catch {
      toast.showError('Error', 'Unable to send code. Check your internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      toast.showWarning('Required', 'Enter the code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
      if (error) {
        toast.showError('Invalid Code', 'Code is incorrect or expired. Tap resend for a new one.');
      } else {
        setStep('password');
      }
    } catch {
      toast.showError('Error', 'Unable to verify code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.showWarning('Required', 'Fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      toast.showError('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.showError('Mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.showError('Error', error.message);
      } else {
        toast.showSuccess('Password Updated!', 'Please sign in with your new password.');
        await supabase.auth.signOut();
        setTimeout(() => navigation.navigate('SignIn'), 1800);
      }
    } catch {
      toast.showError('Error', 'Unable to update password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps: Step[] = ['email', 'otp', 'password'];
  const currentStepIndex = steps.indexOf(step);

  const headerTitles: Record<Step, { title: string; subtitle: string }> = {
    email:    { title: 'Forgot Password?',  subtitle: 'Enter your email to receive a reset code' },
    otp:      { title: 'Enter Code',        subtitle: `Code sent to ${email}` },
    password: { title: 'New Password',      subtitle: 'Create a strong new password' },
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
                <Text style={styles.headerTitle}>{headerTitles[step].title}</Text>
                <Text style={styles.headerSubtitle}>{headerTitles[step].subtitle}</Text>
              </View>
            </View>

            {/* Step progress */}
            <View style={styles.stepRow}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.stepDot, i <= currentStepIndex && styles.stepDotActive]} />
              ))}
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>

            {/* STEP 1: Email */}
            {step === 'email' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
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

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={() => handleSendOtp(false)}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Code'}</Text>
                    {!loading && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2: OTP */}
            {step === 'otp' && (
              <>
                <View style={styles.otpHint}>
                  <Ionicons name="information-circle-outline" size={18} color="#D4A843" />
                  <Text style={styles.otpHintText}>
                    Check your email. Copy the code at the end of the reset link (after <Text style={{ fontWeight: '700' }}>token=</Text>)
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Reset Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="keypad-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="Paste code here"
                      placeholderTextColor="#a3a3a3"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify Code'}</Text>
                    {!loading && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
                  </View>
                </TouchableOpacity>

                <View style={styles.linkRow}>
                  <TouchableOpacity onPress={() => handleSendOtp(true)} disabled={loading}>
                    <Text style={styles.linkText}>Resend code</Text>
                  </TouchableOpacity>
                  <Text style={styles.linkSep}>·</Text>
                  <TouchableOpacity onPress={() => setStep('email')}>
                    <Text style={[styles.linkText, { color: '#737373' }]}>Change email</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 3: New Password */}
            {step === 'password' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Min. 8 characters"
                      placeholderTextColor="#a3a3a3"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#737373" />
                    </TouchableOpacity>
                  </View>
                  {newPassword.length > 0 && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBars}>
                        {[1,2,3,4,5].map(i => (
                          <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength.score ? strength.color : '#e5e5e5' }]} />
                        ))}
                      </View>
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={[
                    styles.inputContainer,
                    confirmPassword.length > 0 && newPassword !== confirmPassword && styles.inputError,
                    confirmPassword.length > 0 && newPassword === confirmPassword && styles.inputSuccess,
                  ]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirm}
                      placeholder="Re-enter password"
                      placeholderTextColor="#a3a3a3"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    {confirmPassword.length > 0 && (
                      <Ionicons
                        name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={newPassword === confirmPassword ? '#0B7E8A' : '#ef4444'}
                      />
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleUpdatePassword}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Update Password'}</Text>
                    {!loading && <Ionicons name="checkmark" size={18} color="#ffffff" />}
                  </View>
                </TouchableOpacity>
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  headerBranding: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerLogo: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  stepRow: { flexDirection: 'row', gap: 8 },
  stepDot: { flex: 1, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#ffffff' },

  // Card
  card: {
    flex: 1, backgroundColor: '#ffffff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, gap: 20,
  },

  // Inputs
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#404040' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9f9f9', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e5e5',
    paddingHorizontal: 14, height: 52,
  },
  inputError:   { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  inputSuccess: { borderColor: '#0B7E8A', backgroundColor: '#E6F5F5' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#171717', paddingVertical: 0 },
  otpInput: { fontSize: 15, letterSpacing: 2 },
  eyeButton: { padding: 4 },

  // OTP hint
  otpHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fdf8ee', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#D4A84340',
  },
  otpHintText: { flex: 1, fontSize: 13, color: '#525252', lineHeight: 19 },

  // Strength
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 64, textAlign: 'right' },

  // Button
  button: {
    backgroundColor: '#0B7E8A', borderRadius: 14,
    height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonDisabled: { backgroundColor: '#a3a3a3' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  // Links
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  linkText: { fontSize: 14, color: '#0B7E8A', fontWeight: '600' },
  linkSep: { fontSize: 14, color: '#a3a3a3' },
});
