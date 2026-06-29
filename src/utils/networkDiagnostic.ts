import { supabase } from '../lib/supabase';

export class NetworkDiagnostic {
  static async testConnection(): Promise<{
    success: boolean;
    error?: string;
    details: {
      supabaseUrl: string;
      canReachSupabase: boolean;
      authWorking: boolean;
      timestamp: string;
    };
  }> {
    const details = {
      supabaseUrl: 'https://vapoyosssxnprxznnfgb.supabase.co',
      canReachSupabase: false,
      authWorking: false,
      timestamp: new Date().toISOString(),
    };

    try {
      // Test 1: Basic fetch to Supabase
      console.log('[NetworkDiagnostic] Testing basic connectivity...');
      const response = await fetch(details.supabaseUrl + '/rest/v1/', {
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcG95b3Nzc3hucHJ4em5uZmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTM3MDgsImV4cCI6MjA4MTkyOTcwOH0.kM-qHB-K4xU0pFsh2_Eb2MlZf9gG9diD-0TGNxIaceM',
        },
      });
      
      if (response.status === 200 || response.status === 404) {
        details.canReachSupabase = true;
        console.log('[NetworkDiagnostic] ✅ Basic connectivity OK');
      }

      // Test 2: Supabase auth
      console.log('[NetworkDiagnostic] Testing Supabase auth...');
      const { data, error } = await supabase.auth.getSession();
      if (!error) {
        details.authWorking = true;
        console.log('[NetworkDiagnostic] ✅ Supabase auth OK');
      } else {
        console.log('[NetworkDiagnostic] ⚠️ Supabase auth issue:', error.message);
      }

      return {
        success: details.canReachSupabase && details.authWorking,
        details,
      };

    } catch (error: any) {
      console.log('[NetworkDiagnostic] ❌ Connection failed:', error.message);
      return {
        success: false,
        error: error.message,
        details,
      };
    }
  }

  static async testWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.log(`[NetworkDiagnostic] Attempt ${i + 1} failed:`, error.message);
        
        if (i < maxRetries - 1) {
          console.log(`[NetworkDiagnostic] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }
}