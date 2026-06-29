import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { NetworkDiagnostic } from '../utils/networkDiagnostic';

type Role = 'patient' | 'doctor' | 'hospital_admin';

export default function SignUpScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [medicalLicense, setMedicalLicense] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const toast = useToast();

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const getPasswordStrength = (p: string): { score: number; label: string; color: string } => {
    if (!p) return { score: 0, label: '', color: '#e5e5e5' };
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score: 1, label: 'Weak',   color: '#ef4444' };
    if (score <= 2) return { score: 2, label: 'Fair',   color: '#f97316' };
    if (score <= 3) return { score: 3, label: 'Good',   color: '#eab308' };
    if (score <= 4) return { score: 4, label: 'Strong', color: '#22c55e' };
    return { score: 5, label: 'Very Strong', color: '#0B7E8A' };
  };

  const strength = getPasswordStrength(password);

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      toast.showWarning('Required Fields', 'Please fill in all required fields.');
      return;
    }
    if (!validateEmail(email)) {
      toast.showError('Invalid Email', 'Enter a valid email address.');
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
        () => supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone } },
        }),
        3,
        1000
      );

      if (error) {
        if (error.message.includes('already registered')) {
          toast.showWarning('Account Exists', 'This email is already registered. Sign in instead.');
        } else if (error.message?.includes('Network') || error.message?.includes('timeout')) {
          toast.showError('Connection Error', 'Please check your internet connection and try again.');
        } else {
          toast.showError('Registration Error', error.message || 'Unable to create account.');
        }
      } else if (data.user) {
        await new Promise(r => setTimeout(r, 1200));

        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) console.warn('[SignUp] early sign-in failed:', signInErr.message);

        const profilePayload: any = {
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
          user_type: role,
          medical_license: role === 'doctor' ? medicalLicense : null,
          specialization: role === 'doctor' ? specialization : null,
          hospital_name: role === 'hospital_admin' ? hospitalName : null,
          updated_at: new Date().toISOString(),
        };
        if (phone && phone.trim()) profilePayload.phone = phone.trim();

        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });

        if (profileErr) {
          console.warn('[SignUp] upsert failed:', profileErr.message);
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ user_type: role, full_name: fullName, updated_at: new Date().toISOString() })
            .eq('id', data.user.id);
          if (updateErr) {
            console.error('[SignUp] update fallback failed:', updateErr.message);
          }
        }

        if (role === 'doctor') {
          await supabase.from('doctors').upsert({
            user_id: data.user.id,
            full_name: fullName,
            specialization: specialization || 'General Practice',
            medical_license: medicalLicense || 'PENDING',
            verification_status: 'verified',
            is_available: true,
            average_rating: 0,
            total_reviews: 0,
          }, { onConflict: 'user_id' });
        }

        toast.showSuccess('Account Created', 'Welcome to Hbridge!');
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
    { value: 'patient',        label: 'Patient',  useIonicons: true,  icon: 'person-outline',   description: 'Get medical care' },
    { value: 'doctor',         label: 'Doctor',   useIonicons: false, icon: 'stethoscope',      description: 'Provide medical care' },
    { value: 'hospital_admin', label: 'Hospital', useIonicons: true,  icon: 'business-outline', description: 'Manage hospital' },
  ] as const;

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
                <Text style={styles.headerTitle}>Create Account</Text>
                <Text style={styles.headerSubtitle}>Join Nigeria's leading health platform</Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.card}>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#a3a3a3"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
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

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+234 XXX XXX XXXX"
                  placeholderTextColor="#a3a3a3"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#a3a3a3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color="#737373"
                  />
                </TouchableOpacity>
              </View>
              {/* Strength bars */}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    {[1,2,3,4,5].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: i <= strength.score ? strength.color : '#e5e5e5' }
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>I am a</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Account Type */}
            <View style={styles.roleRow}>
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.roleCard, role === option.value && styles.roleCardActive]}
                  onPress={() => setRole(option.value)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.roleIconWrap, role === option.value && styles.roleIconWrapActive]}>
                    {option.useIonicons ? (
                      <Ionicons name={option.icon as any} size={22} color={role === option.value ? '#ffffff' : '#737373'} />
                    ) : (
                      <MaterialCommunityIcons name={option.icon as any} size={22} color={role === option.value ? '#ffffff' : '#737373'} />
                    )}
                  </View>
                  <Text style={[styles.roleLabel, role === option.value && styles.roleLabelActive]}>{option.label}</Text>
                  <Text style={styles.roleDesc}>{option.description}</Text>
                  {role === option.value && (
                    <View style={styles.roleCheck}>
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Doctor specific fields */}
            {role === 'doctor' && (
              <View style={styles.extraFields}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Medical License <Text style={styles.required}>*</Text></Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="document-text-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={medicalLicense}
                      onChangeText={setMedicalLicense}
                      placeholder="Enter license number"
                      placeholderTextColor="#a3a3a3"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Specialization <Text style={styles.required}>*</Text></Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="medkit-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={specialization}
                      onChangeText={setSpecialization}
                      placeholder="e.g. Cardiology, General Practice"
                      placeholderTextColor="#a3a3a3"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Hospital admin specific fields */}
            {role === 'hospital_admin' && (
              <View style={styles.extraFields}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Hospital Name <Text style={styles.required}>*</Text></Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="business-outline" size={18} color="#0B7E8A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={hospitalName}
                      onChangeText={setHospitalName}
                      placeholder="Enter hospital name"
                      placeholderTextColor="#a3a3a3"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Terms */}
            <TouchableOpacity
              style={styles.termsContainer}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Terms & Privacy', 'Hbridge provides medical information for educational purposes only. We encrypt all medical data and never share personal information with third parties.')}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#0B7E8A" />
              <Text style={styles.termsText}>
                By continuing you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpButton, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <Text style={styles.signUpButtonText}>Creating account...</Text>
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.signUpButtonText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInSection}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                <Text style={styles.signInLink}>Sign in</Text>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },  headerLogo: {
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#404040',
  },
  required: {
    color: '#ef4444',
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
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'right',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
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

  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 6,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: '#0B7E8A',
    backgroundColor: '#E6F5F5',
  },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eeeeee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: '#0B7E8A',
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#404040',
  },
  roleLabelActive: {
    color: '#0B7E8A',
  },
  roleDesc: {
    fontSize: 11,
    color: '#a3a3a3',
    textAlign: 'center',
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0B7E8A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Extra fields
  extraFields: {
    gap: 16,
    backgroundColor: '#f0fafa',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#b2dfdb',
  },

  // Terms
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fafa',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#b2dfdb',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#525252',
    lineHeight: 18,
  },
  termsLink: {
    color: '#0B7E8A',
    fontWeight: '600',
  },

  // Button
  signUpButton: {
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
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Sign in
  signInSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  signInText: {
    fontSize: 14,
    color: '#737373',
  },
  signInLink: {
    fontSize: 14,
    color: '#0B7E8A',
    fontWeight: '700',
  },
});
