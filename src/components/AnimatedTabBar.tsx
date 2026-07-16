import React, { useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, Animated, StyleSheet, Image, Text,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

const INK      = '#0C2E30';
const TEAL     = '#0B7E8A';  // used in FAB gradient
const GOLD     = '#D4A843';
const INACTIVE = 'rgba(255,255,255,0.42)';

const BAR_HEIGHT   = 60;
const FAB_SIZE     = 54;
const BAR_MARGIN   = 14;
const FAB_OVERHANG = 20;  // px the FAB rises above the bar top

// Notch geometry
const NOTCH_DEPTH  = 36;  // gentle valley — FAB floats above, not buried inside
const NOTCH_HALF_W = 36;  // tight around FAB so transparent wing area is minimal
const SHOULDER     = 2;
const CORNER_R     = 26;

interface TabItem {
  name: string;
  label?: string;
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

function buildBarPath(bw: number, bh: number, cx: number): string {
  const cr = CORNER_R;
  const d  = NOTCH_DEPTH;   // valley depth
  const hw = NOTCH_HALF_W;  // half-width at top
  const sh = SHOULDER;      // flat before curve

  // Very organic valley: first cp nearly at shoulder = horizontal tangent,
  // second cp near valley floor = smooth U-bottom, not V.
  return [
    `M ${cr} 0`,
    `H ${cx - hw - sh}`,
    // Left: near-horizontal entry then plunges to valley floor
    `C ${cx - hw * 0.92} 0 ${cx - hw * 0.12} ${d} ${cx} ${d}`,
    // Right: mirror — rises smoothly from valley floor to bar top
    `C ${cx + hw * 0.12} ${d} ${cx + hw * 0.92} 0 ${cx + hw + sh} 0`,
    `H ${bw - cr}`,
    `Q ${bw} 0 ${bw} ${cr}`,
    `V ${bh - cr}`,
    `Q ${bw} ${bh} ${bw - cr} ${bh}`,
    `H ${cr}`,
    `Q 0 ${bh} 0 ${bh - cr}`,
    `V ${cr}`,
    `Q 0 0 ${cr} 0`,
    `Z`,
  ].join(' ');
}

export default function AnimatedTabBar({
  state, descriptors, navigation, profileImage, tabs, badges = {},
}: Props) {
  const insets  = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // +8 buffer ensures the pill clears Android gesture strip even when insets report late
  const bottom  = Math.max(insets.bottom, 8) + 8;
  const barWidth = screenWidth - BAR_MARGIN * 2;
  const cx       = barWidth / 2;

  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isRecords = state.routes[state.index]?.name === 'Records' || state.routes[state.index]?.name === 'DoctorCaseFiles';
    Animated.spring(fabScale, {
      toValue: isRecords ? 1.1 : 1,
      tension: 400, friction: 18, useNativeDriver: true,
    }).start();
  }, [state.index]);

  const leftTabs  = tabs.slice(0, 2);
  const rightTabs = tabs.slice(3, 5);
  const centerTab = tabs[2];
  const barPath   = buildBarPath(barWidth, BAR_HEIGHT, cx);

  return (
    <View style={[s.container, { bottom, width: barWidth, left: BAR_MARGIN, height: BAR_HEIGHT + FAB_OVERHANG }]}>
      {/* SVG bar — sits at bottom of container; top FAB_OVERHANG px reserved for FAB */}
      <View style={[s.barShadowWrap, { marginTop: FAB_OVERHANG }]}>
        <Svg
          width={barWidth}
          height={BAR_HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Path d={barPath} fill={INK} />
        </Svg>

        {/* Nav items rendered over the SVG bar */}
        <View style={[StyleSheet.absoluteFill, s.navRow]}>
          <View style={s.sideGroup}>
            {leftTabs.map((tab, i) => {
              const route    = state.routes[i];
              const isFocused = state.index === i;
              const badge    = badges[route?.name];
              return (
                <NavItem
                  key={route?.key || i}
                  tab={tab}
                  isFocused={isFocused}
                  badge={badge}
                  onPress={() => {
                    const event = navigation.emit({ type: 'tabPress', target: route?.key, canPreventDefault: true });
                    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
                  }}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route?.key })}
                />
              );
            })}
          </View>

          {/* Center spacer — must be at least as wide as the FAB backdrop (FAB_SIZE + 24) */}
          <View style={{ width: FAB_SIZE + 28 }} />

          <View style={s.sideGroup}>
            {rightTabs.map((tab, i) => {
              const routeIdx  = i + 3;
              const route     = state.routes[routeIdx];
              const isFocused = state.index === routeIdx;
              const badge     = badges[route?.name];
              const isProfile = route?.name === 'Profile';
              return (
                <NavItem
                  key={route?.key || routeIdx}
                  tab={tab}
                  isFocused={isFocused}
                  badge={badge}
                  isProfile={isProfile}
                  profileImage={profileImage}
                  onPress={() => {
                    const event = navigation.emit({ type: 'tabPress', target: route?.key, canPreventDefault: true });
                    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
                  }}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route?.key })}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* Center elevated FAB — rises above bar into FAB_OVERHANG zone */}
      {centerTab && (() => {
        const centerRoute     = state.routes[2];
        const isCenterFocused = state.index === 2;
        const centerBadge     = badges[centerRoute?.name];
        return (
          <Animated.View style={[s.fabWrap, { transform: [{ scale: fabScale }] }]}>
            {/* INK backdrop covers any transparent notch wing area around the FAB */}
            <View style={s.fabBackdrop} />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: centerRoute?.key, canPreventDefault: true });
                if (!isCenterFocused && !event.defaultPrevented) navigation.navigate(centerRoute.name);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: centerRoute?.key })}
              style={s.fabTouch}
            >
              <LinearGradient
                colors={isCenterFocused ? ['#E8B84B', '#C49328'] : ['#0F9BAA', TEAL]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.fab}
              >
                <Ionicons
                  name={isCenterFocused ? 'folder-open' : 'folder-open-outline'}
                  size={26}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>
            {/* Badge outside overflow:hidden so it's never clipped */}
            {!!centerBadge && (
              <View style={s.fabBadge}>
                {typeof centerBadge === 'number' && (
                  <Text style={s.fabBadgeText}>{centerBadge > 99 ? '99+' : centerBadge}</Text>
                )}
              </View>
            )}
            <Text style={[s.fabLabel, { color: isCenterFocused ? GOLD : INACTIVE }]}>
              {centerTab.label ?? centerTab.name}
            </Text>
          </Animated.View>
        );
      })()}
    </View>
  );
}

