import { supabase } from '../lib/supabase';
import { sanitizeForLog } from '../utils/security';

export interface DatabaseTestResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  message: string;
  details?: any;
}

export class DatabaseTestService {
  private static instance: DatabaseTestService;
  
  static getInstance(): DatabaseTestService {
    if (!DatabaseTestService.instance) {
      DatabaseTestService.instance = new DatabaseTestService();
    }
    return DatabaseTestService.instance;
  }

  async runAllTests(): Promise<DatabaseTestResult[]> {
    const results: DatabaseTestResult[] = [];

    // Test 1: Basic Connection
    results.push(await this.testConnection());
    
    // Test 2: Authentication
    results.push(await this.testAuthentication());
    
    // Test 3: Profiles Table
    results.push(await this.testProfilesTable());
    
    // Test 4: Hospitals Table
    results.push(await this.testHospitalsTable());
    
    // Test 5: Doctors Table
    results.push(await this.testDoctorsTable());
    
    // Test 6: Medical Records Table
    results.push(await this.testMedicalRecordsTable());
    
    // Test 7: Medical Record Access Table
    results.push(await this.testMedicalRecordAccessTable());
    
    // Test 8: Consultations Table
    results.push(await this.testConsultationsTable());
    
    // Test 9: Notifications Table
    results.push(await this.testNotificationsTable());
    
    // Test 10: Storage Buckets
    results.push(await this.testStorageBuckets());

    return results;
  }

