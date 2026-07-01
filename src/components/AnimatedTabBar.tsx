import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Image, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TEAL = '#0B7E8A';
const INACTIVE = '#9AA3AE';
const BAR_HEIGHT = 64;

interface TabItem {
  name: string;
  activeIcon: string;
  inactiveIcon: string;
}

interface Props {
  state: any;
  descriptors: any;
  navigation: any;
  profileImage: string | null;
  tabs: TabItem[];
  badges?: Record<string, number | 'gold'>;
}

function TabIcon({
  focused,
  activeIcon,
  inactiveIcon,
  profileImage,
  isProfile,
  badge,
}: {
  focused: boolean;
  activeIcon: string;
  inactiveIcon: string;
  profileImage: string | null;
  isProfile: boolean;
  badge?: number | 'gold';
}) {
  const iconScale = useRef(new Animated.Value(focused ? 1 : 0.86)).current;
  const pillW = useRef(new Animated.Value(focused ? 46 : 0)).current;
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      // Icon springs to full size when focused, shrinks slightly when not
      Animated.spring(iconScale, {
        toValue: focused ? 1 : 0.86,
        tension: 200,
        friction: 13,
        useNativeDriver: true,
      }),
      // Pill width springs open/closed (scaleX trick for width animation on native driver)
      Animated.spring(pillW, {
        toValue: focused ? 46 : 0,
        tension: 220,
        friction: 14,
        useNativeDriver: false, // width can't use native driver
      }),
      // Pill fades in/out quickly
      Animated.timing(pillOpacity, {
        toValue: focused ? 1 : 0,
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={s.iconWrap}>
      {/* Animated pill background */}
      <Animated.View style={[s.pill, { width: pillW, opacity: pillOpacity }]} />
      {/* Icon scales on top */}
      <Animated.View style={[s.iconInner, { transform: [{ scale: iconScale }] }]}>
        {isProfile && profileImage ? (
          <View style={[s.profileRing, focused ? s.profileRingActive : s.profileRingInactive]}>
            <Image source={{ uri: profileImage }} style={s.profileImg} />
          </View>
        ) : (
          <Ionicons
            name={(focused ? activeIcon : inactiveIcon) as any}
            size={22}
            color={focused ? '#FFFFFF' : INACTIVE}
          />
        )}
      </Animated.View>
      {/* Badge dot */}
      {!!badge && (
        <View style={[
          s.badgeDot,
          badge === 'gold' ? s.badgeGold : s.badgeRed,
        ]}>
          {typeof badge === 'number' && badge > 0 && (
            <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function AnimatedTabBar({ state, descriptors, navigation, profileImage, tabs, badges = {} }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 18);

  return (
    <View style={[s.bar, { bottom }]}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = tabs[index] ?? { activeIcon: 'ellipse', inactiveIcon: 'ellipse-outline' };
        const isProfile = route.name === 'Profile';
        const badge = badges[route.name];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.85}
            style={s.tabBtn}
          >
            <TabIcon
              focused={isFocused}
              activeIcon={tab.activeIcon}
              inactiveIcon={tab.inactiveIcon}
              profileImage={profileImage}
              isProfile={isProfile}
              badge={isFocused ? undefined : badge}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: BAR_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    // Shadow — soft, not harsh
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 12,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_HEIGHT,
  },
  iconWrap: {
    width: 46,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    height: 36,
    borderRadius: 18,
    backgroundColor: TEAL,
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRingActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileRingInactive: {
    borderWidth: 2,
    borderColor: '#0B7E8A',
  },
  profileImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  profileImgActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeGold: { backgroundColor: '#F59E0B' },
  badgeRed:  { backgroundColor: '#EF4444' },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 11 },
});
