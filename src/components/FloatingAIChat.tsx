import React, { useState, useRef } from 'react';
import {
  View, TouchableOpacity, Animated, PanResponder,
  Dimensions, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AIChatScreen, { AIChatMsg, INITIAL_AI_MESSAGES } from '../screens/AIChatScreen';

const { width: SW, height: SH } = Dimensions.get('window');
const BTN = 52;

export default function FloatingAIChat({ visible = true }: { visible?: boolean }) {
  const [showChat, setShowChat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [chatMessages, setChatMessages] = useState<AIChatMsg[]>(INITIAL_AI_MESSAGES);
  const insets = useSafeAreaInsets();

  const pan      = useRef(new Animated.ValueXY({ x: SW - BTN - 16, y: SH - 160 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,

      onPanResponderGrant: () => {
        setIsDragging(true);
        Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true }).start();
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),

      onPanResponderRelease: (_, g) => {
        setIsDragging(false);
        pan.flattenOffset();
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
          setShowChat(true);
          return;
        }

        const curX = (pan.x as any)._value;
        const curY = (pan.y as any)._value;
        const snapX = curX + BTN / 2 > SW / 2 ? SW - BTN - 16 : 16;
        const snapY = Math.max(insets.top + 60, Math.min(curY, SH - insets.bottom - BTN - 90));

        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          tension: 120, friction: 9,
        }).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <>
      <Animated.View
        style={[ss.posLayer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={ss.btn}
            activeOpacity={0.88}
            onPress={() => !isDragging && setShowChat(true)}
          >
            <View style={ss.inner}>
              <Ionicons name="sparkles" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Modal
        visible={showChat}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowChat(false)}
      >
        <AIChatScreen
          navigation={{ goBack: () => setShowChat(false), navigate: () => {} }}
          initialMessages={chatMessages}
          onMessagesUpdate={setChatMessages}
        />
      </Modal>
    </>
  );
}

const ss = StyleSheet.create({
  posLayer: {
    position: 'absolute',
    width: BTN,
    height: BTN,
    zIndex: 9999,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    overflow: 'hidden',
    shadowColor: '#050F10',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 12,
  },
  inner: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    backgroundColor: '#0B7E8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
