import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  user_type?: string;
  screen_name?: string;
  properties?: Record<string, any>;
  timestamp: string;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private userId: string | null = null;
  private userType: string | null = null;
  private sessionId: string;

  private constructor() {
    this.sessionId = Date.now().toString();
    this.initializeUser();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async initializeUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single();
        this.userType = profile?.user_type || null;
      }
    } catch (error) {
      console.error('Analytics: Failed to initialize user', error);
    }
  }

  // Track screen views
  async trackScreen(screenName: string, properties?: Record<string, any>) {
    await this.trackEvent('screen_view', {
      screen_name: screenName,
      ...properties
    });
  }

  // Track user actions
  async trackEvent(eventName: string, properties?: Record<string, any>) {
    try {
      const event: AnalyticsEvent = {
        event_name: eventName,
        user_id: this.userId,
        user_type: this.userType,
        properties: {
          session_id: this.sessionId,
          app_version: '1.0.0',
          ...properties
        },
        timestamp: new Date().toISOString()
      };

      // Store locally first (for offline support)
      await this.storeEventLocally(event);
      
      // Send to Supabase
      await this.sendToSupabase(event);
    } catch (error) {
      console.error('Analytics: Failed to track event', error);
    }
  }

  // Track user properties
  async setUserProperties(properties: Record<string, any>) {
    try {
      if (!this.userId) return;
      
      await supabase
        .from('user_analytics')
        .upsert({
          user_id: this.userId,
          properties: properties,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Analytics: Failed to set user properties', error);
    }
  }

  private async storeEventLocally(event: AnalyticsEvent) {
    try {
      const stored = await AsyncStorage.getItem('pending_analytics');
      const events = stored ? JSON.parse(stored) : [];
      events.push(event);
      
      // Keep only last 100 events locally
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      await AsyncStorage.setItem('pending_analytics', JSON.stringify(events));
    } catch (error) {
      console.error('Analytics: Failed to store locally', error);
    }
  }

  private async sendToSupabase(event: AnalyticsEvent) {
    try {
      await supabase
        .from('analytics_events')
        .insert(event);
    } catch (error) {
      console.error('Analytics: Failed to send to Supabase', error);
    }
  }

  // Sync offline events
  async syncOfflineEvents() {
    try {
      const stored = await AsyncStorage.getItem('pending_analytics');
      if (!stored) return;
      
      const events = JSON.parse(stored);
      if (events.length === 0) return;
      
      await supabase
        .from('analytics_events')
        .insert(events);
        
      await AsyncStorage.removeItem('pending_analytics');
    } catch (error) {
      console.error('Analytics: Failed to sync offline events', error);
    }
  }
}

export default AnalyticsService;