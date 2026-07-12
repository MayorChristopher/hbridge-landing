import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View, Animated, Image, Easing, TouchableOpacity, AppState, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from './src/lib/supabase';
import { ToastProvider, useToast } from './src/components/ToastProvider';
import { ChatBadgeProvider, useChatBadge } from './src/context/ChatBadgeContext';
import { NotificationBadgeProvider } from './src/context/NotificationBadgeContext';
import { RecordsBadgeProvider, useRecordsBadge } from './src/context/RecordsBadgeContext';
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
import DoctorIncomingRecordsScreen from './src/screens/DoctorIncomingRecordsScreen';
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

function SpinningLogo() {
  const ring1   = React.useRef(new Animated.Value(0.85)).current;
  const ring1Op = React.useRef(new Animated.Value(0.6)).current;
  const logoS   = React.useRef(new Animated.Value(0.92)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1,   { toValue: 1.12, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(ring1Op, { toValue: 0,    duration: 900, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
          Animated.timing(logoS,   { toValue: 1.04, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1,   { toValue: 0.85, duration: 0,   useNativeDriver: true }),
          Animated.timing(ring1Op, { toValue: 0.6,  duration: 0,   useNativeDriver: true }),
          Animated.timing(logoS,   { toValue: 0.92, duration: 600, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        borderWidth: 1.5, borderColor: 'rgba(11,126,138,0.5)',
        backgroundColor: 'rgba(11,126,138,0.07)',
        transform: [{ scale: ring1 }], opacity: ring1Op,
      }} />
      <Animated.Image
        source={require('./assets/hbridge3.png')}
        style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', transform: [{ scale: logoS }] }}
        resizeMode="cover"
      />
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

  const initializeUpdates = async () => {
    // skipped in dev to avoid slow startup
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
    const cameFromOnboarding = React.useRef(false);

    // Keep profile image in tab bar in sync with profile updates
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
              .select('user_type, profile_image, onboarding_complete')
              .eq('id', user.id)
              .maybeSingle();

            if (data) { profile = data; break; }
            if (attempt < 2) await new Promise(r => setTimeout(r, 800));
          }

          const type = (profile?.user_type as UserType) || 'patient';
          setUserType(type);
          setProfileImage(profile?.profile_image || null);

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
            }
            setShowTutorial(true);
          }
        } catch (error) {
          console.error('Error getting user type:', ErrorHandler.sanitizeError(error));
          setUserType('patient');
        }
      };
      getUserType();
    }, []);

    // Show tutorial after returning from onboarding
    useEffect(() => {
      const unsubscribe = (navigation as any).addListener('focus', () => {
        if (cameFromOnboarding.current) {
          cameFromOnboarding.current = false;
          setShowTutorial(true);
        }
      });
      return unsubscribe;
    }, [navigation]);

    // Show loading until user type is determined
    if (userType === null) {
      return (
        <View style={{ flex: 1, backgroundColor: '#083236', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <SpinningLogo />
          <ActivityIndicator size="small" color="rgba(255,255,255,0.55)" />
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
        <>
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
        </>
      );
    }

    // Doctor Navigation
    if (userType === 'doctor') {
      return (
        <>
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
          {showTutorial && (
            <TutorialOverlay userType="doctor" userId={userId} onComplete={() => setShowTutorial(false)} />
          )}
        </>
      );
    }

    // Hospital Admin - redirect to web dashboard
    if (userType === 'hospital_admin') {
      return (
        <View style={{ flex: 1, backgroundColor: '#083236', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Image source={require('./assets/hbridge3.png')} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 28 }} resizeMode="cover" />
          <Text style={{ fontSize: 22, fontFamily: 'Montserrat_700Bold', color: '#fff', textAlign: 'center', marginBottom: 10 }}>
            Hospital Dashboard
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
            The hospital admin dashboard is available on the web. Open the link below on your browser to manage your hospital.
          </Text>
          <View style={{ width: '100%', gap: 12 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#0B7E8A', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
              onPress={() => Linking.openURL('https://hbridge.ng/hospital')}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: '#fff' }}>Open Web Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)' }}
              onPress={() => supabase.auth.signOut()}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: 'rgba(255,255,255,0.75)' }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        <PaystackProvider publicKey="pk_live_bffbf95e5e25d5d56521b8619c35923e4553ac1f">
        <ToastProvider>
          <ChatBadgeProvider>
            <RecordsBadgeProvider>
            <NotificationBadgeProvider>
              <ToastInitializer />
              <NavigationContainer>
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
            <Stack.Screen name="DoctorIncomingRecords" component={DoctorIncomingRecordsScreen} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="ShareRecord" component={ShareRecordScreen} />
            <Stack.Screen name="Patients" component={DoctorPatientsScreen} />
            
            {/* Hospital Admin Screens */}
            <Stack.Screen name="HospitalCommandCenter" component={HospitalCommandCenterScreen} />
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
