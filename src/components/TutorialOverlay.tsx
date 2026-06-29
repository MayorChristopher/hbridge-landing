import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Modal,
  Dimensions, Animated, Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

const TEAL = '#0B7E8A';
const TEAL_LIGHT = '#E6F5F5';

interface Step {
  title: string;
  description: string;
  icon: string;
  useMCI?: boolean;
  color: string;
  bg: string;
}

const STEPS: Record<string, Step[]> = {
  patient: [
    { title: 'Welcome to Hbridge', description: 'Your personal healthcare companion. Find doctors, hospitals and manage your health — all in one place.', icon: 'heart', color: '#EF4444', bg: '#FEF2F2', useMCI: false },
    { title: 'Find Doctors Nearby', description: 'Search verified doctors by specialization and location. Book consultations instantly, online or in-person.', icon: 'stethoscope', color: TEAL, bg: TEAL_LIGHT, useMCI: true },
    { title: 'AI Health Assistant', description: 'Get instant medical guidance 24/7 from our AI. Describe symptoms and get actionable advice in seconds.', icon: 'chatbubble-ellipses', color: '#8B5CF6', bg: '#F5F3FF', useMCI: false },
    { title: 'Medical Records', description: 'Store your records securely and share them with doctors when needed. Your data never leaves your control.', icon: 'document-text', color: '#F59E0B', bg: '#FFFBEB', useMCI: false },
    { title: 'Emergency SOS', description: 'One tap connects you to the nearest emergency hospital and shares your location automatically.', icon: 'shield', color: '#EF4444', bg: '#FEF2F2', useMCI: false },
  ],
  doctor: [
    { title: 'Welcome, Doctor', description: 'Your professional dashboard for managing patients, appointments and medical records.', icon: 'stethoscope', color: TEAL, bg: TEAL_LIGHT, useMCI: true },
    { title: 'Manage Appointments', description: 'View incoming consultation requests, accept or reschedule, and keep your calendar organised.', icon: 'calendar', color: '#F59E0B', bg: '#FFFBEB', useMCI: false },
    { title: 'Patient Records', description: 'Access medical records shared by patients. Keep case files organised and secure.', icon: 'folder-open', color: '#8B5CF6', bg: '#F5F3FF', useMCI: false },
    { title: 'Message Patients', description: 'Communicate directly with your patients through secure in-app messaging.', icon: 'chatbubble-ellipses', color: TEAL, bg: TEAL_LIGHT, useMCI: false },
    { title: 'Build Your Profile', description: 'Complete your professional profile to appear in patient searches and build trust with reviews.', icon: 'person-circle', color: '#EF4444', bg: '#FEF2F2', useMCI: false },
  ],
  hospital_admin: [
    { title: 'Hospital Command Center', description: 'Manage your hospital operations, patient bookings and staff from one powerful dashboard.', icon: 'business', color: TEAL, bg: TEAL_LIGHT, useMCI: false },
    { title: 'Patient Bookings', description: 'Review and accept incoming patient appointments. Reschedule with a single tap.', icon: 'calendar', color: '#F59E0B', bg: '#FFFBEB', useMCI: false },
    { title: 'Staff Management', description: 'Connect with doctors, manage availability and coordinate your medical team efficiently.', icon: 'people', color: '#8B5CF6', bg: '#F5F3FF', useMCI: false },
    { title: 'Hospital Profile', description: 'Keep your hospital information, services and contact details up to date for patients.', icon: 'create', color: '#EF4444', bg: '#FEF2F2', useMCI: false },
  ],
};

interface Props {
  userType: 'patient' | 'doctor' | 'hospital_admin';
  onComplete: () => void;
}

