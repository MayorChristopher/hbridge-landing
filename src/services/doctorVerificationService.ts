import { supabase } from '../lib/supabase';

export class DoctorVerificationService {
  static async verifyLicense(licenseNumber: string, specialization: string): Promise<{ valid: boolean; message: string }> {
    try {
      // Validate license format (Nigerian medical license format)
      if (!licenseNumber || licenseNumber.length < 5) {
        return { valid: false, message: 'Invalid license number format' };
      }

      // Check if license exists in database
      const { data, error } = await supabase
        .from('doctor_licenses')
        .select('*')
        .eq('license_number', licenseNumber)
        .single();

      if (error || !data) {
        return { valid: false, message: 'License not found in registry' };
      }

      if (data.status !== 'active') {
        return { valid: false, message: 'License is not active' };
      }

      if (data.specialization !== specialization) {
        return { valid: false, message: 'Specialization does not match license' };
      }

      return { valid: true, message: 'License verified successfully' };
    } catch (error) {
      return { valid: false, message: 'Verification failed. Please try again.' };
    }
  }

  static async updateVerificationStatus(userId: string, status: 'verified' | 'pending' | 'rejected'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ verification_status: status })
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      return false;
    }
  }
}