  private async testConnection(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (error) {
        return {
          testName: 'Database Connection',
          status: 'FAILED',
          message: `Connection failed: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      return {
        testName: 'Database Connection',
        status: 'PASSED',
        message: 'Successfully connected to Supabase database'
      };
    } catch (error) {
      return {
        testName: 'Database Connection',
        status: 'FAILED',
        message: `Connection error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testAuthentication(): Promise<DatabaseTestResult> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        return {
          testName: 'Authentication',
          status: 'WARNING',
          message: `Auth error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      if (!user) {
        return {
          testName: 'Authentication',
          status: 'WARNING',
          message: 'No authenticated user (expected for testing)',
          details: null
        };
      }

      return {
        testName: 'Authentication',
        status: 'PASSED',
        message: `Authenticated user: ${sanitizeForLog(user.email)}`,
        details: { userId: user.id, email: user.email }
      };
    } catch (error) {
      return {
        testName: 'Authentication',
        status: 'FAILED',
        message: `Auth system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testProfilesTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Profiles Table',
          status: 'FAILED',
          message: `Profiles table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      return {
        testName: 'Profiles Table',
        status: 'PASSED',
        message: `Profiles table accessible. Found ${data?.length || 0} profiles`,
        details: { count: data?.length || 0 }
      };
    } catch (error) {
      return {
        testName: 'Profiles Table',
        status: 'FAILED',
        message: `Profiles table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testHospitalsTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('id, name, is_active')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Hospitals Table',
          status: 'FAILED',
          message: `Hospitals table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      const activeHospitals = data?.filter(h => h.is_active).length || 0;

      return {
        testName: 'Hospitals Table',
        status: 'PASSED',
        message: `Hospitals table accessible. Found ${data?.length || 0} hospitals (${activeHospitals} active)`,
        details: { total: data?.length || 0, active: activeHospitals }
      };
    } catch (error) {
      return {
        testName: 'Hospitals Table',
        status: 'FAILED',
        message: `Hospitals table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testDoctorsTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, full_name, verification_status')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Doctors Table',
          status: 'FAILED',
          message: `Doctors table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      const verifiedDoctors = data?.filter(d => d.verification_status === 'verified').length || 0;

      return {
        testName: 'Doctors Table',
        status: 'PASSED',
        message: `Doctors table accessible. Found ${data?.length || 0} doctors (${verifiedDoctors} verified)`,
        details: { total: data?.length || 0, verified: verifiedDoctors }
      };
    } catch (error) {
      return {
        testName: 'Doctors Table',
        status: 'FAILED',
        message: `Doctors table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testMedicalRecordsTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('id, record_type, is_sensitive')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Medical Records Table',
          status: 'FAILED',
          message: `Medical records table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      return {
        testName: 'Medical Records Table',
        status: 'PASSED',
        message: `Medical records table accessible. Found ${data?.length || 0} records`,
        details: { count: data?.length || 0 }
      };
    } catch (error) {
      return {
        testName: 'Medical Records Table',
        status: 'FAILED',
        message: `Medical records table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testMedicalRecordAccessTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('medical_record_access')
        .select('id, granted_at')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Medical Record Access Table',
          status: 'FAILED',
          message: `Medical record access table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      return {
        testName: 'Medical Record Access Table',
        status: 'PASSED',
        message: `Medical record access table accessible. Found ${data?.length || 0} access records`,
        details: { count: data?.length || 0 }
      };
    } catch (error) {
      return {
        testName: 'Medical Record Access Table',
        status: 'FAILED',
        message: `Medical record access table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testConsultationsTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('id, status, consultation_type')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Consultations Table',
          status: 'FAILED',
          message: `Consultations table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      return {
        testName: 'Consultations Table',
        status: 'PASSED',
        message: `Consultations table accessible. Found ${data?.length || 0} consultations`,
        details: { count: data?.length || 0 }
      };
    } catch (error) {
      return {
        testName: 'Consultations Table',
        status: 'FAILED',
        message: `Consultations table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testNotificationsTable(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, is_read')
        .limit(5);
      
      if (error) {
        return {
          testName: 'Notifications Table',
          status: 'FAILED',
          message: `Notifications table error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      return {
        testName: 'Notifications Table',
        status: 'PASSED',
        message: `Notifications table accessible. Found ${data?.length || 0} notifications`,
        details: { count: data?.length || 0 }
      };
    } catch (error) {
      return {
        testName: 'Notifications Table',
        status: 'FAILED',
        message: `Notifications table system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  private async testStorageBuckets(): Promise<DatabaseTestResult> {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      
      if (error) {
        return {
          testName: 'Storage Buckets',
          status: 'FAILED',
          message: `Storage buckets error: ${sanitizeForLog(error.message)}`,
          details: error
        };
      }

      const bucketNames = data?.map(b => b.name) || [];
      const hasProfilesBucket = bucketNames.includes('profiles');
      const hasMedicalBucket = bucketNames.includes('medical-records');

      return {
        testName: 'Storage Buckets',
        status: hasProfilesBucket ? 'PASSED' : 'WARNING',
        message: `Found ${bucketNames.length} storage buckets: ${bucketNames.join(', ')}`,
        details: { 
          buckets: bucketNames, 
          hasProfiles: hasProfilesBucket, 
          hasMedical: hasMedicalBucket 
        }
      };
    } catch (error) {
      return {
        testName: 'Storage Buckets',
        status: 'FAILED',
        message: `Storage system error: ${sanitizeForLog(error)}`,
        details: error
      };
    }
  }

  async testSpecificUserData(userId: string): Promise<DatabaseTestResult[]> {
    const results: DatabaseTestResult[] = [];

    // Test user profile
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        results.push({
          testName: 'User Profile',
          status: 'FAILED',
          message: `Profile error: ${sanitizeForLog(error.message)}`,
          details: error
        });
      } else {
        results.push({
          testName: 'User Profile',
          status: 'PASSED',
          message: `Profile found for user: ${sanitizeForLog(profile.full_name)}`,
          details: { userType: profile.user_type, hasPin: !!profile.medical_pin }
        });
      }
    } catch (error) {
      results.push({
        testName: 'User Profile',
        status: 'FAILED',
        message: `Profile system error: ${sanitizeForLog(error)}`,
        details: error
      });
    }

    return results;
  }
}