export default function TutorialOverlay({ userType, onComplete }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const steps = STEPS[userType];

  // Animations
  const slideX   = useRef(new Animated.Value(W)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    AsyncStorage.getItem(`tutorial_${userType}_v2`).then(seen => {
      if (!seen) setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    animateIn();
  }, [step, visible]);

  const animateIn = (fromRight = true) => {
    // Reset
    slideX.setValue(fromRight ? W : -W);
    iconScale.setValue(0.4);
    iconOpacity.setValue(0);
    textOpacity.setValue(0);
    textY.setValue(20);

    // 1. Slide card in
    Animated.spring(slideX, {
      toValue: 0,
      tension: 200,
      friction: 22,
      useNativeDriver: true,
    }).start();

    // 2. Icon pops in after 80ms
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 160,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 80);

    // 3. Text fades + rises after 160ms
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(textY, {
          toValue: 0,
          tension: 180,
          friction: 18,
          useNativeDriver: true,
        }),
      ]).start();
    }, 160);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < steps.length - 1) {
      // Slide current out left
      Animated.spring(slideX, {
        toValue: -W,
        tension: 260,
        friction: 26,
        useNativeDriver: true,
      }).start(() => {
        setStep(s => s + 1);
      });
    } else {
      finish();
    }
  };

  const goPrev = () => {
    if (step === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(slideX, {
      toValue: W,
      tension: 260,
      friction: 26,
      useNativeDriver: true,
    }).start(() => {
      setStep(s => s - 1);
      // animateIn(false) runs via useEffect
    });
  };

  // Override animateIn direction when going back
  useEffect(() => {
    if (!visible) return;
    animateIn(true);
  }, [step]);

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(`tutorial_${userType}_v2`, 'true');
    setVisible(false);
    onComplete();
  };

  if (!visible || !steps[step]) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const progress = (step + 1) / steps.length;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.backdrop}>

        {/* Animated card */}
        <Animated.View style={[s.card, { transform: [{ translateX: slideX }] }]}>

          {/* Skip */}
          <TouchableOpacity style={[s.skip, { top: insets.top + 16 }]} onPress={finish}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>

          {/* Icon area */}
          <View style={[s.iconWrap, { backgroundColor: current.bg }]}>
            <Animated.View style={{
              transform: [{ scale: iconScale }],
              opacity: iconOpacity,
            }}>
              {current.useMCI
                ? <MaterialCommunityIcons name={current.icon as any} size={72} color={current.color} />
                : <Ionicons name={current.icon as any} size={72} color={current.color} />
              }
            </Animated.View>
          </View>

          {/* Text */}
          <Animated.View style={[s.textWrap, {
            opacity: textOpacity,
            transform: [{ translateY: textY }],
          }]}>
            <Text style={s.title}>{current.title}</Text>
            <Text style={s.desc}>{current.description}</Text>
          </Animated.View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {/* Dot indicators */}
          <View style={s.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>

          {/* Buttons */}
          <View style={[s.btnRow, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            {step > 0 ? (
              <TouchableOpacity style={s.backBtn} onPress={goPrev}>
                <Ionicons name="arrow-back" size={20} color={TEAL} />
              </TouchableOpacity>
            ) : <View style={{ width: 48 }} />}

            <TouchableOpacity style={[s.nextBtn, isLast && s.nextBtnLast]} onPress={goNext}>
              <Text style={s.nextBtnText}>{isLast ? "Let's Go!" : 'Next'}</Text>
              <Ionicons
                name={isLast ? 'checkmark' : 'arrow-forward'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: H * 0.72,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 28,
    overflow: 'hidden',
  },
  skip: {
    position: 'absolute',
    right: 24,
  },
  skipText: {
    fontSize: 14,
    color: '#9AA3AE',
    fontWeight: '600',
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 36,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 32,
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0A0A0A',
    textAlign: 'center',
    fontFamily: 'Montserrat_800ExtraBold',
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 15,
    color: '#555F6D',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Montserrat_400Regular',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#F0F4F8',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: TEAL,
    borderRadius: 2,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E2E8EF',
  },
  dotActive: {
    backgroundColor: TEAL,
    width: 20,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 4,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    marginLeft: 16,
    height: 52,
    backgroundColor: TEAL,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnLast: {
    backgroundColor: '#0A0A0A',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Montserrat_700Bold',
  },
});
