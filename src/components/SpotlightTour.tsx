import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Modal,
  Animated, Easing, Dimensions, findNodeHandle,
  UIManager, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  teal: '#0B7E8A', tealDark: '#083236', paper: '#F5F3EE',
  card: '#FFFFFF', text: '#0C2E30', muted: '#6B7E7F',
  gold: '#D4A843', border: '#EAE5DA',
};

export interface SpotlightStep {
  title: string;
  desc: string;
  /** Pass a React ref created with useRef(); the component will measure it on the native side */
  targetRef?: React.RefObject<any>;
  /** Use if you can't pass a ref (e.g. tab bar). Absolute coords relative to screen. */
  staticTarget?: { x: number; y: number; width: number; height: number };
  /** Extra padding around the cutout. Default 10. */
  padding?: number;
  /** Where to render the tooltip. Default 'auto'. */
  tooltipSide?: 'above' | 'below' | 'auto';
  icon?: string;
  iconLib?: 'ion' | 'mci';
  accent?: string;
  /** Border radius of the spotlight ring. Use 999 for a circle (e.g. floating button). Default 18. */
  cutoutRadius?: number;
}

interface Props {
  steps: SpotlightStep[];
  visible: boolean;
  onComplete: () => void;
}

export default function SpotlightTour({ steps, visible, onComplete }: Props) {
  const [idx, setIdx]         = useState(0);
  const [layout, setLayout]   = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [ready, setReady]     = useState(false);
  const insets = useSafeAreaInsets();

  const scrimOp  = useRef(new Animated.Value(0)).current;
  const cardOp   = useRef(new Animated.Value(0)).current;
  const cardY    = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const step = steps[idx];
  const pad  = step?.padding ?? 10;

  // Measure target
  const measureTarget = useCallback(async () => {
    const s = steps[idx];
    if (!s) return;

    if (s.staticTarget) {
      setLayout(s.staticTarget);
      return;
    }

    if (s.targetRef?.current) {
      const handle = findNodeHandle(s.targetRef.current);
      if (!handle) { setLayout(null); return; }
      UIManager.measure(handle, (_x, _y, width, height, pageX, pageY) => {
        setLayout({ x: pageX, y: pageY, width, height });
      });
    } else {
      // No target — centre the tooltip with no spotlight
      setLayout(null);
    }
  }, [idx, steps]);

  // Animate in when layout is ready
  useEffect(() => {
    if (!visible) return;
    setReady(false);
    scrimOp.setValue(0);
    cardOp.setValue(0);
    cardY.setValue(30);
    pulseAnim.setValue(1);

    const timer = setTimeout(async () => {
      await measureTarget();
      setReady(true);

      Animated.parallel([
        Animated.timing(scrimOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(cardOp,  { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(cardY,   { toValue: 0, tension: 200, friction: 20, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ).start();
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [idx, visible]);

  if (!visible || !step) return null;

  const advance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardOp.setValue(0);
    cardY.setValue(20);
    pulseAnim.stopAnimation();
    if (idx < steps.length - 1) {
      setIdx(i => i + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(scrimOp, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(cardOp,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onComplete);
  };

  // ── Build cutout geometry ──────────────────────────────────────────────────
  const hasCutout = !!layout;
  const cx = hasCutout ? layout!.x - pad : 0;
  const cy = hasCutout ? layout!.y - pad : 0;
  const cw = hasCutout ? layout!.width  + pad * 2 : 0;
  const ch = hasCutout ? layout!.height + pad * 2 : 0;

  // ── Tooltip position ───────────────────────────────────────────────────────
  let tooltipTop: number | undefined;
  let tooltipBottom: number | undefined;

  if (hasCutout) {
    const side = step.tooltipSide === 'auto' || !step.tooltipSide
      ? (cy + ch + 220 < SH ? 'below' : 'above')
      : step.tooltipSide;

    if (side === 'below') {
      tooltipTop = cy + ch + 18;
    } else {
      tooltipBottom = SH - cy + 18;
    }
  }

  const tooltipWidth = Math.min(SW - 40, 340);
  const tooltipLeft  = (SW - tooltipWidth) / 2;

  const accent = step.accent ?? C.teal;
  const accentBg = accent + '1A'; // 10% opacity

  // ── Render 4 mask rects around cutout ─────────────────────────────────────
  const renderMasks = () => {
    if (!hasCutout) {
      return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]} pointerEvents="none" />;
    }
    return (
      <>
        {/* Top */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cy, backgroundColor: 'rgba(8,50,54,0.78)' }} />
        {/* Bottom */}
        <View pointerEvents="none" style={{ position: 'absolute', top: cy + ch, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,50,54,0.78)' }} />
        {/* Left */}
        <View pointerEvents="none" style={{ position: 'absolute', top: cy, left: 0, width: cx, height: ch, backgroundColor: 'rgba(8,50,54,0.78)' }} />
        {/* Right */}
        <View pointerEvents="none" style={{ position: 'absolute', top: cy, left: cx + cw, right: 0, height: ch, backgroundColor: 'rgba(8,50,54,0.78)' }} />
        {/* Cutout border / pulse ring */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: cy - 3,
            left: cx - 3,
            width: cw + 6,
            height: ch + 6,
            borderRadius: step.cutoutRadius ?? 18,
            borderWidth: 2.5,
            borderColor: accent,
            transform: [{ scale: pulseAnim }],
          }}
        />
      </>
    );
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOp }]}>
        {/* Full-screen tap area to advance */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={advance} />
        {/* Mask system */}
        {renderMasks()}
      </Animated.View>

      {/* Tooltip card */}
      <Animated.View
        style={[
          s.card,
          {
            width: tooltipWidth,
            left: tooltipLeft,
            opacity: cardOp,
            transform: [{ translateY: cardY }],
            ...(tooltipTop !== undefined
              ? { top: tooltipTop }
              : tooltipBottom !== undefined
              ? { bottom: tooltipBottom }
              : { top: SH / 2 - 80 }),
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Step badge + skip */}
        <View style={s.cardTop}>
          <View style={[s.badge, { backgroundColor: accentBg }]}>
            <Text style={[s.badgeText, { color: accent }]}>{idx + 1} / {steps.length}</Text>
          </View>
          <TouchableOpacity onPress={finish} style={s.skipBtn}>
            <Text style={s.skipText}>Skip tour</Text>
          </TouchableOpacity>
        </View>

        {/* Icon */}
        {step.icon && (
          <View style={[s.iconOrb, { backgroundColor: accentBg }]}>
            {step.iconLib === 'mci'
              ? <MaterialCommunityIcons name={step.icon as any} size={28} color={accent} />
              : <Ionicons name={step.icon as any} size={28} color={accent} />}
          </View>
        )}

        <Text style={s.title}>{step.title}</Text>
        <Text style={s.desc}>{step.desc}</Text>

        {/* Dots */}
        <View style={s.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[s.dot,
              i === idx && { width: 20, backgroundColor: accent },
              i < idx && { backgroundColor: accent + '60' },
            ]} />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: accent }]} onPress={advance}>
          <Text style={s.nextBtnText}>{idx === steps.length - 1 ? "Let's go!" : 'Next'}</Text>
          <Ionicons name={idx === steps.length - 1 ? 'checkmark' : 'arrow-forward'} size={16} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 24,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontFamily: 'Montserrat_700Bold', letterSpacing: 0.3 },
  skipBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F5F3EE' },
  skipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  iconOrb: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontFamily: 'Montserrat_800ExtraBold', color: C.text, letterSpacing: -0.3, marginBottom: 6 },
  desc:  { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, lineHeight: 20, marginBottom: 16 },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EAE5DA' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13 },
  nextBtnText: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});