function NavItem({
  tab, isFocused, badge, isProfile = false, profileImage = null, onPress, onLongPress,
}: {
  tab: TabItem; isFocused: boolean; badge?: number | 'gold';
  isProfile?: boolean; profileImage?: string | null;
  onPress: () => void; onLongPress: () => void;
}) {
  const iconScale = useRef(new Animated.Value(isFocused ? 1 : 0.86)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: isFocused ? 1 : 0.86,
      tension: 500, friction: 22, useNativeDriver: true,
    }).start();
  }, [isFocused]);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={s.navItem}
    >
      <Animated.View style={[s.navInner, { transform: [{ scale: iconScale }] }]}>
        {isProfile && profileImage ? (
          <View style={[s.profileRing, isFocused && s.profileRingActive]}>
            <Image source={{ uri: profileImage }} style={s.profileImg} />
          </View>
        ) : (
          <Ionicons
            name={(isFocused ? tab.activeIcon : tab.inactiveIcon) as any}
            size={22}
            color={isFocused ? GOLD : INACTIVE}
          />
        )}
      </Animated.View>
      <Text style={[s.navLabel, { color: isFocused ? GOLD : INACTIVE }]}>
        {tab.label ?? tab.name}
      </Text>
      {!!badge && (
        <View style={[s.badgeDot, badge === 'gold' ? s.badgeGold : s.badgeRed]}>
          {typeof badge === 'number' && badge > 0 && (
            <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
  },

  barShadowWrap: {
    height: BAR_HEIGHT,
    width: '100%',
    shadowColor: INK,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },

  sideGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-around',
  },

  // FAB: top calculated so it rises FAB_OVERHANG - (FAB_SIZE-NOTCH_DEPTH)/2 - 5 = 6px from container top
  fabWrap: {
    position: 'absolute',
    top: FAB_OVERHANG - (FAB_SIZE - NOTCH_DEPTH) / 2 - 5,
    alignSelf: 'center',
    zIndex: 10,
    width: FAB_SIZE,
    alignItems: 'center',
  },
  // Covers any transparent notch wing left/right of FAB
  fabBackdrop: {
    position: 'absolute',
    width: FAB_SIZE + 24,
    height: FAB_SIZE + 24,
    borderRadius: (FAB_SIZE + 24) / 2,
    backgroundColor: INK,
    top: -12, left: -12,
  },
  fabTouch: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
    shadowColor: '#050F10',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 20,
  },
  fab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    fontSize: 9,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 0.2,
    marginTop: 3,
  },
  fabBadge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: INK,
    zIndex: 20,
  },
  fabBadgeText: { fontSize: 9, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  navItem: {
    alignItems: 'center', gap: 3,
    paddingHorizontal: 4,
    position: 'relative',
    paddingVertical: 10,
  },
  navInner: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, fontFamily: 'Montserrat_700Bold', letterSpacing: 0.2 },

  profileRing: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: INACTIVE, overflow: 'hidden',
  },
  profileRingActive: { borderColor: GOLD },
  profileImg: { width: '100%', height: '100%' },

  badgeDot: {
    position: 'absolute', top: 4, right: -2,
    minWidth: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 1.5, borderColor: INK, zIndex: 2,
  },
  badgeGold: { backgroundColor: GOLD },
  badgeRed:  { backgroundColor: '#EF4444' },
  badgeText: { fontSize: 8, fontFamily: 'Montserrat_700Bold', color: '#fff', lineHeight: 10 },
});
