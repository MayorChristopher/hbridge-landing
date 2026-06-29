import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Professional sizing system
export const sizing = {
  // Touch targets (minimum 44px for accessibility)
  touchTarget: 44,
  buttonHeight: 48,
  inputHeight: 44,
  
  // Icon sizes
  iconXs: 16,
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  iconXl: 48,
  
  // Avatar sizes
  avatarSm: 32,
  avatarMd: 48,
  avatarLg: 64,
  
  // Card and container sizes
  cardPadding: 16,
  containerPadding: 20,
  sectionSpacing: 24,
};

// Professional spacing system (8px base)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Safe area handling
export const safeArea = {
  top: Platform.OS === 'ios' ? (screenHeight >= 812 ? 44 : 20) : StatusBar.currentHeight || 24,
  bottom: Platform.OS === 'ios' ? (screenHeight >= 812 ? 34 : 0) : 16,
};

// Hbridge brand palette — Teal · Gold · White
export const colors = {
  // Primary — Teal
  primary: '#0B7E8A',
  primaryLight: '#3DA0AC',
  primaryDark: '#005F63',

  // Gold — tertiary accent
  gold: '#D4A843',
  goldLight: '#E2C97E',
  goldDark: '#9A7A28',

  // Secondary — Medical Red
  secondary: '#FF3B30',
  secondaryLight: '#FF6B5B',
  secondaryDark: '#E5342A',

  // Backgrounds — white/light
  background: '#FFFFFF',
  backgroundSecondary: '#F5F7FA',
  surface: '#F0F4F8',
  surfaceElevated: '#FFFFFF',

  // Text
  textPrimary: '#0A0A0A',
  textSecondary: '#555F6D',
  textTertiary: '#9AA3AE',
  textInverse: '#FFFFFF',

  // Status
  success: '#0B7E8A',
  warning: '#D4A843',
  error: '#FF3B30',
  info: '#52B2B5',

  // Medical
  emergency: '#FF3B30',
  critical: '#FF1744',
  stable: '#0B7E8A',

  // Borders
  border: '#E2E8EF',
  borderLight: '#F0F4F8',
  divider: '#E2E8EF',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};

// Font families
export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semiBold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extraBold: 'Montserrat_800ExtraBold',
};

// Typography scale
export const typography = {
  // Headings
  h1: {
    fontSize: 32,
    fontWeight: '600' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: -0.25,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  
  // Body text
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  
  // Interactive text
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  
  // Labels and captions
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  overline: {
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
};

// Professional border radius
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// Professional shadows (LinkedIn-style)
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Layout utilities
export const layout = {
  screenWidth,
  screenHeight,
  isSmallScreen: screenWidth < 375,
  isLargeScreen: screenWidth > 414,
  contentMaxWidth: Math.min(screenWidth - (spacing.xl * 2), 600),
};

// Animation durations
export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};

// Professional component styles (LinkedIn-inspired)
export const components = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  button: {
    height: sizing.buttonHeight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  
  input: {
    height: sizing.inputHeight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
};