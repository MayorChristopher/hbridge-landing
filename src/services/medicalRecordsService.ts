import { supabase } from '../lib/supabase';
import { ValidationService } from './validationService';

export interface MedicalRecord {
  id: string;
  user_id: string;
  doctor_id?: string;
  consultation_id?: string;
  record_type: 'diagnosis' | 'prescription' | 'lab_result' | 'imaging' | 'vital_signs' | 'allergy' | 'vaccination';
  title: string;
  description?: string;
  data: any;
  attachments?: string[];
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

export interface VitalSigns {
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  oxygen_saturation?: number;
}

export class MedicalRecordsService {
  private static instance: MedicalRecordsService;
  
  static getInstance(): MedicalRecordsService {
    if (!MedicalRecordsService.instance) {
      MedicalRecordsService.instance = new MedicalRecordsService();
    }
    return MedicalRecordsService.instance;
  }

  async createRecord(recordData: {
    user_id: string;
    doctor_id?: string;
    consultation_id?: string;
    record_type: MedicalRecord['record_type'];
    title: string;
    description?: string;
    data: any;
    attachments?: string[];
    is_sensitive?: boolean;
  }): Promise<{ success: boolean; record_id?: string; message: string }> {
    try {
      // Validate input
      const validatedData = ValidationService.validateUserProfile({
        full_name: recordData.title,
        email: 'temp@temp.com' // Just for validation
      });

      const { data: record, error } = await supabase
        .from('medical_records')
        .insert({
          ...recordData,
          is_sensitive: recordData.is_sensitive || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        record_id: record.id,
        message: 'Medical record created successfully'
      };
    } catch (error) {
      console.error('Error creating medical record:', error);
      return {
        success: false,
        message: 'Failed to create medical record'
      };
    }
  }

  async getPatientRecords(userId: string, recordType?: MedicalRecord['record_type']): Promise<MedicalRecord[]> {
    try {
      let query = supabase
        .from('medical_records')
        .select(`
          *,
          doctor:doctors(full_name, specialization),
          consultation:consultations(scheduled_at, consultation_type)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (recordType) {
        query = query.eq('record_type', recordType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching medical records:', error);
      return [];
    }
  }

  async addVitalSigns(patientId: string, vitalSigns: VitalSigns, doctorId?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Calculate BMI if height and weight are provided
      if (vitalSigns.height && vitalSigns.weight) {
        const heightInMeters = vitalSigns.height / 100;
        vitalSigns.bmi = Math.round((vitalSigns.weight / (heightInMeters * heightInMeters)) * 10) / 10;
      }

      const result = await this.createRecord({
        user_id: patientId,
        doctor_id: doctorId,
        record_type: 'vital_signs',
        title: `Vital Signs - ${new Date().toLocaleDateString()}`,
        description: 'Recorded vital signs',
        data: vitalSigns,
        is_sensitive: false
      });

      return result;
    } catch (error) {
      console.error('Error adding vital signs:', error);
      return {
        success: false,
        message: 'Failed to record vital signs'
      };
    }
  }

  async addAllergy(patientId: string, allergyData: {
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
    notes?: string;
  }, doctorId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.createRecord({
        user_id: patientId,
        doctor_id: doctorId,
        record_type: 'allergy',
        title: `Allergy: ${allergyData.allergen}`,
        description: `${allergyData.severity} reaction to ${allergyData.allergen}`,
        data: allergyData,
        is_sensitive: true
      });

      return result;
    } catch (error) {
      console.error('Error adding allergy:', error);
      return {
        success: false,
        message: 'Failed to record allergy'
      };
    }
  }

  async addPrescription(
    patientId: string,
    prescriptionData: {
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
      }>;
      diagnosis: string;
      notes?: string;
    },
    doctorId: string,
    consultationId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.createRecord({
        user_id: patientId,
        doctor_id: doctorId,
        consultation_id: consultationId,
        record_type: 'prescription',
        title: `Prescription - ${prescriptionData.diagnosis}`,
        description: `${prescriptionData.medications.length} medication(s) prescribed`,
        data: prescriptionData,
        is_sensitive: true
      });

      return result;
    } catch (error) {
      console.error('Error adding prescription:', error);
      return {
        success: false,
        message: 'Failed to create prescription'
      };
    }
  }

  async getHealthSummary(patientId: string): Promise<{
    allergies: MedicalRecord[];
    chronic_conditions: MedicalRecord[];
    recent_vitals: MedicalRecord | null;
    active_prescriptions: MedicalRecord[];
    upcoming_appointments: any[];
  }> {
    try {
      const [allergies, diagnoses, vitals, prescriptions, appointments] = await Promise.all([
        this.getPatientRecords(patientId, 'allergy'),
        this.getPatientRecords(patientId, 'diagnosis'),
        supabase
          .from('medical_records')
          .select('*')
          .eq('user_id', patientId)
          .eq('record_type', 'vital_signs')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        this.getPatientRecords(patientId, 'prescription'),
        supabase
          .from('consultations')
          .select(`
            *,
            doctor:doctors(full_name, specialization)
          `)
          .eq('patient_id', patientId)
          .eq('status', 'scheduled')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
      ]);

      // Filter chronic conditions from diagnoses
      const chronic_conditions = diagnoses.filter(record => 
        record.data?.is_chronic || 
        ['diabetes', 'hypertension', 'asthma', 'heart disease'].some(condition =>
          record.title.toLowerCase().includes(condition) ||
          record.description?.toLowerCase().includes(condition)
        )
      );

      // Filter recent prescriptions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const active_prescriptions = prescriptions.filter(record =>
        new Date(record.created_at) > thirtyDaysAgo
      );

      return {
        allergies: allergies.slice(0, 5), // Latest 5 allergies
        chronic_conditions: chronic_conditions.slice(0, 5),
        recent_vitals: vitals.data || null,
        active_prescriptions: active_prescriptions.slice(0, 5),
        upcoming_appointments: appointments.data || []
      };
    } catch (error) {
      console.error('Error fetching health summary:', error);
      return {
        allergies: [],
        chronic_conditions: [],
        recent_vitals: null,
        active_prescriptions: [],
        upcoming_appointments: []
      };
    }
  }

  async shareRecord(recordId: string, providerId: string, patientId: string, providerType: 'doctor' | 'hospital'): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const { data: record, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('id', recordId)
        .eq('user_id', patientId)
        .single();

      if (error || !record) {
        return {
          success: false,
          message: 'Record not found or access denied'
        };
      }

      const { error: shareError } = await supabase
        .from('medical_record_access')
        .insert({
          record_id: recordId,
          patient_id: patientId,
          doctor_id: providerType === 'doctor' ? providerId : null,
          hospital_id: providerType === 'hospital' ? providerId : null,
          access_type: 'view',
          granted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true
        });

      if (shareError) throw shareError;

      return {
        success: true,
        message: 'Record shared successfully'
      };
    } catch (error) {
      console.error('Error sharing record:', error);
      return {
        success: false,
        message: 'Failed to share record'
      };
    }
  }

  async getSharedRecords(userId: string): Promise<{
    received: any[];
    sent: any[];
  }> {
    try {
      const { data: doctorProfile } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', userId)
        .single();

      const receivedQuery = doctorProfile
        ? supabase
            .from('medical_record_access')
            .select(`
              *,
              record:medical_records(*),
              patient:profiles!medical_record_access_patient_id_fkey(full_name),
              hospital:hospitals(name, type)
            `)
            .eq('doctor_id', doctorProfile.id)
            .eq('is_active', true)
            .order('granted_at', { ascending: false })
        : Promise.resolve({ data: [] });

      const sentQuery = supabase
        .from('medical_record_access')
        .select(`
          *,
          record:medical_records(*),
          doctor:doctors(full_name, specialization),
          hospital:hospitals(name, type)
        `)
        .eq('patient_id', userId)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      const [receivedData, sentData] = await Promise.all([receivedQuery, sentQuery]);

      return {
        received: receivedData.data || [],
        sent: sentData.data || []
      };
    } catch (error) {
      console.error('Error fetching shared records:', error);
      return {
        received: [],
        sent: []
      };
    }
  }

  async markRecordAsRead(accessId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('medical_record_access')
        .update({ 
          notes: 'read',
          updated_at: new Date().toISOString()
        })
        .eq('id', accessId);

      return !error;
    } catch (error) {
      console.error('Error marking record as read:', error);
      return false;
    }
  }
}