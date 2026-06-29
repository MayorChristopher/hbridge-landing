import { useEffect, useRef } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import AnalyticsService from '../services/analyticsService';
import ErrorTrackingService from '../services/errorTrackingService';

export const useAnalytics = () => {
  const analytics = AnalyticsService.getInstance();
  const errorTracking = ErrorTrackingService.getInstance();
  
  return {
    // Track events
    trackEvent: (eventName: string, properties?: Record<string, any>) => 
      analytics.trackEvent(eventName, properties),
    
    // Track screen views
    trackScreen: (screenName: string, properties?: Record<string, any>) => 
      analytics.trackScreen(screenName, properties),
    
    // Set user properties
    setUserProperties: (properties: Record<string, any>) => 
      analytics.setUserProperties(properties),
    
    // Report errors
    reportError: (error: Error, context?: Record<string, any>) => 
      errorTracking.reportError(error, context),
    
    // Track performance
    trackPerformance: (metric: string, value: number, context?: Record<string, any>) => 
      errorTracking.trackPerformance(metric, value, context),
  };
};

// Hook for automatic screen tracking
export const useScreenTracking = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const analytics = AnalyticsService.getInstance();
  const screenStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const screenName = route.name;
    screenStartTime.current = Date.now();
    
    // Track screen view
    analytics.trackScreen(screenName, {
      screen_params: route.params
    });

    // Track screen duration on unmount
    return () => {
      const duration = Date.now() - screenStartTime.current;
      analytics.trackEvent('screen_duration', {
        screen_name: screenName,
        duration_ms: duration
      });
    };
  }, [route.name]);
};

// Hook for tracking user interactions
export const useInteractionTracking = () => {
  const analytics = AnalyticsService.getInstance();

  return {
    trackButtonPress: (buttonName: string, context?: Record<string, any>) =>
      analytics.trackEvent('button_press', { button_name: buttonName, ...context }),
    
    trackFormSubmit: (formName: string, success: boolean, context?: Record<string, any>) =>
      analytics.trackEvent('form_submit', { form_name: formName, success, ...context }),
    
    trackSearch: (query: string, results: number, context?: Record<string, any>) =>
      analytics.trackEvent('search', { query, results_count: results, ...context }),
    
    trackFeatureUse: (featureName: string, context?: Record<string, any>) =>
      analytics.trackEvent('feature_use', { feature_name: featureName, ...context }),
  };
};