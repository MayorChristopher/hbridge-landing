import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, ImageBackground, StatusBar, Animated,
  Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

const C = { teal: '#0B7E8A', ink: '#0C2E30' };

const SLIDES = [
  {
    image: require('../../assets/hb-slide-1.jpg'),
    tag: 'For Patients',
    headline: 'Your Doctor is\nOne Tap Away',
    sub: 'Consult verified Nigerian doctors from anywhere. No waiting rooms, no long queues.',
  },
  {
    image: require('../../assets/hb-slide-2.jpg'),
    tag: 'For Hospitals',
    headline: 'Care Built on\nCollaboration',
    sub: 'Specialists and hospitals working together on one platform — for better outcomes.',
  },
  {
    image: require('../../assets/hb-slide-3.jpg'),
    tag: 'For Everyone',
    headline: 'Made for Every\nNigerian',
    sub: 'Whether you\'re in Lagos or a rural community — quality healthcare is within reach.',
  },
  {
    image: require('../../assets/hb-slide-4.jpg'),
    tag: 'For You',
    headline: 'Your Health,\nOn Your Terms',
    sub: 'Book appointments, track symptoms, review lab results — all from your phone.',
  },
  {
    image: require('../../assets/hb-slide-5.jpg'),
    tag: 'For Families',
    headline: 'There When Your\nFamily Needs It',
    sub: 'Get a doctor for your loved ones at any hour. Because care never waits.',
  },
  {
    image: require('../../assets/hb-slide-6.jpg'),
    tag: 'For Trust',
    headline: 'Only Verified,\nTrusted Doctors',
    sub: 'Every Hbridge doctor is reviewed and credentialed. You are in expert hands.',
  },
  {
    image: require('../../assets/hb-slide-7.jpg'),
    tag: 'Our Mission',
    headline: 'The Health Platform\nNigeria Deserves',
    sub: 'Consultations, records, medications, labs — complete healthcare, finally for all.',
  },
];

// Clone first slide at end for seamless loop
const LOOP_SLIDES = [...SLIDES, SLIDES[0]];

const AUTO_ADVANCE_MS = 7000;

export default function WelcomeScreen({ navigation }: any) {
  const flatRef        = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const isSnapping     = useRef(false);
  const textOpacity    = useRef(new Animated.Value(1)).current;
  const tagTranslate   = useRef(new Animated.Value(0)).current;

  const animateText = useCallback(() => {
    textOpacity.setValue(0);
    tagTranslate.setValue(10);
    Animated.parallel([
      Animated.timing(textOpacity,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(tagTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [textOpacity, tagTranslate]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const idx = viewableItems[0]?.index;
    if (idx == null || isSnapping.current) return;

    if (idx >= SLIDES.length) {
      isSnapping.current = true;
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: 0, animated: false });
        setActiveIndex(0);
        activeIndexRef.current = 0;
        isSnapping.current = false;
      }, 60);
    } else if (idx !== activeIndexRef.current) {
      animateText();
      setActiveIndex(idx);
      activeIndexRef.current = idx;
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  useEffect(() => {
    const timer = setInterval(() => {
      if (isSnapping.current) return;
      const next = activeIndexRef.current + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[activeIndex];

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen image slideshow */}
      <FlatList
        ref={flatRef}
        data={LOOP_SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={2}
        renderItem={({ item }) => (
          <ImageBackground
            source={item.image}
            style={s.slide}
            resizeMode="contain"
            imageStyle={s.slideImage}
          />
        )}
      />

      {/* Dark gradient sits over image — readable text zone at bottom of image */}
      <LinearGradient
        colors={['transparent', 'rgba(8,26,26,0.45)', 'rgba(8,26,26,0.88)']}
        locations={[0.35, 0.62, 0.82]}
        style={s.gradient}
        pointerEvents="none"
      />

      {/* Absolute overlay — text over image, card pinned to bottom */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SafeAreaView style={s.safeArea} edges={['bottom']}>

          {/* Text floats over image in the dark gradient zone */}
          <View style={s.textZone} pointerEvents="none">
            <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: tagTranslate }] }}>
              <View style={s.tag}>
                <Text style={s.tagText}>{slide.tag}</Text>
              </View>
            </Animated.View>
            <Animated.View style={{ opacity: textOpacity }}>
              <Text style={s.headline}>{slide.headline}</Text>
              <Text style={s.sub}>{slide.sub}</Text>
            </Animated.View>
          </View>

          {/* Card: dots + buttons only — compact, doesn't eat into image */}
          <View style={s.card}>
            {/* Dot indicators */}
            <View style={s.dots}>
              {SLIDES.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    if (!isSnapping.current) {
                      flatRef.current?.scrollToIndex({ index: i, animated: true });
                    }
                  }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                >
                  <View style={[s.dot, i === activeIndex && s.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>

            {/* CTA Buttons */}
            <View style={s.buttons}>
              <TouchableOpacity
                style={s.signUpButton}
                onPress={() => navigation.navigate('SignUp')}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#0C6570', '#083C42']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.signUpGradient}
                >
                  <Text style={s.signUpText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('SignIn')}
                activeOpacity={0.7}
                style={s.signInLink}
              >
                <Text style={s.signInText}>I already have an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1A1A' },
  slide:     { width: W, height: H },
  slideImage: { top: 0, bottom: undefined, left: 0, right: 0 },
  gradient:  { ...StyleSheet.absoluteFillObject },
  safeArea:  { flex: 1, justifyContent: 'flex-end' },

  // Text floats over the image in the dark zone
  textZone: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
  },
  tag: {
    backgroundColor: C.teal,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 30,
    fontFamily: 'Montserrat_800ExtraBold',
    color: '#ffffff',
    lineHeight: 38,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  sub: {
    fontSize: 13.5,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },

  // Compact card — buttons only
  card: {
    backgroundColor: '#F5F3EE',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 14 : 22,
    gap: 14,
  },

  dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D5CFC4' },
  dotActive: { width: 22, borderRadius: 4, backgroundColor: '#D4A843' },

  buttons: { gap: 10 },
  signUpButton: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#083C42', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 16, elevation: 6,
  },
  signUpGradient: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 17,
  },
  signUpText: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: 0.2 },
  signInLink: {
    alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EAE5DA', backgroundColor: '#FFFFFF',
  },
  signInText: { fontSize: 15, fontFamily: 'Montserrat_600SemiBold', color: '#0C2E30' },
});
