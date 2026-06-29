import { supabase } from '../lib/supabase';
import { AppTestSuite } from './appTestSuite';

export interface LaunchValidation {
  isReady: boolean;
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
}

export class LaunchValidator {
  private static instance: LaunchValidator;
  
  static getInstance(): LaunchValidator {
    if (!LaunchValidator.instance) {
      LaunchValidator.instance = new LaunchValidator();
    }
    return LaunchValidator.instance;
  }

  async validateAppLaunch(): Promise<LaunchValidation> {
    const validation: LaunchValidation = {
      isReady: true,
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };

    try {
      // Run comprehensive tests
      const testSuite = AppTestSuite.getInstance();
      const results = await testSuite.runAllTests();

      // Analyze results
      const failed = results.filter(r => r.status === 'FAILED');
      const warnings = results.filter(r => r.status === 'WARNING');

      if (failed.length > 0) {
        validation.isReady = false;
        validation.criticalIssues = failed.map(f => f.message);
      }

      if (warnings.length > 0) {
        validation.warnings = warnings.map(w => w.message);
      }

      // Check specific critical components
      await this.validateCriticalComponents(validation);

    } catch (error) {
      validation.isReady = false;
      validation.criticalIssues.push('Launch validation failed');
    }

    return validation;
  }

  private async validateCriticalComponents(validation: LaunchValidation): Promise<void> {
    // Database connectivity
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1);
      if (error) {
        validation.criticalIssues.push('Database connection failed');
        validation.isReady = false;
      }
    } catch (error) {
      validation.criticalIssues.push('Database unavailable');
      validation.isReady = false;
    }

    // Environment variables
    if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
      validation.warnings.push('AI service may not work - API key missing');
    }

    // Navigation structure
    const requiredScreens = ['WelcomeScreen', 'AuthScreen', 'HomeScreen'];
    // This would normally check if screens are properly registered
    validation.recommendations.push('Verify all screens are properly registered');
  }

  async validateUserFlow(userType: 'patient' | 'doctor' | 'hospital_admin'): Promise<LaunchValidation> {
    const validation: LaunchValidation = {
      isReady: true,
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };

    try {
      const testSuite = AppTestSuite.getInstance();
      const results = await testSuite.testUserFlow(userType);

      const failed = results.filter(r => r.status === 'FAILED');
      if (failed.length > 0) {
        validation.isReady = false;
        validation.criticalIssues = failed.map(f => f.message);
      }

      // User-specific validations
      switch (userType) {
        case 'patient':
          validation.recommendations.push('Ensure AI chat is working');
          validation.recommendations.push('Verify doctor search functionality');
          break;
        case 'doctor':
          validation.recommendations.push('Check patient management features');
          validation.recommendations.push('Verify appointment system');
          break;
        case 'hospital_admin':
          validation.recommendations.push('Validate admin dashboard');
          validation.recommendations.push('Check staff management tools');
          break;
      }

    } catch (error) {
      validation.isReady = false;
      validation.criticalIssues.push(`${userType} flow validation failed`);
    }

    return validation;
  }
}