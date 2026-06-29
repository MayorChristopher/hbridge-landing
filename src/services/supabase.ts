import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database Tables Schema
export const DATABASE_TABLES = {
  USERS: 'users',
  DOCTORS: 'doctors',
  HOSPITALS: 'hospitals',
  REVIEWS: 'reviews',
  NOTIFICATIONS: 'notifications',
  EMERGENCY_ALERTS: 'emergency_alerts',
  HOSPITAL_SERVICES: 'hospital_services',
  DOCTOR_AVAILABILITY: 'doctor_availability',
  DOCTOR_EDUCATION: 'doctor_education',
  DOCTOR_CERTIFICATIONS: 'doctor_certifications',
  HOSPITAL_AFFILIATIONS: 'hospital_affiliations',
} as const;