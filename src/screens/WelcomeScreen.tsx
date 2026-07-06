import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, ImageBackground, StatusBar, Animated,
  Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

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
  const flatRef      = useRef<FlatList>(null);
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
      // Landed on the clone of slide 0 — snap back to real index 0 instantly
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

  // Auto-advance — scrolls forward, including into the clone at position SLIDES.length
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSnapping.current) return;
      const next = activeIndexRef.current + 1; // 1…SLIDES.length (inclusive of clone)
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[activeIndex];

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen image slideshow — no overlays on images */}
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
          />
        )}
      />

      {/* Text + buttons overlay — dark panel only at the bottom */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>

          {/* Spacer — image visible above */}
          <View style={s.topSpacer} />

          {/* Dark bottom panel — text lives here, image still shows above */}
          <View style={s.bottomPanel} pointerEvents="box-none">

            <Animated.View style={[s.textBlock, { opacity: textOpacity }]} pointerEvents="none">
              <Animated.View style={[s.tagRow, { transform: [{ translateY: tagTranslate }] }]}>
                <View style={s.tag}>
                  <Text style={s.tagText}>{slide.tag}</Text>
                </View>
              </Animated.View>
              <Text style={s.headline}>{slide.headline}</Text>
              <Text style={s.sub}>{slide.sub}</Text>
            </Animated.View>

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
                <Text style={s.signUpText}>Get Started</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0B1A1A',
  },
  slide: {
    width: W,
    height: H,
    backgroundColor: '#0B1A1A',
  },
  safeArea: {
    flex: 1,
  },
  topSpacer: {
    flex: 1,
  },

  /* Dark translucent panel behind the text — doesn't touch the image */
  bottomPanel: {
    backgroundColor: 'rgba(10,20,20,0.78)',
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    gap: 18,
  },

  textBlock: { gap: 10 },
  tagRow:    { flexDirection: 'row' },
  tag: {
    backgroundColor: '#D4A843',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 21,
  },

  /* Dots */
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  dotActive: {
    width: 22,
    borderRadius: 4,
    backgroundColor: '#D4A843',
  },

  /* Buttons */
  buttons: { gap: 10 },
  signUpButton: {
    backgroundColor: '#0B7E8A',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    textDecorationLine: 'underline',
  },
});
