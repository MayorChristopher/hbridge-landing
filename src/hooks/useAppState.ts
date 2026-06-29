import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export const useAppState = (onForeground?: () => void, onBackground?: () => void) => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground
        console.log('App has come to the foreground!');
        onForeground?.();
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App has gone to background
        console.log('App has gone to the background!');
        onBackground?.();
      }

      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [onForeground, onBackground]);

  return appState.current;
};