import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StatusBar, Image, Easing } from 'react-native';
import * as SplashScreenExpo from 'expo-splash-screen';

SplashScreenExpo.preventAutoHideAsync();

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const scale     = useRef(new Animated.Value(0.82)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SplashScreenExpo.hideAsync();

    // Phase 1: Fade + scale in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Heartbeat pulse — two quick beats
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.13, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 100, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.08, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        // Phase 3: Hold then fade out
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(exitOpacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(exitScale,   { toValue: 1.15, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]).start(onFinish);
        }, 1800);
      });
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.View style={{ opacity, transform: [{ scale }, { scale: exitScale }] }}>
        <Image
          source={require('../../assets/hbridge2.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B7E8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
});
