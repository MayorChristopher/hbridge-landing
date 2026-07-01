import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Image, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TEAL    = '#0B7E8A';
const INACTIVE = '#9AA3AE';
const BAR_HEIGHT = 64;
const PILL_W     = 46;
const PILL_H     = 36;
const BAR_MARGIN = 20; // left: 20, right: 20

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

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: focused ? 1 : 0.86,
      tension: 500,
      friction: 22,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <View style={s.iconWrap}>
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
      {/* Badge dot — only when tab is NOT focused */}
      {!!badge && (
        <View style={[s.badgeDot, badge === 'gold' ? s.badgeGold : s.badgeRed]}>
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
  const { width: screenWidth } = useWindowDimensions();
  const bottom = Math.max(insets.bottom, 18);

  const numTabs  = tabs.length;
  const barWidth = screenWidth - BAR_MARGIN * 2;
  const tabWidth = barWidth / numTabs;

  // Single shared pill — translateX slides it between tab positions
  const pillX = useRef(
    new Animated.Value(state.index * tabWidth + (tabWidth - PILL_W) / 2)
  ).current;

  useEffect(() => {
    const targetX = state.index * tabWidth + (tabWidth - PILL_W) / 2;
    Animated.spring(pillX, {
      toValue: targetX,
      tension: 320,
      friction: 26,
      useNativeDriver: true, // translateX runs on native thread
    }).start();
  }, [state.index, tabWidth]);

  return (
    <View style={[s.bar, { bottom }]}>
      {/* Single pill that slides smoothly between tabs */}
      <Animated.View
        style={[s.pill, { transform: [{ translateX: pillX }] }]}
        pointerEvents="none"
      />

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
            activeOpacity={1}
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
    left: BAR_MARGIN,
    right: BAR_MARGIN,
    height: BAR_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 12,
    overflow: 'hidden', // clip pill to bar bounds
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_HEIGHT,
    zIndex: 1, // sit above the sliding pill
  },
  iconWrap: {
    width: PILL_W,
    height: PILL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: (BAR_HEIGHT - PILL_H) / 2,
    width: PILL_W,
    height: PILL_H,
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
  profileRingActive:   { borderWidth: 2, borderColor: '#FFFFFF' },
  profileRingInactive: { borderWidth: 2, borderColor: '#0B7E8A' },
  profileImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    zIndex: 2,
  },
  badgeGold: { backgroundColor: '#F59E0B' },
  badgeRed:  { backgroundColor: '#EF4444' },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 11 },
});
