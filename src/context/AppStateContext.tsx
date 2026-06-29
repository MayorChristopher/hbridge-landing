import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  language: string;
  lastRoute: string;
  lastParams?: any;
}

interface AppStateContextType {
  appState: AppState;
  setLanguage: (lang: string) => Promise<void>;
  setLastRoute: (route: string, params?: any) => Promise<void>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>({
    language: 'en',
    lastRoute: 'Main',
  });

  useEffect(() => {
    loadAppState();
  }, []);

  const loadAppState = async () => {
    try {
      const [language, lastRoute, lastParams] = await Promise.all([
        AsyncStorage.getItem('preferred_language'),
        AsyncStorage.getItem('lastRoute'),
        AsyncStorage.getItem('lastParams'),
      ]);

      setAppState({
        language: language || 'en',
        lastRoute: lastRoute || 'Main',
        lastParams: lastParams ? JSON.parse(lastParams) : undefined,
      });
    } catch (error) {
      console.error('Error loading app state:', error);
    }
  };

  const setLanguage = async (lang: string) => {
    try {
      await AsyncStorage.setItem('preferred_language', lang);
      setAppState(prev => ({ ...prev, language: lang }));
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const setLastRoute = async (route: string, params?: any) => {
    try {
      await AsyncStorage.setItem('lastRoute', route);
      if (params) {
        await AsyncStorage.setItem('lastParams', JSON.stringify(params));
      }
      setAppState(prev => ({ ...prev, lastRoute: route, lastParams: params }));
    } catch (error) {
      console.error('Error saving route:', error);
    }
  };

  return (
    <AppStateContext.Provider value={{ appState, setLanguage, setLastRoute }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};
