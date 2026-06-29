// Core User Types
export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  avatar_url?: string;
  user_type: 'patient' | 'doctor' | 'hospital_admin';
  location?: {
    latitude: number;
    longitude: number;
    address: string;
    state: string;
    lga: string;
  };
  created_at: string;
  updated_at: string;
  is_verified: boolean;
}

// Doctor Profile
export interface Doctor {
  id: string;
  user_id: string;
  user?: User;
  medical_license: string;
  specialization: Specialization;
  sub_specialization?: string;
  years_experience: number;
  education: Education[];
  certifications: Certification[];
  hospital_affiliations: HospitalAffiliation[];
  consultation_fee: number;
  availability: Availability[];
  rating: number;
  total_reviews: number;
  bio: string;
  languages: string[];
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_documents: string[];
  created_at: string;
  updated_at: string;
}

// Hospital Types
export interface Hospital {
  id: string;
  name: string;
  type: 'government' | 'private' | 'federal' | 'state' | 'specialist';
  category: 'general' | 'pediatric' | 'maternal' | 'cardiovascular' | 'orthopedic' | 'psychiatric' | 'oncology' | 'emergency';
  location: {
    latitude: number;
    longitude: number;
    address: string;
    state: string;
    lga: string;
    landmark?: string;
  };
  contact: {
    phone: string[];
    email?: string;
    website?: string;
    emergency_line?: string;
  };
  services: HospitalService[];
  departments: Department[];
  facilities: Facility[];
  images: string[];
  operating_hours: OperatingHours;
  emergency_services: boolean;
  ambulance_services: boolean;
  rating: number;
  total_reviews: number;
  bed_capacity?: number;
  insurance_accepted: string[];
  created_at: string;
  updated_at: string;
}

// Medical Specializations
export type Specialization = 
  | 'general_practice'
  | 'pediatrics'
  | 'gynecology'
  | 'cardiology'
  | 'neurology'
  | 'orthopedics'
  | 'dermatology'
  | 'psychiatry'
  | 'oncology'
  | 'ophthalmology'
  | 'ent'
  | 'urology'
  | 'radiology'
  | 'anesthesiology'
  | 'emergency_medicine'
  | 'family_medicine'
  | 'internal_medicine'
  | 'surgery'
  | 'pathology';

// Supporting Types
export interface Education {
  institution: string;
  degree: string;
  year_graduated: number;
  country: string;
}

export interface Certification {
  name: string;
  issuing_body: string;
  year_obtained: number;
  expiry_date?: string;
  certificate_url?: string;
}

export interface HospitalAffiliation {
  hospital_id: string;
  hospital?: Hospital;
  position: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
}

export interface Availability {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface HospitalService {
  name: string;
  description: string;
  is_emergency: boolean;
  cost_range?: {
    min: number;
    max: number;
  };
}

export interface Department {
  name: string;
  head_doctor?: string;
  contact?: string;
  services: string[];
}

export interface Facility {
  name: string;
  description: string;
  is_available: boolean;
}

export interface OperatingHours {
  monday: { open: string; close: string; is_24_hours: boolean };
  tuesday: { open: string; close: string; is_24_hours: boolean };
  wednesday: { open: string; close: string; is_24_hours: boolean };
  thursday: { open: string; close: string; is_24_hours: boolean };
  friday: { open: string; close: string; is_24_hours: boolean };
  saturday: { open: string; close: string; is_24_hours: boolean };
  sunday: { open: string; close: string; is_24_hours: boolean };
}

// Review & Rating Types
export interface Review {
  id: string;
  reviewer_id: string;
  reviewer?: User;
  target_type: 'doctor' | 'hospital';
  target_id: string;
  rating: number;
  comment: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

// AI Chat Types
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  metadata?: {
    location?: string;
    emergency_detected?: boolean;
    recommended_hospitals?: string[];
    recommended_doctors?: string[];
  };
}

export interface ChatSession {
  id: string;
  user_id?: string; // Optional for anonymous chats
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
  is_emergency: boolean;
  language: 'en' | 'pidgin';
}

// Search & Filter Types
export interface SearchFilters {
  specialization?: Specialization;
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in kilometers
  };
  hospital_type?: Hospital['type'];
  hospital_category?: Hospital['category'];
  rating_min?: number;
  consultation_fee_max?: number;
  availability_today?: boolean;
  emergency_services?: boolean;
  insurance?: string;
}

export interface SearchResult {
  doctors: Doctor[];
  hospitals: Hospital[];
  total_count: number;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'appointment' | 'emergency' | 'review' | 'system' | 'promotion';
  is_read: boolean;
  data?: any;
  created_at: string;
}

// Emergency Types
export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface EmergencyAlert {
  id: string;
  user_id: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  symptoms: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  nearest_hospitals: string[];
  emergency_contacts_notified: boolean;
  created_at: string;
  resolved_at?: string;
}