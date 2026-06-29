// Re-export design system for backward compatibility
export * from './design';

// Additional responsive utilities
import { Dimensions } from 'react-native';
import { colors, typography, spacing, borderRadius } from './design';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
export const breakpoints = {
  small: 320,
  medium: 768,
  large: 1024,
};

// Responsive helpers
export const isSmallScreen = screenWidth < breakpoints.medium;
export const isMediumScreen = screenWidth >= breakpoints.medium && screenWidth < breakpoints.large;
export const isLargeScreen = screenWidth >= breakpoints.large;

// Responsive spacing
export const responsiveSpacing = {
  xs: isSmallScreen ? spacing.xs : spacing.sm,
  sm: isSmallScreen ? spacing.sm : spacing.md,
  md: isSmallScreen ? spacing.md : spacing.lg,
  lg: isSmallScreen ? spacing.lg : spacing.xl,
  xl: isSmallScreen ? spacing.xl : spacing.xxl,
};

// Responsive typography
export const responsiveTypography = {
  h1: {
    ...typography.h1,
    fontSize: isSmallScreen ? 24 : typography.h1.fontSize,
  },
  h2: {
    ...typography.h2,
    fontSize: isSmallScreen ? 20 : typography.h2.fontSize,
  },
  h3: {
    ...typography.h3,
    fontSize: isSmallScreen ? 18 : typography.h3.fontSize,
  },
};

// Professional card styles for different contexts
export const cardStyles = {
  default: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  flat: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
};