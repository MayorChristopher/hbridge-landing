import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View, Animated, Image, Easing, TouchableOpacity, AppState, Modal, StyleSheet, ActivityIndicator, DeviceEventEmitter, TextInput, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from './src/lib/supabase';
import { ToastProvider, useToast } from './src/components/ToastProvider';
import { ChatBadgeProvider, useChatBadge } from './src/context/ChatBadgeContext';
import { NotificationBadgeProvider } from './src/context/NotificationBadgeContext';
import { RecordsBadgeProvider, useRecordsBadge } from './src/context/RecordsBadgeContext';
import { PresenceProvider } from './src/context/PresenceContext';
import TutorialOverlay from './src/components/TutorialOverlay';
import { setGlobalToastInstance } from './src/utils/toast';
import SplashScreen from './src/components/SplashScreen';
import AnalyticsService from './src/services/analyticsService';
import ErrorTrackingService from './src/services/errorTrackingService';
import * as Updates from 'expo-updates';
import { useCustomFonts } from './src/hooks/useCustomFonts';
import AnimatedTabBar from './src/components/AnimatedTabBar';
import { PaystackProvider } from 'react-native-paystack-webview';
import { telegramTransition, springOpen, springClose } from './src/utils/transitions';
import FadeScreen from './src/components/FadeScreen';

import EmergencyScreen from './src/screens/EmergencyScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import SearchScreen from './src/screens/SearchScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import NetworkTestScreen from './src/screens/NetworkTestScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import NewPasswordScreen from './src/screens/NewPasswordScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HospitalDetailScreen from './src/screens/HospitalDetailScreen';
import DoctorDetailScreen from './src/screens/DoctorDetailScreen';
import SupportScreen from './src/screens/SupportScreen';
import BookConsultationScreen from './src/screens/BookConsultationScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import MedicalHistoryScreen from './src/screens/MedicalHistoryScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import PrivacySettingsScreen from './src/screens/PrivacySettingsScreen';
import MedicalRecordsScreen from './src/screens/MedicalRecordsScreen';
import HospitalRecordsScreen from './src/screens/HospitalRecordsScreen';
import TransferredRecordsScreen from './src/screens/TransferredRecordsScreen';
import RecordDetailScreen from './src/screens/RecordDetailScreen';
import RecordsListScreen from './src/screens/RecordsListScreen';
import UploadRecordScreen from './src/screens/UploadRecordScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

// Doctor Screens
import DoctorHomeScreen from './src/screens/DoctorHomeScreen';
import DoctorAppointmentRequestsScreen from './src/screens/DoctorAppointmentRequestsScreen';
import DoctorCaseFilesScreen from './src/screens/DoctorCaseFilesScreen';
import DoctorPatientsScreen from './src/screens/DoctorPatientsScreen';
import PatientDetailScreen from './src/screens/PatientDetailScreen';
import ShareRecordScreen from './src/screens/ShareRecordScreen';
import HospitalsListScreen from './src/screens/HospitalsListScreen';
import DoctorsListScreen from './src/screens/DoctorsListScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ConversationScreen from './src/screens/ConversationScreen';
import AIChatScreen from './src/screens/AIChatScreen';
import FloatingAIChat from './src/components/FloatingAIChat';
import OnboardingScreen from './src/screens/OnboardingScreen';

import { DEV_SCREENS, isDevelopment } from './src/utils/devScreens';

// Hospital Admin Screens
import HospitalCommandCenterScreen from './src/screens/HospitalCommandCenterScreen';
import HospitalHomeScreen from './src/screens/HospitalHomeScreen';
import HospitalStaffScreen from './src/screens/HospitalStaffScreen';
import HospitalIncomingRecordsScreen from './src/screens/HospitalIncomingRecordsScreen';
import HospitalAffiliationScreen from './src/screens/HospitalAffiliationScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

import { useNavigation } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserType = 'patient' | 'doctor' | 'hospital_admin';

import { ErrorHandler } from './src/utils/errorHandler';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Prevents TabNavigator from re-navigating to Onboarding during the same app process session
let _obAlreadyNavigated = false;

