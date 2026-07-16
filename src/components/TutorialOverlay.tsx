import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Modal,
  Dimensions, Animated, Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

const C = {
  hero: '#083236', teal: '#0B7E8A', paper: '#F5F3EE',
  card: '#FFFFFF', text: '#0C2E30', muted: '#6B7E7F',
  gold: '#D4A843', border: '#EAE5DA',
};

interface Step {
  title: string;
  description: string;
  icon: string;
  useMCI?: boolean;
  accent: string;
  accentBg: string;
}

const STEPS: Record<string, Step[]> = {
  patient: [
    { title: 'Welcome to Hbridge', description: 'Your personal healthcare companion. Find doctors, hospitals and manage your health — all in one place.', icon: 'heart', accent: '#EF4444', accentBg: '#FEF2F2' },
    { title: 'Find Doctors', description: 'Browse verified specialists by specialty and location. Book online or in-person consultations instantly.', icon: 'stethoscope', accent: C.teal, accentBg: 'rgba(11,126,138,0.1)', useMCI: true },
    { title: 'AI Health Assistant', description: 'Describe your symptoms to our AI and get actionable guidance 24/7 — tap the floating button anytime.', icon: 'chatbubble-ellipses', accent: '#8B5CF6', accentBg: '#F5F3FF' },
    { title: 'Medical Records', description: 'Upload and store your records securely. Share them with any doctor with a single tap — you stay in control.', icon: 'document-text', accent: '#F59E0B', accentBg: '#FFFBEB' },
    { title: 'Emergency SOS', description: 'One tap connects you to the nearest emergency hospital and shares your live location automatically.', icon: 'shield', accent: '#EF4444', accentBg: '#FEF2F2' },
  ],
  doctor: [
    { title: 'Welcome, Doctor', description: 'Your professional dashboard for managing patients, appointments and medical records.', icon: 'stethoscope', accent: C.teal, accentBg: 'rgba(11,126,138,0.1)', useMCI: true },
    { title: 'Appointment Requests', description: 'View and manage incoming consultation requests. Accept, reschedule or complete with one tap.', icon: 'calendar', accent: '#F59E0B', accentBg: '#FFFBEB' },
    { title: 'Patient Records', description: 'Access medical records shared by patients. Keep case files organised, annotated and secure.', icon: 'folder-open', accent: '#8B5CF6', accentBg: '#F5F3FF' },
    { title: 'Secure Messaging', description: 'Chat directly with patients through end-to-end encrypted in-app messaging.', icon: 'chatbubble-ellipses', accent: C.teal, accentBg: 'rgba(11,126,138,0.1)' },
    { title: 'Build Your Profile', description: 'Complete your profile to appear in patient searches. Reviews and ratings build trust over time.', icon: 'person-circle', accent: '#EF4444', accentBg: '#FEF2F2' },
  ],
  hospital_admin: [
    { title: 'Hospital Dashboard', description: 'Your hospital admin dashboard is available on the web at hbridge.ng/hospital for full management tools.', icon: 'business', accent: C.teal, accentBg: 'rgba(11,126,138,0.1)' },
  ],
};

interface Props {
  userType: 'patient' | 'doctor' | 'hospital_admin';
  userId?: string;
  onComplete: () => void;
}

export default function TutorialOverlay({ userType, onComplete }: Props) {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const steps = STEPS[userType];

  const slideY    = useRef(new Animated.Value(H)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const contentOp = useRef(new Animated.Value(0)).current;
  const contentY  = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!visible) return;
    animateIn();
  }, [step, visible]);

  const animateIn = () => {
    iconScale.setValue(0.4);
    contentOp.setValue(0);
    contentY.setValue(18);

    Animated.spring(slideY, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }).start();

    setTimeout(() => {
      Animated.spring(iconScale, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }).start();
    }, 60);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOp, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(contentY, { toValue: 0, tension: 200, friction: 20, useNativeDriver: true }),
      ]).start();
    }, 140);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < steps.length - 1) {
      Animated.timing(contentOp, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setStep(s => s + 1);
      });
    } else {
      finish();
    }
  };

  const goPrev = () => {
    if (step === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(contentOp, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(s => s - 1);
    });
  };

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(slideY, { toValue: H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setVisible(false);
      onComplete();
    });
  };

  if (!visible || !steps[step]) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      {/* Scrim */}
      <TouchableOpacity style={s.scrim} activeOpacity={1} onPress={() => {}} />

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }], paddingBottom: Math.max(insets.bottom, 28) }]}>

        {/* Handle */}
        <View style={s.handle} />

        {/* Step counter + skip */}
        <View style={s.topRow}>
          <Text style={s.stepCounter}>{step + 1} / {steps.length}</Text>
          <TouchableOpacity style={s.skipBtn} onPress={finish}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Icon orb */}
        <Animated.View style={[s.orb, { backgroundColor: current.accentBg, transform: [{ scale: iconScale }] }]}>
          {current.useMCI
            ? <MaterialCommunityIcons name={current.icon as any} size={52} color={current.accent} />
            : <Ionicons name={current.icon as any} size={52} color={current.accent} />}
        </Animated.View>

        {/* Dot progress */}
        <View style={s.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[s.dot, i === step && { width: 20, backgroundColor: C.teal }, i < step && { backgroundColor: C.teal + '60' }]} />
          ))}
        </View>

        {/* Content */}
        <Animated.View style={[s.content, { opacity: contentOp, transform: [{ translateY: contentY }] }]}>
          <Text style={s.title}>{current.title}</Text>
          <Text style={s.desc}>{current.description}</Text>
        </Animated.View>

        {/* Buttons */}
        <View style={s.btnRow}>
          {step > 0 ? (
            <TouchableOpacity style={s.backBtn} onPress={goPrev}>
              <Ionicons name="arrow-back" size={18} color={C.teal} />
            </TouchableOpacity>
          ) : <View style={{ width: 48 }} />}

          <TouchableOpacity style={[s.nextBtn, { backgroundColor: isLast ? C.hero : C.teal }]} onPress={goNext}>
            <Text style={s.nextBtnText}>{isLast ? "Let's go!" : 'Next'}</Text>
            <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,50,54,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  stepCounter: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: C.muted,
    letterSpacing: 0.5,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: C.paper,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    color: C.muted,
  },
  orb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 22,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
  },
  content: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Montserrat_800ExtraBold',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#fff',
  },
});
