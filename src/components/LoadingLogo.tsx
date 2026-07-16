import React, { useRef, useEffect } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';

export default function LoadingLogo() {
  const innerScale = useRef(new Animated.Value(1)).current;
  const outerScale = useRef(new Animated.Value(0.88)).current;
  const outerOp    = useRef(new Animated.Value(0.3)).current;
  const logoScale  = useRef(new Animated.Value(1)).current;
  const dot1       = useRef(new Animated.Value(0.3)).current;
  const dot2       = useRef(new Animated.Value(0.3)).current;
  const dot3       = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(innerScale, { toValue: 1.07, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(innerScale, { toValue: 1.0,  duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

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

    Animated.loop(
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(logoScale, { toValue: 1.04, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 0.97, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

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
    <View style={s.container}>
      <View style={s.logoArea}>
        <Animated.View style={[s.outerRing, { transform: [{ scale: outerScale }], opacity: outerOp }]} />
        <Animated.View style={[s.innerRing, { transform: [{ scale: innerScale }] }]} />
        <Animated.Image
          source={require('../../assets/hbridge3.png')}
          style={[s.logo, { transform: [{ scale: logoScale }] }]}
          resizeMode="cover"
        />
      </View>

      <Text style={s.brandName}>hbridge</Text>

      <View style={s.dotsRow}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View key={i} style={[s.dot, { opacity: anim }]} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#083236',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoArea: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  outerRing: {
    position: 'absolute',
    width: 164, height: 164, borderRadius: 82,
    borderWidth: 1,
    borderColor: 'rgba(11,126,138,0.38)',
  },
  innerRing: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(11,126,138,0.75)',
    backgroundColor: 'rgba(11,126,138,0.10)',
  },
  logo: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  brandName: {
    fontSize: 28,
    fontFamily: 'Montserrat_800ExtraBold',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: 'rgba(11,126,138,0.9)',
  },
});
