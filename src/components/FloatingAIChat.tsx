import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AIChatScreen from '../screens/AIChatScreen';

const { width: SW, height: SH } = Dimensions.get('window');
const BTN = 60;

export default function FloatingAIChat({ visible = true }: { visible?: boolean }) {
  const [showChat, setShowChat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const insets = useSafeAreaInsets();

  // ── Pan uses useNativeDriver:false (position cannot use native driver) ──
  const pan = useRef(new Animated.ValueXY({ x: SW - BTN - 16, y: SH / 2 - 100 })).current;

  // ── Scale uses useNativeDriver:true (transform only) ──
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Pulse uses useNativeDriver:true ──
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!isDragging && visible && !showChat) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [isDragging, visible, showChat]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,

      onPanResponderGrant: () => {
        setIsDragging(true);
        // stop pulse while dragging
        pulseLoop.current?.stop();
        pulseAnim.setValue(1);

        // scale up — native driver OK (separate Animated.View)
        Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true }).start();

        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }   // position MUST be false
      ),

      onPanResponderRelease: (_, g) => {
        setIsDragging(false);
        pan.flattenOffset();

        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

        // tap = minimal movement → open chat
        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
          setShowChat(true);
          return;
        }

        // snap to nearest horizontal edge
        const curX = (pan.x as any)._value;
        const curY = (pan.y as any)._value;
        const snapX = curX + BTN / 2 > SW / 2 ? SW - BTN - 16 : 16;
        const snapY = Math.max(
          insets.top + 60,
          Math.min(curY, SH - insets.bottom - BTN - 80)
        );

        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,   // position — must be false
          tension: 120,
          friction: 9,
        }).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <>
      {/* ── Outer view handles position (JS driver) ── */}
      <Animated.View
        style={[styles.positionLayer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        {...panResponder.panHandlers}
      >
        {/* ── Inner view handles scale (native driver) ── */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {/* Pulse ring — native driver */}
          {!isDragging && !showChat && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.25],
                    outputRange: [0.35, 0],
                  }),
                },
              ]}
            />
          )}

          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={() => !isDragging && setShowChat(true)}
          >
            <Ionicons name="sparkles" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── Full-screen AI Chat Modal ── */}
      <Modal
        visible={showChat}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowChat(false)}
      >
        <AIChatScreen navigation={{ goBack: () => setShowChat(false), navigate: () => {} }} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  positionLayer: {
    position: 'absolute',
    width: BTN,
    height: BTN,
    zIndex: 9999,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    backgroundColor: '#0B7E8A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 2,
    borderColor: 'rgba(4,172,68,0.4)',
    backgroundColor: 'transparent',
  },
});