function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [checking, setChecking] = React.useState(false);

  const tryUnlock = async () => {
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your identity to continue',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });
        if (result.success) { onUnlock(); return; }
      } else {
        // No biometric enrolled — unlock directly
        onUnlock();
      }
    } catch { /* ignore */ }
    setChecking(false);
  };

  React.useEffect(() => { tryUnlock(); }, []);

  return (
    <View style={lockStyles.overlay}>
      <View style={lockStyles.card}>
        <View style={lockStyles.iconWrap}>
          <Ionicons name="lock-closed" size={36} color="#0B7E8A" />
        </View>
        <Text style={lockStyles.title}>App Locked</Text>
        <Text style={lockStyles.sub}>You were away for a while.{'\n'}Verify your identity to continue.</Text>
        <TouchableOpacity style={lockStyles.btn} onPress={tryUnlock} disabled={checking}>
          <Ionicons name="finger-print" size={20} color="#fff" />
          <Text style={lockStyles.btnText}>{checking ? 'Verifying…' : 'Unlock'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#083236', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  card:     { backgroundColor: '#F5F3EE', borderRadius: 28, padding: 36, alignItems: 'center', width: '80%', gap: 12 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(11,126,138,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:    { fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#0C2E30' },
  sub:      { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', textAlign: 'center', lineHeight: 20 },
  btn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0B7E8A', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  btnText:  { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});

function WelcomeBackScreen({
  user,
  onUnlock,
  onSwitchAccount,
}: {
  user: { name: string; photo: string | null; email: string; userType?: string; title?: string };
  onUnlock: () => void;
  onSwitchAccount: () => void;
}) {
  const [hasBiometric, setHasBiometric] = React.useState(false);
  const [bioChecking, setBioChecking]   = React.useState(false);
  const [password, setPassword]         = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [pwLoading, setPwLoading]       = React.useState(false);
  const [pwError, setPwError]           = React.useState('');
  const fadeIn      = React.useRef(new Animated.Value(0)).current;
  const avatarScale = React.useRef(new Animated.Value(0.88)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1, tension: 65, friction: 9, useNativeDriver: true,
      }),
    ]).start();

    // Check biometric availability first — only auto-prompt if enrolled
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setHasBiometric(true);
        tryBiometric();
      }
      // No biometric — show password input only, no auto-unlock
    })();
  }, []);

  const tryBiometric = async () => {
    setBioChecking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to continue',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) { onUnlock(); return; }
    } catch {}
    setBioChecking(false);
  };

  const handlePasswordUnlock = async () => {
    if (!password.trim()) { setPwError('Enter your password'); return; }
    setPwError('');
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password.trim(),
      });
      if (error) {
        setPwError('Incorrect password. Try again.');
      } else {
        onUnlock();
      }
    } catch {
      setPwError('Something went wrong. Try again.');
    }
    setPwLoading(false);
  };

  const displayName = (() => {
    if (!user.name) return 'there';
    if (user.userType === 'doctor') {
      const prefixes: Record<string, string> = {
        dr: 'Dr.', prof: 'Prof.', nurse: 'Nurse', pharm: 'Pharm.', physio: 'Physio.',
      };
      const prefix = user.title ? (prefixes[user.title.toLowerCase()] ?? user.title) : 'Dr.';
      return `${prefix} ${user.name.split(' ').pop()}`;
    }
    return user.name.split(' ')[0];
  })();
  const initial = (user.name || 'H')[0]?.toUpperCase() || 'H';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F5F3EE' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" backgroundColor="transparent" translucent />

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        <ScrollView
          contentContainerStyle={wbStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <Image source={require('./assets/hbridge3.png')} style={wbStyles.logoImg} resizeMode="cover" />

          {/* Avatar */}
          <Animated.View style={[wbStyles.avatarWrap, { transform: [{ scale: avatarScale }] }]}>
            {user.photo ? (
              <Image source={{ uri: user.photo }} style={wbStyles.avatar} resizeMode="cover" />
            ) : (
              <View style={wbStyles.avatarPlaceholder}>
                <Text style={wbStyles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </Animated.View>

          <Text style={wbStyles.greeting}>Welcome back</Text>
          <Text style={wbStyles.name}>{displayName}</Text>

          {/* Biometric — only shown if device has it enrolled */}
          {hasBiometric && (
            <>
              <TouchableOpacity
                style={wbStyles.bioBtn}
                onPress={tryBiometric}
                disabled={bioChecking}
                activeOpacity={0.85}
              >
                <View style={wbStyles.bioBtnInner}>
                  <Ionicons name="finger-print" size={20} color="#fff" />
                  <Text style={wbStyles.bioText}>{bioChecking ? 'Verifying…' : 'Use Biometric'}</Text>
                </View>
              </TouchableOpacity>

              <View style={wbStyles.dividerRow}>
                <View style={wbStyles.dividerLine} />
                <Text style={wbStyles.dividerLabel}>or enter password</Text>
                <View style={wbStyles.dividerLine} />
              </View>
            </>
          )}

          {/* Password input */}
          <View style={wbStyles.fieldGroup}>
            <Text style={wbStyles.fieldLabel}>Password</Text>
            <View style={wbStyles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={19} color="#0B7E8A" />
              <TextInput
                style={wbStyles.input}
                placeholder="Enter your password"
                placeholderTextColor="#97A2A0"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => { setPassword(t); setPwError(''); }}
                onSubmitEditing={handlePasswordUnlock}
                returnKeyType="go"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#97A2A0" />
              </TouchableOpacity>
            </View>
            {pwError ? <Text style={wbStyles.errorText}>{pwError}</Text> : null}
          </View>

          <TouchableOpacity
            style={[wbStyles.continueBtn, (!password.trim() || pwLoading) && { opacity: 0.45 }]}
            onPress={handlePasswordUnlock}
            disabled={!password.trim() || pwLoading}
            activeOpacity={0.85}
          >
            <View style={wbStyles.continueBtnInner}>
              {pwLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={wbStyles.continueText}>Continue</Text>}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitchAccount} activeOpacity={0.6} style={wbStyles.switchRow}>
            <Text style={wbStyles.switchText}>Not {displayName}?</Text>
            <Text style={wbStyles.switchLink}>Switch account</Text>
          </TouchableOpacity>

          {/* Trust badge */}
          <View style={wbStyles.trustBadge}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#8A6A1F" />
            <Text style={wbStyles.trustText}>Bank-grade encryption · Your data stays private.</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const wbStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1, alignItems: 'center',
    paddingHorizontal: 28, paddingTop: 72, paddingBottom: 48,
  },

  logoImg: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: '#0B7E8A',
    marginBottom: 28,
    shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 20, elevation: 10,
  },

  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2.5, borderColor: '#D4A843',
    marginBottom: 16, overflow: 'hidden',
    backgroundColor: '#0B7E8A',
    shadowColor: '#D4A843', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B7E8A' },
  avatarInitial: { fontSize: 32, fontFamily: 'Montserrat_800ExtraBold', color: '#fff' },

  greeting: {
    fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7A8785', letterSpacing: 0.3, marginBottom: 4,
  },
  name: {
    fontSize: 28, fontFamily: 'Montserrat_800ExtraBold',
    color: '#0C2E30', letterSpacing: -0.5, marginBottom: 28,
  },

  bioBtn: {
    borderRadius: 15, overflow: 'hidden', width: '100%', marginBottom: 20,
    shadowColor: '#083C42', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 18, elevation: 6,
  },
  bioBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#0B7E8A',
    paddingVertical: 15,
  },
  bioText: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAE5DA' },
  dividerLabel: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0' },

  fieldGroup: { width: '100%', gap: 7, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: '#16211F' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DA',
    borderRadius: 13, paddingHorizontal: 14, height: 50,
    width: '100%',
  },
  input: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: '#16211F', paddingVertical: 0 },
  errorText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#EF4444', marginTop: 4 },

  continueBtn: {
    borderRadius: 15, overflow: 'hidden', width: '100%', marginBottom: 20,
    shadowColor: '#083C42', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 18, elevation: 6,
  },
  continueBtnInner: {
    height: 52, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#083C42',
  },
  continueText: { fontSize: 15.5, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  switchText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#7A8785' },
  switchLink: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#0B7E8A' },

  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(212,168,67,0.10)', borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.28)', borderRadius: 12,
    padding: 12, width: '100%',
  },
  trustText: { flex: 1, fontSize: 11.5, fontFamily: 'SpaceGrotesk_500Medium', color: '#8A6A1F', lineHeight: 16 },
});

