import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View, Animated, Image, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import { ToastProvider, useToast } from './src/components/ToastProvider';
import { ChatBadgeProvider, useChatBadge } from './src/context/ChatBadgeContext';
import { NotificationBadgeProvider } from './src/context/NotificationBadgeContext';
import TutorialOverlay from './src/components/TutorialOverlay';
import { setGlobalToastInstance } from './src/utils/toast';
import SplashScreen from './src/components/SplashScreen';
import AnalyticsService from './src/services/analyticsService';
import ErrorTrackingService from './src/services/errorTrackingService';
import * as Updates from 'expo-updates';
import { useCustomFonts } from './src/hooks/useCustomFonts';
import AnimatedTabBar from './src/components/AnimatedTabBar';
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

function SpinningLogo() {
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 500, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.Image
      source={require('./assets/hbridge3.png')}
      style={{
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 3,
        borderColor: '#0B7E8A',
        transform: [{ scale }],
      }}
      resizeMode="cover"
    />
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
  const navigationRef = React.useRef<any>(null);

  useEffect(() => {
    // Initialize app immediately - skip heavy validation tests
    initializeTracking();
    loadLastRoute();
    initializeApp();
    
    // Run non-blocking update check in background
    initializeUpdates();
  }, []);

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
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
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
    const navigation = useNavigation();
    const [userType, setUserType] = useState<UserType | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);

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

          // Try up to 3 times — profile may not be written yet on fresh signup
          let profile: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data, error } = await supabase
              .from('profiles')
              .select('user_type, profile_image')
              .eq('id', user.id)
              .maybeSingle();

            if (data) { profile = data; break; }
            if (attempt < 2) await new Promise(r => setTimeout(r, 800));
          }

          const type = (profile?.user_type as UserType) || 'patient';
          console.log('[TabNav] user_type from DB:', type);
          setUserType(type);
          setProfileImage(profile?.profile_image || null);
          setShowTutorial(true);
        } catch (error) {
          console.error('Error getting user type:', ErrorHandler.sanitizeError(error));
          setUserType('patient');
        }
      };
      getUserType();
    }, []);

    // Show loading until user type is determined
    if (userType === null) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <SpinningLogo />
        </View>
      );
    }

    const PATIENT_TABS = [
      { name: 'Home',    activeIcon: 'home',               inactiveIcon: 'home-outline' },
      { name: 'Explore', activeIcon: 'location',           inactiveIcon: 'location-outline' },
      { name: 'Chat',   activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline' },
      { name: 'Records', activeIcon: 'documents',          inactiveIcon: 'documents-outline' },
      { name: 'Profile', activeIcon: 'person',             inactiveIcon: 'person-outline' },
    ];

    const DOCTOR_TABS = [
      { name: 'DoctorHome',    activeIcon: 'home',               inactiveIcon: 'home-outline' },
      { name: 'Search',        activeIcon: 'business',           inactiveIcon: 'business-outline' },
      { name: 'DoctorMessages', activeIcon: 'chatbubble-ellipses', inactiveIcon: 'chatbubble-ellipses-outline' },
      { name: 'Patients',      activeIcon: 'people',             inactiveIcon: 'people-outline' },
      { name: 'Profile',       activeIcon: 'person',             inactiveIcon: 'person-outline' },
    ];

    const sharedTabOptions = {
      headerShown: false,
      tabBarShowLabel: false,
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
              />
            )}
            screenOptions={sharedTabOptions}
          >
            <Tab.Screen name="Home">{() => <FadeScreen><HomeScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Explore">{() => <FadeScreen><SearchScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Chat">{() => <FadeScreen><ChatScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Records">{() => <FadeScreen><MedicalRecordsScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Profile">{() => <FadeScreen><ProfileScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
          </Tab.Navigator>
          {showTutorial && (
            <TutorialOverlay userType="patient" onComplete={() => setShowTutorial(false)} />
          )}
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
              />
            )}
            screenOptions={sharedTabOptions}
          >
            <Tab.Screen name="DoctorHome">{() => <FadeScreen><DoctorHomeScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Search">{() => <FadeScreen><SearchScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="DoctorMessages">{() => <FadeScreen><MessagesScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Patients">{() => <FadeScreen><DoctorPatientsScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
            <Tab.Screen name="Profile">{() => <FadeScreen><ProfileScreen navigation={navigation} /></FadeScreen>}</Tab.Screen>
          </Tab.Navigator>
          {showTutorial && (
            <TutorialOverlay userType="doctor" onComplete={() => setShowTutorial(false)} />
          )}
        </>
      );
    }

    // Hospital Admin - No tabs, direct to command center
    if (userType === 'hospital_admin') {
      return (
        <>
          <HospitalCommandCenterScreen navigation={navigation} />
          {showTutorial && (
            <TutorialOverlay 
              userType="hospital_admin" 
              onComplete={() => setShowTutorial(false)} 
            />
          )}
        </>
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
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <ToastProvider>
          <ChatBadgeProvider>
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
            
            {/* Development-only screens */}
            {isDevelopment && Object.entries(DEV_SCREENS).map(([name, component]) => (
              <Stack.Screen key={name} name={name} component={component} />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
        
        {/* Floating AI Chat - Available throughout the app */}
        <FloatingAIChat />
        </NotificationBadgeProvider>
        </ChatBadgeProvider>
      </ToastProvider>
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
