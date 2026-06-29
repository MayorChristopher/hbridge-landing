// Development-only test screens - NOT included in production navigation
// Access via: __DEV__ && navigation.navigate('DevTestScreen')

import DatabaseTestScreen from '../screens/DatabaseTestScreen';

export const DEV_SCREENS = __DEV__ ? {
  DatabaseTest: DatabaseTestScreen,
} : {};

export const isDevelopment = __DEV__;

// Hidden development menu - only accessible in dev mode
export const DEV_MENU_ITEMS = __DEV__ ? [
  {
    title: 'System Health Check',
    screen: 'DatabaseTest',
    icon: 'pulse',
    description: 'Run comprehensive system tests'
  }
] : [];