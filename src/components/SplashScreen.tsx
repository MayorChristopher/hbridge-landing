import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StatusBar, Image, Easing } from 'react-native';
import * as SplashScreenExpo from 'expo-splash-screen';

SplashScreenExpo.preventAutoHideAsync();

const LETTERS = 'hbridge'.split('');

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoOpacity      = useRef(new Animated.Value(0)).current;
  const logoScale        = useRef(new Animated.Value(0.82)).current;
  const ringScale        = useRef(new Animated.Value(0.5)).current;
  const ringOpacity      = useRef(new Animated.Value(0)).current;
  const outerRingScale   = useRef(new Animated.Value(0.38)).current;
  const outerRingOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity   = useRef(new Animated.Value(0)).current;
  const dotsOpacity      = useRef(new Animated.Value(0)).current;
  const exitOpacity      = useRef(new Animated.Value(1)).current;

  const letterAnims = useRef(
    LETTERS.map(() => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(14),
    }))
  ).current;

  const dotAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  const dotLoopRef = useRef<any>(null);

  const startDotLoop = () => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
    dotLoopRef.current = Animated.parallel([
      pulse(dotAnims[0], 0),
      pulse(dotAnims[1], 180),
      pulse(dotAnims[2], 360),
    ]);
    dotLoopRef.current.start();
  };

  useEffect(() => {
    SplashScreenExpo.hideAsync();

    // Phase 1: both rings expand, logo fades + scales in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringScale, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(outerRingScale, {
        toValue: 1,
        duration: 780,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(outerRingOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: letters stagger in
      Animated.stagger(
        35,
        letterAnims.map(anim =>
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(anim.y, {
              toValue: 0,
              tension: 90,
              friction: 10,
              useNativeDriver: true,
            }),
          ])
        )
      ).start(() => {
        // Phase 3: tagline + dots fade in together
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(dotsOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          startDotLoop();
          // Phase 4: hold longer, then clean exit
          setTimeout(() => {
            dotLoopRef.current?.stop();
            Animated.timing(exitOpacity, {
              toValue: 0,
              duration: 340,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(onFinish);
          }, 1600);
        });
      });
    });

    return () => { dotLoopRef.current?.stop(); };
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={s.orbTop} />
      <View style={s.orbBottom} />

      {/* Logo + rings */}
      <View style={s.logoArea}>
        <Animated.View style={[s.outerRing, { transform: [{ scale: outerRingScale }], opacity: outerRingOpacity }]} />
        <Animated.View style={[s.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Image
            source={require('../../assets/hbridge3.png')}
            style={s.logo}
            resizeMode="cover"
          />
        </Animated.View>
      </View>

      {/* Brand text */}
      <View style={s.brandWrap}>
        <View style={s.lettersRow}>
          {LETTERS.map((letter, i) => (
            <Animated.Text
              key={i}
              style={[
                s.brandLetter,
                {
                  opacity: letterAnims[i].opacity,
                  transform: [{ translateY: letterAnims[i].y }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
        <Animated.Text
          style={[s.tagline, { opacity: taglineOpacity }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          Healthcare for All
        </Animated.Text>
      </View>

      {/* Loading dots */}
      <Animated.View style={[s.dotsRow, { opacity: dotsOpacity }]}>
        {dotAnims.map((anim, i) => (
          <Animated.View key={i} style={[s.dot, { opacity: anim }]} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#083236',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbTop: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(11,126,138,0.22)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(11,126,138,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(11,126,138,0.25)',
  },
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 240,
    height: 240,
    marginBottom: 28,
  },
  outerRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(11,126,138,0.38)',
  },
  ring: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1.5,
    borderColor: 'rgba(11,126,138,0.75)',
    backgroundColor: 'rgba(11,126,138,0.12)',
  },
  logo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  brandWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 48,
    width: '100%',
    paddingHorizontal: 40,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandLetter: {
    fontSize: 38,
    fontFamily: 'Montserrat_800ExtraBold',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(11,126,138,0.9)',
  },
});
