import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const sizing = {
  touchTarget: 44,
  buttonHeight: 50,
  inputHeight: 50,
  iconXs: 16,
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  iconXl: 48,
  avatarSm: 32,
  avatarMd: 48,
  avatarLg: 64,
  cardPadding: 16,
  containerPadding: 20,
  sectionSpacing: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const safeArea = {
  top: Platform.OS === 'ios' ? (screenHeight >= 812 ? 44 : 20) : StatusBar.currentHeight || 24,
  bottom: Platform.OS === 'ios' ? (screenHeight >= 812 ? 34 : 0) : 16,
};

// Hbridge design system — Paper · Ink · Teal · Gold
export const colors = {
  // Backgrounds
  paper: '#F5F3EE',        // warm paper — main background
  paperDark: '#EDE9E0',    // segmented control bg
  card: '#FFFFFF',         // card surface
  cardBorder: '#EAE5DA',   // card/input border

  // Brand
  ink: '#0C2E30',          // deep dark teal — nav, hero headers
  teal: '#0B7E8A',         // primary action
  tealLight: '#3DA0AC',
  tealDark: '#005F63',
  tealHero1: '#0C6570',    // gradient start for ink cards
  tealHero2: '#083236',    // gradient end

  gold: '#D4A843',
  goldLight: '#E2C97E',
  goldDark: '#9A7A28',
  goldBg: 'rgba(212,168,67,0.12)',
  goldBorder: 'rgba(212,168,67,0.35)',

  // Text
  textPrimary: '#16211F',
  textHeading: '#0C2E30',
  textMuted: '#7A8785',
  textMuted2: '#97A2A0',
  textBody: '#5C6B69',
  textInverse: '#FFFFFF',

  // Status
  success: '#1E9E5A',
  error: '#E24842',
  warning: '#D4A843',

  // Legacy aliases (keep existing code compiling)
  primary: '#0B7E8A',
  primaryLight: '#3DA0AC',
  primaryDark: '#005F63',
  secondary: '#FF3B30',
  secondaryLight: '#FF6B5B',
  secondaryDark: '#E5342A',
  background: '#F5F3EE',
  backgroundSecondary: '#EDE9E0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#EAE5DA',
  borderLight: '#F0EDE6',
  divider: '#EAE5DA',
  overlay: 'rgba(0,0,0,0.55)',
  overlayLight: 'rgba(0,0,0,0.18)',
  emergency: '#E24842',
  critical: '#FF1744',
  stable: '#0B7E8A',
  info: '#52B2B5',

  // Text legacy aliases (keep existing screens compiling)
  textSecondary: '#7A8785',   // maps to textMuted
  textTertiary: '#97A2A0',    // maps to textMuted2
};

export const fonts = {
  // Montserrat — brand, headings, buttons, labels
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semiBold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extraBold: 'Montserrat_800ExtraBold',
  // Inter — body text, descriptions, captions
  bodyRegular: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemiBold: 'SpaceGrotesk_600SemiBold',
};

export const typography = {
  h1: { fontFamily: 'Montserrat_600SemiBold', fontSize: 32, fontWeight: '600' as const, lineHeight: 40, letterSpacing: -0.5 },
  h2: { fontFamily: 'Montserrat_600SemiBold', fontSize: 24, fontWeight: '600' as const, lineHeight: 32, letterSpacing: -0.25 },
  h3: { fontFamily: 'Montserrat_600SemiBold', fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontFamily: 'Montserrat_600SemiBold', fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  bodyLarge: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontFamily: 'Montserrat_700Bold', fontSize: 15, fontWeight: '700' as const, lineHeight: 20 },
  buttonSmall: { fontFamily: 'Montserrat_600SemiBold', fontSize: 13, fontWeight: '600' as const, lineHeight: 16 },
  label: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  overline: { fontFamily: 'Montserrat_600SemiBold', fontSize: 11, fontWeight: '600' as const, lineHeight: 12, letterSpacing: 1.8, textTransform: 'uppercase' as const },
};

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 28,
  full: 9999,
};

export const shadows = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  sm: { shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  lg: { shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  xl: { shadowColor: '#0C2E30', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 30, elevation: 14 },
  // hero card shadows
  card: { shadowColor: '#083236', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
};

export const layout = {
  screenWidth,
  screenHeight,
  isSmallScreen: screenWidth < 375,
  isLargeScreen: screenWidth > 414,
  contentMaxWidth: Math.min(screenWidth - spacing.xl * 2, 600),
};

export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};

export const components = {
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  button: {
    height: sizing.buttonHeight,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  input: {
    height: sizing.inputHeight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
};