const updateStyles = StyleSheet.create({
  banner: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: '#0B7E8A', borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  bannerTitle: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  bannerSub: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  bannerBtn: {
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  bannerBtnText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#0B7E8A' },
});

function RolePickerScreen({ roles, onSelect, user }: { roles: UserType[]; onSelect: (r: UserType) => void; user?: { name: string; photo: string | null; email: string } | null }) {
  const ROLE_META: Record<string, {
    label: string; sub: string; desc: string;
    icon: string; mat?: boolean;
    color: string; dimColor: string; tag: string;
  }> = {
    patient: {
      label: 'Patient',        sub: 'Personal health',
      desc:  'Access your records, book appointments\nand chat with your AI health assistant.',
      icon: 'person',          color: '#0B7E8A', dimColor: 'rgba(11,126,138,0.18)',
      tag: 'Health',
    },
    doctor: {
      label: 'Practitioner',   sub: 'Clinical workspace',
      desc:  'Manage patients, view case files\nand handle consultation requests.',
      icon: 'stethoscope',     mat: true,
      color: '#1E9E5A',        dimColor: 'rgba(30,158,90,0.18)',
      tag: 'Clinical',
    },
    hospital_admin: {
      label: 'Hospital Admin', sub: 'Command center',
      desc:  'Oversee incoming records, manage\nyour hospital and connected staff.',
      icon: 'business',        color: '#D4A843', dimColor: 'rgba(212,168,67,0.18)',
      tag: 'Admin',
    },
  };

  const anims = React.useRef(roles.map(() => new Animated.Value(0))).current;

  const fadeIn      = React.useRef(new Animated.Value(0)).current;
  const avatarScale = React.useRef(new Animated.Value(0.88)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(avatarScale, { toValue: 1, tension: 65, friction: 9, useNativeDriver: true }),
    ]).start();
    Animated.stagger(90,
      anims.map(a => Animated.spring(a, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }))
    ).start();
  }, []);

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F3EE' }}>
      <Animated.ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeIn }}
      >
        {/* Brand logo */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image
            source={require('./assets/hbridge3.png')}
            style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: '#0B7E8A' }}
            resizeMode="cover"
          />
        </View>

        {/* User profile photo + name */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Animated.View style={{ transform: [{ scale: avatarScale }], marginBottom: 14 }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, borderColor: '#EAE5DA', backgroundColor: '#EDE9E0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {user?.photo
                ? <Image source={{ uri: user.photo }} style={{ width: 90, height: 90, borderRadius: 45 }} resizeMode="cover" />
                : <Text style={{ fontSize: 30, fontFamily: 'Montserrat_800ExtraBold', color: '#0B7E8A' }}>{initial}</Text>}
            </View>
          </Animated.View>
          <Text style={{ fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', letterSpacing: -0.4, marginBottom: 4 }}>
            {user?.name || 'Welcome back'}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#5C6B69' }}>
            Choose your workspace to continue
          </Text>
        </View>

        {/* Role cards — SignIn field style */}
        <View style={{ gap: 12 }}>
          {roles.map((r, i) => {
            const meta = ROLE_META[r];
            if (!meta) return null;
            return (
              <Animated.View
                key={r}
                style={{
                  opacity: anims[i],
                  transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => onSelect(r)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: '#EAE5DA',
                    backgroundColor: '#FFFFFF',
                    paddingVertical: 14, paddingHorizontal: 16, gap: 14,
                    shadowColor: '#0C2E30',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View style={{
                    width: 46, height: 46, borderRadius: 13,
                    backgroundColor: meta.dimColor,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {meta.mat
                      ? <MaterialCommunityIcons name={meta.icon as any} size={23} color={meta.color} />
                      : <Ionicons name={meta.icon as any} size={23} color={meta.color} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <Text style={{ fontSize: 15, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', letterSpacing: -0.2 }}>
                        {meta.label}
                      </Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: meta.dimColor }}>
                        <Text style={{ fontSize: 9, fontFamily: 'Montserrat_700Bold', color: meta.color, letterSpacing: 0.5 }}>
                          {meta.tag}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7E7F', lineHeight: 17 }}>
                      {meta.sub}
                    </Text>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: meta.dimColor, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-forward" size={15} color={meta.color} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Trust badge — matches SignIn bottom bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(212,168,67,0.10)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.30)', borderRadius: 12, padding: 12, marginTop: 28 }}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#8A6A1F" />
          <Text style={{ flex: 1, fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#8A6A1F', lineHeight: 16 }}>
            Bank-grade encryption · HIPAA-aligned. Switch securely between your accounts.
          </Text>
        </View>

        <Text style={{ textAlign: 'center', fontSize: 11.5, fontFamily: 'SpaceGrotesk_400Regular', color: '#97A2A0', marginTop: 20 }}>
          Switch anytime from your Profile tab
        </Text>
      </Animated.ScrollView>
    </View>
  );
}

function SpinningLogo() {
  const innerScale = React.useRef(new Animated.Value(1)).current;
  const outerScale = React.useRef(new Animated.Value(0.88)).current;
  const outerOp    = React.useRef(new Animated.Value(0.3)).current;
  const logoScale  = React.useRef(new Animated.Value(1)).current;
  const dot1       = React.useRef(new Animated.Value(0.3)).current;
  const dot2       = React.useRef(new Animated.Value(0.3)).current;
  const dot3       = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    // Inner ring: gentle breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(innerScale, { toValue: 1.07, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(innerScale, { toValue: 1.0,  duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    // Outer ring: slower pulse, offset phase
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(outerScale, { toValue: 1.0,  duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(outerOp,    { toValue: 0.55, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(outerScale, { toValue: 0.88, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(outerOp,    { toValue: 0.3,  duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Logo: subtle breathe, counter-phase to inner ring
    Animated.loop(
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(logoScale, { toValue: 1.04, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 0.97, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    // Loading dots stagger
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1,   duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );

    pulse(dot1, 0).start();
    pulse(dot2, 200).start();
    pulse(dot3, 400).start();
  }, []);

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Dual rings + logo */}
      <View style={{ width: 164, height: 164, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Animated.View style={{
          position: 'absolute', width: 164, height: 164, borderRadius: 82,
          borderWidth: 1, borderColor: 'rgba(11,126,138,0.38)',
          transform: [{ scale: outerScale }], opacity: outerOp,
        }} />
        <Animated.View style={{
          position: 'absolute', width: 120, height: 120, borderRadius: 60,
          borderWidth: 1.5, borderColor: 'rgba(11,126,138,0.75)',
          backgroundColor: 'rgba(11,126,138,0.10)',
          transform: [{ scale: innerScale }],
        }} />
        <Animated.Image
          source={require('./assets/hbridge3.png')}
          style={{
            width: 84, height: 84, borderRadius: 42,
            borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.28)',
            transform: [{ scale: logoScale }],
          }}
          resizeMode="cover"
        />
      </View>

      {/* Brand name */}
      <Text style={{
        fontSize: 28, fontFamily: 'Montserrat_800ExtraBold',
        fontWeight: '800', color: '#ffffff',
        letterSpacing: -1, marginBottom: 14,
      }}>
        hbridge
      </Text>

      {/* Pulsing dots */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View key={i} style={{
            width: 5, height: 5, borderRadius: 2.5,
            backgroundColor: 'rgba(11,126,138,0.9)',
            opacity: anim,
          }} />
        ))}
      </View>
    </View>
  );
}

export default function App() {
  const fontsLoaded = useCustomFonts();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [lastRoute, setLastRoute] = useState<string>('Main');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [locked, setLocked] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(true);
  const [welcomeUser, setWelcomeUser] = useState<{ name: string; photo: string | null; email: string; userType?: string; title?: string } | null>(null);
  const navigationRef = React.useRef<any>(null);
  const bgTimestampRef = useRef<number | null>(null);
  const LOCK_THRESHOLD_MS = 5 * 60 * 1000; // lock after 5 minutes in background

  useEffect(() => {
    // Initialize app immediately - skip heavy validation tests
    initializeTracking();
    loadLastRoute();
    initializeApp();

    // Run non-blocking update check in background
    initializeUpdates();
  }, []);

  // Biometric lock: trigger after 5+ minutes in background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        bgTimestampRef.current = Date.now();
      } else if (state === 'active') {
        if (bgTimestampRef.current !== null && session) {
          const elapsed = Date.now() - bgTimestampRef.current;
          if (elapsed >= LOCK_THRESHOLD_MS) {
            setLocked(true);
          }
        }
        bgTimestampRef.current = null;
      }
    });
    return () => sub.remove();
  }, [session]);

  // Pre-fetch user name + photo for the welcome-back screen
  useEffect(() => {
    if (!session || loading) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, hospital_name, profile_image, user_type, user_types')
        .eq('id', session.user.id)
        .maybeSingle();

      // Use the active role so the lock screen shows the right identity
      const storedRole = await AsyncStorage.getItem(`active_role_${session.user.id}`);
      const roles: string[] = (data?.user_types as string[] | null) || [data?.user_type || 'patient'];
      const effectiveType = (storedRole && roles.includes(storedRole)) ? storedRole : (data?.user_type || 'patient');

      const displayName = effectiveType === 'hospital_admin'
        ? (data?.hospital_name || data?.full_name || session.user.email?.split('@')[0] || '')
        : (data?.full_name || session.user.email?.split('@')[0] || '');

      let title: string | undefined;
      if (effectiveType === 'doctor') {
        const { data: doc } = await supabase.from('doctors').select('title').eq('user_id', session.user.id).maybeSingle();
        title = doc?.title;
      }
      setWelcomeUser({
        name: displayName,
        photo: data?.profile_image || null,
        email: session.user.email || '',
        userType: effectiveType,
        title,
      });
    })();
  }, [session?.user.id, loading]);

  const initializeUpdates = async () => {
    if (__DEV__) return;
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;
      await Updates.fetchUpdateAsync();
      // Show prompt — user decides when to restart
      setUpdateReady(true);
    } catch {}
  };

  const initializeTracking = () => {
    AnalyticsService.getInstance();
    ErrorTrackingService.getInstance();
  };

  const loadLastRoute = async () => {
    try {
      const route = await AsyncStorage.getItem('lastRoute');
      if (route) setLastRoute(route);
    } catch (error) {
      console.error('Error loading last route:', error);
    }
  };

  const initializeApp = () => {
    let mounted = true;

    // Hard 3s timeout — app always starts regardless of DB/network
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link — show new password screen, don't log them in
        setIsPasswordRecovery(true);
        setSession(session);
        clearTimeout(loadingTimeout);
        setLoading(false);
        return;
      }

      setIsPasswordRecovery(false);
      setSession(session);
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    // Also try getSession directly as a faster first check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      clearTimeout(loadingTimeout);
      setLoading(false);
    }).catch((err) => {
      console.warn('[App] getSession failed (network?):', err?.message);
      if (mounted) {
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription?.unsubscribe();
    };
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#083236" />
        <View style={{ flex: 1, backgroundColor: '#083236', alignItems: 'center', justifyContent: 'center' }}>
          <SpinningLogo />
        </View>
      </SafeAreaProvider>
    );
  }

  if (session && !isPasswordRecovery && showWelcomeBack) {
    return (
      <SafeAreaProvider>
        <WelcomeBackScreen
          user={welcomeUser || { name: session.user.email?.split('@')[0] || '', photo: null, email: session.user.email || '' }}
          onUnlock={() => setShowWelcomeBack(false)}
          onSwitchAccount={async () => {
            setShowWelcomeBack(false);
            await supabase.auth.signOut();
          }}
        />
      </SafeAreaProvider>
    );
  }

  if (!session || isPasswordRecovery) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <ToastProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {isPasswordRecovery ? (
                // User came from reset link — go straight to new password screen
                <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
              ) : (
                <>
                  <Stack.Screen name="Welcome" component={WelcomeScreen} />
                  <Stack.Screen name="SignUp" component={SignUpScreen} />
                  <Stack.Screen name="SignIn" component={SignInScreen} />
                  <Stack.Screen name="Login" component={SignInScreen} />
                  <Stack.Screen name="NetworkTest" component={NetworkTestScreen} />
                  <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    );
  }

  function TabNavigator() {
    const { unreadCount } = useChatBadge();
    const { newRecordsCount } = useRecordsBadge();
    const navigation = useNavigation();
    const [userType, setUserType] = useState<UserType | null>(null);
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [showTutorial, setShowTutorial] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [availableRoles, setAvailableRoles] = useState<UserType[]>([]);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const cameFromOnboarding = React.useRef(false);

    // Instant profile image sync when ProfileScreen saves a new photo
    useEffect(() => {
      const sub = DeviceEventEmitter.addListener('profile_image_updated', (url: string | null) => {
        setProfileImage(url);
      });
      return () => sub.remove();
    }, []);

    // Listen for role-switch request from Profile screen
    useEffect(() => {
      const sub = DeviceEventEmitter.addListener('show_role_picker', () => setShowRolePicker(true));
      return () => sub.remove();
    }, []);

    // Fallback: Realtime sync for cross-device updates
    useEffect(() => {
      let channel: any;
      const sub = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        channel = supabase
          .channel(`tab-profile-img-${user.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            (payload: any) => { if (payload.new?.profile_image !== undefined) setProfileImage(payload.new.profile_image); })
          .subscribe();
      };
      sub();
      return () => { if (channel) supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
      const getUserType = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { setUserType('patient'); return; }
          setUserId(user.id);

          // Try up to 3 times — profile may not be written yet on fresh signup
          let profile: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data, error } = await supabase
              .from('profiles')
              .select('user_type, user_types, profile_image, onboarding_complete')
              .eq('id', user.id)
              .maybeSingle();

            if (data) { profile = data; break; }
            if (attempt < 2) await new Promise(r => setTimeout(r, 800));
          }

          setProfileImage(profile?.profile_image || null);

          // Support multi-role accounts
          const roles: UserType[] = ((profile?.user_types as UserType[] | null)?.filter(Boolean)) || [(profile?.user_type as UserType) || 'patient'];
          setAvailableRoles(roles);

          let type: UserType;
          if (roles.length > 1) {
            const storedRole = await AsyncStorage.getItem(`active_role_${user.id}`);
            if (storedRole && roles.includes(storedRole as UserType)) {
              type = storedRole as UserType;
            } else {
              setShowRolePicker(true);
              return; // wait for role picker selection
            }
          } else {
            type = roles[0];
          }
          setUserType(type);

          // New users go through onboarding first; tutorial shows when they return
          // _obAlreadyNavigated prevents re-sending if TabNavigator somehow remounts
          if (profile?.onboarding_complete === false && !_obAlreadyNavigated) {
            _obAlreadyNavigated = true;
            cameFromOnboarding.current = true;
            // Clear any stale tour flag so it doesn't fire while onboarding is still showing
            await AsyncStorage.removeItem('spotlight_pending');
            (navigation as any).navigate('Onboarding');
            return;
          }

          // Only show tutorial once — check if this user has already seen it
          const tutorialKey = `tutorial_seen_${user.id}`;
          const alreadySeen = await AsyncStorage.getItem(tutorialKey);
          if (!alreadySeen) {
            await AsyncStorage.setItem(tutorialKey, 'true');
            if (type === 'patient') {
              await AsyncStorage.setItem('spotlight_pending', 'true');
            } else if (type === 'doctor') {
              await AsyncStorage.setItem('doctor_spotlight_pending', 'true');
            } else if (type === 'hospital_admin') {
              await AsyncStorage.setItem('hospital_spotlight_pending', 'true');
            }
          }
        } catch (error) {
          console.error('Error getting user type:', ErrorHandler.sanitizeError(error));
          setUserType('patient');
        }
      };
      getUserType();
    }, []);

    // Show spotlight tour after returning from onboarding
    useEffect(() => {
      const unsubscribe = (navigation as any).addListener('focus', async () => {
        if (cameFromOnboarding.current) {
          cameFromOnboarding.current = false;
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const key = `tutorial_seen_${user.id}`;
            const alreadySeen = await AsyncStorage.getItem(key);
            if (alreadySeen) return;
            await AsyncStorage.setItem(key, 'true');
            // Trigger screen-specific spotlight in the home screen
            const t = (profile as any)?.user_type ?? userType;
            if (t === 'patient') {
              await AsyncStorage.setItem('spotlight_pending', 'true');
            } else if (t === 'doctor') {
              await AsyncStorage.setItem('doctor_spotlight_pending', 'true');
            } else if (t === 'hospital_admin') {
              await AsyncStorage.setItem('hospital_spotlight_pending', 'true');
            }
          }
        }
      });
      return unsubscribe;
    }, [navigation]);

    // Multi-role picker
    if (showRolePicker) {
      return (
        <RolePickerScreen
          roles={availableRoles}
          user={welcomeUser}
          onSelect={async (r) => {
            // Write role to storage FIRST so MessagesScreen and other screens
            // read the correct role when they mount on the incoming tab navigator
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await AsyncStorage.setItem(`active_role_${user.id}`, r);
            setUserType(r);
            setShowRolePicker(false);
          }}
        />
      );
    }

    // Show loading until user type is determined
    if (userType === null) {
      return (
        <View style={{ flex: 1, backgroundColor: '#083236', alignItems: 'center', justifyContent: 'center' }}>
          <SpinningLogo />
        </View>
      );
    }

    const PATIENT_TABS = [
      { name: 'Home',    label: 'Home',    activeIcon: 'home',               inactiveIcon: 'home-outline' },
      { name: 'Explore', label: 'Explore', activeIcon: 'location',           inactiveIcon: 'location-outline' },
      { name: 'Records', label: 'Records', activeIcon: 'folder-open',        inactiveIcon: 'folder-open-outline' },
      { name: 'Chat',    label: 'Chat',    activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline' },
      { name: 'Profile', label: 'Profile', activeIcon: 'person',             inactiveIcon: 'person-outline' },
    ];

    const DOCTOR_TABS = [
      { name: 'DoctorHome',      label: 'Home',     activeIcon: 'home',               inactiveIcon: 'home-outline' },
      { name: 'Patients',        label: 'Patients', activeIcon: 'people',             inactiveIcon: 'people-outline' },
      { name: 'DoctorCaseFiles', label: 'Records',  activeIcon: 'folder-open',        inactiveIcon: 'folder-open-outline' },
      { name: 'DoctorMessages',  label: 'Messages', activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline' },
      { name: 'Profile',         label: 'Profile',  activeIcon: 'person',             inactiveIcon: 'person-outline' },
    ];

    const sharedTabOptions = {
      headerShown: false,
      tabBarShowLabel: false,
      lazy: false,
    };

    // Patient Navigation
    if (userType === 'patient') {
      return (
        <PresenceProvider userId={userId}>
          <Tab.Navigator
            tabBar={(props) => (
              <AnimatedTabBar
                {...props}
                profileImage={profileImage}
                tabs={PATIENT_TABS}
                badges={{
                  Chat: unreadCount > 0 ? unreadCount : undefined,
                }}
              />
            )}
            screenOptions={sharedTabOptions}
          >
            <Tab.Screen name="Home">{() => <HomeScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="Explore">{(props) => <SearchScreen navigation={navigation} route={props.route} />}</Tab.Screen>
            <Tab.Screen name="Records">{() => <MedicalRecordsScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="Chat">{() => <ChatScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="Profile">{() => <ProfileScreen navigation={navigation} />}</Tab.Screen>
          </Tab.Navigator>
          {/* SpotlightTour for patients is rendered inside HomeScreen, triggered via AsyncStorage 'spotlight_pending' */}
        </PresenceProvider>
      );
    }

    // Doctor Navigation
    if (userType === 'doctor') {
      return (
        <PresenceProvider userId={userId}>
          <Tab.Navigator
            tabBar={(props) => (
              <AnimatedTabBar
                {...props}
                profileImage={profileImage}
                tabs={DOCTOR_TABS}
                badges={{
                  DoctorMessages: unreadCount > 0 ? unreadCount : undefined,
                  DoctorCaseFiles: newRecordsCount > 0 ? newRecordsCount : undefined,
                }}
              />
            )}
            screenOptions={sharedTabOptions}
          >
            <Tab.Screen name="DoctorHome">{() => <DoctorHomeScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="Patients">{() => <DoctorPatientsScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="DoctorCaseFiles">{() => <DoctorCaseFilesScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="DoctorMessages">{() => <MessagesScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="Profile">{() => <ProfileScreen navigation={navigation} />}</Tab.Screen>
          </Tab.Navigator>
        </PresenceProvider>
      );
    }

    // Hospital Admin
    if (userType === 'hospital_admin') {
      const HOSPITAL_TABS = [
        { name: 'HospitalHome',    label: 'Home',     activeIcon: 'home',                    inactiveIcon: 'home-outline' },
        { name: 'HospitalStaff',   label: 'Staff',    activeIcon: 'people',                  inactiveIcon: 'people-outline' },
        { name: 'HospitalRecords', label: 'Records',  activeIcon: 'folder-open',             inactiveIcon: 'folder-open-outline' },
        { name: 'HospitalMessages',label: 'Messages', activeIcon: 'chatbubble-ellipses',     inactiveIcon: 'chatbubble-ellipses-outline' },
        { name: 'Profile',         label: 'Profile',  activeIcon: 'business',                inactiveIcon: 'business-outline' },
      ];
      return (
        <PresenceProvider userId={userId}>
          <Tab.Navigator
            tabBar={(props) => (
              <AnimatedTabBar
                {...props}
                profileImage={profileImage}
                tabs={HOSPITAL_TABS}
                badges={{ HospitalMessages: unreadCount > 0 ? unreadCount : undefined }}
              />
            )}
            screenOptions={sharedTabOptions}
          >
            <Tab.Screen name="HospitalHome">{() => <HospitalHomeScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="HospitalStaff">{() => <HospitalStaffScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="HospitalRecords">{() => <HospitalIncomingRecordsScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="HospitalMessages">{() => <MessagesScreen navigation={navigation} />}</Tab.Screen>
            <Tab.Screen name="Profile">{() => <ProfileScreen navigation={navigation} />}</Tab.Screen>
          </Tab.Navigator>
        </PresenceProvider>
      );
    }

    // Default fallback - should not happen with null check above
    return (
      <>
        <Tab.Navigator screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Home" component={HomeScreen} />
        </Tab.Navigator>
        {showTutorial && (
          <TutorialOverlay 
            userType={userType || 'patient'} 
            onComplete={() => setShowTutorial(false)} 
          />
        )}
      </>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="transparent" translucent />
        {locked && <BiometricLockScreen onUnlock={() => setLocked(false)} />}
        <PaystackProvider
          publicKey="pk_live_bffbf95e5e25d5d56521b8619c35923e4553ac1f"
          defaultChannels={['card', 'bank', 'ussd', 'bank_transfer', 'qr']}
        >
        <ToastProvider>
          <ChatBadgeProvider>
            <RecordsBadgeProvider>
            <NotificationBadgeProvider>
              <ToastInitializer />
              <NavigationContainer
                linking={{
                  prefixes: ['hbridge://'],
                  getStateFromPath(path) {
                    // hbridge://doctor/<id>
                    const m = path.match(/^doctor\/([^/?#]+)/);
                    if (m) {
                      return {
                        routes: [
                          { name: 'Main' },
                          { name: 'DoctorDetail', params: { doctor: { id: m[1] } } },
                        ],
                      };
                    }
                    return { routes: [{ name: 'Main' }] };
                  },
                }}
              >
            <Stack.Navigator 
            screenOptions={{ 
              headerShown: false,
              gestureEnabled: true,
              animationEnabled: true,
              cardStyleInterpolator: telegramTransition,
              transitionSpec: {
                open: springOpen,
                close: springClose,
              },
            }}
          >
            <Stack.Screen 
              name="Main" 
              component={TabNavigator}
              options={{
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="HospitalDetail" component={HospitalDetailScreen} />
            <Stack.Screen name="DoctorDetail" component={DoctorDetailScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="BookConsultation" component={BookConsultationScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} />
            <Stack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
            <Stack.Screen name="HospitalRecords" component={HospitalRecordsScreen} />
            <Stack.Screen name="TransferredRecords" component={TransferredRecordsScreen} />
            <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
            <Stack.Screen name="RecordsList" component={RecordsListScreen} />
            <Stack.Screen name="UploadRecord" component={UploadRecordScreen} />
            <Stack.Screen name="Appointments" component={AppointmentsScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            
            {/* Doctor Screens */}
            <Stack.Screen name="DoctorAppointmentRequests" component={DoctorAppointmentRequestsScreen} />
            <Stack.Screen name="DoctorCaseFiles" component={DoctorCaseFilesScreen} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="ShareRecord" component={ShareRecordScreen} />
            <Stack.Screen name="Patients" component={DoctorPatientsScreen} />
            
            {/* Hospital Admin Screens */}
            <Stack.Screen name="HospitalCommandCenter" component={HospitalCommandCenterScreen} />
            <Stack.Screen name="HospitalStaff" component={HospitalStaffScreen} />
            <Stack.Screen name="HospitalIncomingRecords" component={HospitalIncomingRecordsScreen} />
            <Stack.Screen name="HospitalAffiliation" component={HospitalAffiliationScreen} />
            <Stack.Screen name="HospitalsList" component={HospitalsListScreen} />
            <Stack.Screen name="DoctorsList" component={DoctorsListScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen name="Emergency" component={EmergencyScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
            
            {/* Development-only screens */}
            {isDevelopment && Object.entries(DEV_SCREENS).map(([name, component]) => (
              <Stack.Screen key={name} name={name} component={component} />
            ))}
          </Stack.Navigator>
        </NavigationContainer>

        {/* OTA update banner */}
        {updateReady && (
          <View style={updateStyles.banner}>
            <View style={updateStyles.bannerContent}>
              <Ionicons name="arrow-down-circle" size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={updateStyles.bannerTitle}>Update Available</Text>
                <Text style={updateStyles.bannerSub}>A new version of Hbridge is ready.</Text>
              </View>
              <TouchableOpacity style={updateStyles.bannerBtn} onPress={() => Updates.reloadAsync()}>
                <Text style={updateStyles.bannerBtnText}>Restart</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setUpdateReady(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        </NotificationBadgeProvider>
        </RecordsBadgeProvider>
        </ChatBadgeProvider>
      </ToastProvider>
      </PaystackProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Component to initialize global toast instance
function ToastInitializer() {
  const toast = useToast();
  
  useEffect(() => {
    setGlobalToastInstance(toast);
  }, [toast]);
  
  return null;
}
