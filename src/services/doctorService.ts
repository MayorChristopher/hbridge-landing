import { supabase } from './supabase';
import { Doctor, SearchFilters, Specialization } from '../types';

export class DoctorService {
  private static instance: DoctorService;
  
  static getInstance(): DoctorService {
    if (!DoctorService.instance) {
      DoctorService.instance = new DoctorService();
    }
    return DoctorService.instance;
  }

  async searchDoctors(filters: SearchFilters): Promise<Doctor[]> {
    try {
      let query = supabase
        .from('doctors')
        .select(`
          *,
          user:users(*),
          reviews(rating, comment, created_at)
        `)
        .eq('verification_status', 'verified');

      if (filters.specialization) {
        query = query.eq('specialization', filters.specialization);
      }

      if (filters.rating_min) {
        query = query.gte('rating', filters.rating_min);
      }

      if (filters.consultation_fee_max) {
        query = query.lte('consultation_fee', filters.consultation_fee_max);
      }

      const { data: doctors, error } = await query;
      if (error) throw error;

      return doctors || [];
    } catch (error) {
      console.error('Error searching doctors:', error);
      return [];
    }
  }

  async registerDoctor(doctorData: {
    userId: string;
    medicalLicense: string;
    specialization: Specialization;
    yearsExperience: number;
    consultationFee: number;
    bio: string;
    verificationDocuments: string[];
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('doctors')
        .insert({
          user_id: doctorData.userId,
          medical_license: doctorData.medicalLicense,
          specialization: doctorData.specialization,
          years_experience: doctorData.yearsExperience,
          consultation_fee: doctorData.consultationFee,
          bio: doctorData.bio,
          verification_documents: doctorData.verificationDocuments,
          verification_status: 'pending'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error registering doctor:', error);
      return false;
    }
  }

  async verifyDoctor(doctorId: string, status: 'verified' | 'rejected'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ verification_status: status })
        .eq('id', doctorId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error verifying doctor:', error);
      return false;
    }
  }

  async getDoctorById(id: string): Promise<Doctor | null> {
    try {
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select(`
          *,
          user:users(*),
          reviews(*, reviewer:users(full_name, avatar_url))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return doctor;
    } catch (error) {
      console.error('Error fetching doctor:', error);
      return null;
    }
  }
}