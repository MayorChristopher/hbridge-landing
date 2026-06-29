import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

export default function NewPasswordScreen({ navigation }: any) {
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [done, setDone]                 = useState(false);
  const toast = useToast();

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
        setDone(true);
        await supabase.auth.signOut();
        setTimeout(() => navigation.replace('SignIn'), 2000);
      }
    } catch {
      toast.showError('Error', 'Unable to update password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={48} color="#ffffff" />
          </View>
          <Text style={styles.successTitle}>Password Updated!</Text>
          <Text style={styles.successSubtitle}>
            Your password has been changed.{' \n'}Taking you to sign in...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <Image source={require('../../assets/hbridge3.png')} style={styles.headerLogo} resizeMode="cover" />
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Enter and confirm your new password below
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#a3a3a3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[
                styles.inputContainer,
                confirmPassword.length > 0 && newPassword !== confirmPassword && styles.inputError,
                confirmPassword.length > 0 && newPassword === confirmPassword && styles.inputSuccess,
              ]}>
                <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor="#a3a3a3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons
                    name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={newPassword === confirmPassword ? '#0B7E8A' : '#EF4444'}
                  />
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleUpdatePassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, paddingTop: 48, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  iconWrap: { alignItems: 'center', marginBottom: 24, paddingTop: 32, backgroundColor: '#0B7E8A' },
  headerLogo: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  titleSection: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#171717', marginBottom: 8, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#737373', lineHeight: 22, textAlign: 'center' },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#171717' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e5e5',
    paddingHorizontal: 16, height: 56,
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#fff5f5' },
  inputSuccess: { borderColor: '#0B7E8A', backgroundColor: '#E6F5F5' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#171717', paddingVertical: 0 },
  eyeButton: { padding: 4 },
  button: {
    backgroundColor: '#0B7E8A', borderRadius: 12,
    height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#a3a3a3' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  successIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#0B7E8A', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: { fontSize: 28, fontWeight: '700', color: '#171717', textAlign: 'center' },
  successSubtitle: { fontSize: 16, color: '#737373', textAlign: 'center', lineHeight: 24 },
});
