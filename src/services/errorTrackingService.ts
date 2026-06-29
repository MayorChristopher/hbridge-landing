import { supabase } from '../lib/supabase';
import AnalyticsService from './analyticsService';

interface ErrorReport {
  error_type: 'crash' | 'error' | 'warning';
  message: string;
  stack?: string;
  user_id?: string;
  user_type?: string;
  screen_name?: string;
  app_version: string;
  device_info?: Record<string, any>;
  timestamp: string;
}

class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private analytics: AnalyticsService;

  private constructor() {
    this.analytics = AnalyticsService.getInstance();
    this.setupGlobalErrorHandler();
  }

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  private setupGlobalErrorHandler() {
    // Handle unhandled promise rejections
    const originalHandler = global.ErrorUtils?.getGlobalHandler();
    
    global.ErrorUtils?.setGlobalHandler((error, isFatal) => {
      this.reportError(error, {
        isFatal,
        type: 'unhandled_error'
      });
      
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    // Handle console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.reportError(new Error(args.join(' ')), {
        type: 'console_error'
      });
      originalConsoleError.apply(console, args);
    };
  }

  async reportError(error: Error, context?: Record<string, any>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const errorReport: ErrorReport = {
        error_type: context?.isFatal ? 'crash' : 'error',
        message: error.message,
        stack: error.stack,
        user_id: user?.id,
        app_version: '1.0.0',
        timestamp: new Date().toISOString(),
        device_info: context
      };

      // Send to Supabase
      await supabase
        .from('error_reports')
        .insert(errorReport);

      // Track as analytics event
      await this.analytics.trackEvent('error_occurred', {
        error_type: errorReport.error_type,
        error_message: error.message,
        is_fatal: context?.isFatal || false
      });

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  async reportCustomError(message: string, context?: Record<string, any>) {
    const error = new Error(message);
    await this.reportError(error, context);
  }

  // Performance monitoring
  async trackPerformance(metric: string, value: number, context?: Record<string, any>) {
    try {
      await this.analytics.trackEvent('performance_metric', {
        metric_name: metric,
        metric_value: value,
        ...context
      });
    } catch (error) {
      console.error('Failed to track performance:', error);
    }
  }
}

export default ErrorTrackingService;