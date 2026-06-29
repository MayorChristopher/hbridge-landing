import { supabase } from '../lib/supabase';

export interface PatientData {
  id: string;
  demographics: {
    age: number;
    gender: string;
    location: string;
  };
  medicalHistory: {
    conditions: string[];
    medications: string[];
    allergies: string[];
  };
  consultationHistory: {
    totalConsultations: number;
    preferredSpecialties: string[];
    averageRating: number;
    commonSymptoms: string[];
  };
  behaviorMetrics: {
    searchPatterns: string[];
    bookingFrequency: number;
    preferredTimes: string[];
    responseToRecommendations: number;
  };
}

export interface DoctorInsights {
  id: string;
  performanceMetrics: {
    patientSatisfaction: number;
    responseTime: number;
    consultationSuccess: number;
    specialtyExpertise: number;
  };
  patientDemographics: {
    ageGroups: Record<string, number>;
    commonConditions: string[];
    treatmentOutcomes: number;
  };
  aiRecommendationScore: number;
}

class AIDataService {
  // Analyze patient data for personalized recommendations
  async analyzePatientProfile(patientId: string): Promise<PatientData | null> {
    try {
      // Get user basic info
      const { data: user } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();

      if (!user) return null;

      // Get consultation history
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          *,
          doctors (
            specialization,
            average_rating
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      // Get doctor reviews by patient
      const { data: reviews } = await supabase
        .from('doctor_reviews')
        .select('rating, review_text, created_at')
        .eq('patient_id', patientId);

      // Analyze patterns
      const patientData: PatientData = {
        id: patientId,
        demographics: {
          age: user.date_of_birth ? this.calculateAge(user.date_of_birth) : 0,
          gender: user.gender || 'unknown',
          location: user.state || 'unknown'
        },
        medicalHistory: {
          conditions: this.extractConditions(consultations || []),
          medications: this.extractMedications(consultations || []),
          allergies: [] // Could be expanded
        },
        consultationHistory: {
          totalConsultations: consultations?.length || 0,
          preferredSpecialties: this.getPreferredSpecialties(consultations || []),
          averageRating: this.calculateAverageRating(reviews || []),
          commonSymptoms: this.extractCommonSymptoms(consultations || [])
        },
        behaviorMetrics: {
          searchPatterns: [], // Could track search history
          bookingFrequency: this.calculateBookingFrequency(consultations || []),
          preferredTimes: this.getPreferredTimes(consultations || []),
          responseToRecommendations: 0.8 // Default value
        }
      };

      return patientData;
    } catch (error) {
      console.error('Error analyzing patient profile:', error);
      return null;
    }
  }

  // Generate AI-powered doctor recommendations
  async generateSmartRecommendations(patientData: PatientData): Promise<string[]> {
    try {
      // Get all verified doctors
      const { data: doctors } = await supabase
        .from('doctors')
        .select('*')
        .eq('verification_status', 'verified');

      if (!doctors) return [];

      // Score each doctor based on patient data
      const scoredDoctors = doctors.map(doctor => ({
        ...doctor,
        aiScore: this.calculateAIScore(doctor, patientData)
      }));

      // Sort by AI score and return top recommendations
      return scoredDoctors
        .sort((a, b) => b.aiScore - a.aiScore)
        .slice(0, 10)
        .map(d => d.id);

    } catch (error) {
      console.error('Error generating smart recommendations:', error);
      return [];
    }
  }

  // Calculate AI score for doctor-patient matching
  private calculateAIScore(doctor: any, patientData: PatientData): number {
    let score = 0;

    // Specialty match (40% weight)
    if (patientData.consultationHistory.preferredSpecialties.includes(doctor.specialization)) {
      score += 0.4;
    }

    // Rating and reviews (25% weight)
    const ratingScore = (doctor.average_rating || 0) / 5;
    score += ratingScore * 0.25;

    // Experience match (15% weight)
    const experienceScore = Math.min(doctor.years_experience / 15, 1);
    score += experienceScore * 0.15;

    // Availability (10% weight)
    if (doctor.is_available) {
      score += 0.1;
    }

    // Price compatibility (10% weight)
    const priceScore = this.calculatePriceCompatibility(doctor.consultation_fee, patientData);
    score += priceScore * 0.1;

    return Math.min(score, 1);
  }

  // Generate personalized health insights
  async generateHealthInsights(patientId: string): Promise<string[]> {
    const patientData = await this.analyzePatientProfile(patientId);
    if (!patientData) return [];

    const insights: string[] = [];

    // Consultation frequency insights
    if (patientData.consultationHistory.totalConsultations > 5) {
      insights.push('You are an active healthcare user. Consider setting up regular check-ups with your preferred specialists.');
    }

    // Specialty preferences
    if (patientData.consultationHistory.preferredSpecialties.length > 0) {
      const topSpecialty = patientData.consultationHistory.preferredSpecialties[0];
      insights.push(`You frequently consult ${topSpecialty} specialists. We recommend Dr. specialists in this field.`);
    }

    // Rating patterns
    if (patientData.consultationHistory.averageRating > 4) {
      insights.push('You consistently rate doctors highly, indicating good healthcare experiences.');
    }

    // Booking patterns
    if (patientData.behaviorMetrics.bookingFrequency > 0.5) {
      insights.push('You book consultations regularly. Consider our subscription plans for better rates.');
    }

    return insights;
  }

  // Analyze doctor performance for AI recommendations
  async analyzeDoctorPerformance(doctorId: string): Promise<DoctorInsights | null> {
    try {
      const { data: doctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', doctorId)
        .single();

      if (!doctor) return null;

      // Get consultations
      const { data: consultations } = await supabase
        .from('consultations')
        .select('*')
        .eq('doctor_id', doctorId);

      // Get reviews
      const { data: reviews } = await supabase
        .from('doctor_reviews')
        .select('*')
        .eq('doctor_id', doctorId);

      const insights: DoctorInsights = {
        id: doctorId,
        performanceMetrics: {
          patientSatisfaction: doctor.average_rating || 0,
          responseTime: this.calculateResponseTime(consultations || []),
          consultationSuccess: this.calculateSuccessRate(consultations || []),
          specialtyExpertise: this.calculateExpertiseScore(doctor, consultations || [])
        },
        patientDemographics: {
          ageGroups: this.analyzePatientAgeGroups(consultations || []),
          commonConditions: this.extractConditions(consultations || []),
          treatmentOutcomes: this.calculateTreatmentOutcomes(consultations || [])
        },
        aiRecommendationScore: doctor.smart_score || 0
      };

      return insights;
    } catch (error) {
      console.error('Error analyzing doctor performance:', error);
      return null;
    }
  }

  // Update smart scores for all doctors
  async updateAllSmartScores(): Promise<void> {
    try {
      const { data: doctors } = await supabase
        .from('doctors')
        .select('id')
        .eq('verification_status', 'verified');

      if (!doctors) return;

      for (const doctor of doctors) {
        const insights = await this.analyzeDoctorPerformance(doctor.id);
        if (insights) {
          const smartScore = this.calculateOverallSmartScore(insights);
          
          await supabase
            .from('doctors')
            .update({ smart_score: smartScore })
            .eq('id', doctor.id);
        }
      }
    } catch (error) {
      console.error('Error updating smart scores:', error);
    }
  }

  // Helper methods
  private calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  private extractConditions(consultations: any[]): string[] {
    const conditions = consultations
      .map(c => c.diagnosis)
      .filter(d => d)
      .flatMap(d => d.split(',').map(s => s.trim()));
    
    return [...new Set(conditions)];
  }

  private extractMedications(consultations: any[]): string[] {
    const medications = consultations
      .map(c => c.prescription)
      .filter(p => p)
      .flatMap(p => p.split(',').map(s => s.trim()));
    
    return [...new Set(medications)];
  }

  private getPreferredSpecialties(consultations: any[]): string[] {
    const specialties = consultations
      .map(c => c.doctors?.specialization)
      .filter(s => s);
    
    const counts = specialties.reduce((acc, spec) => {
      acc[spec] = (acc[spec] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .map(([spec]) => spec);
  }

  private calculateAverageRating(reviews: any[]): number {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }

  private extractCommonSymptoms(consultations: any[]): string[] {
    const symptoms = consultations
      .map(c => c.symptoms)
      .filter(s => s)
      .flatMap(s => s.split(',').map(sym => sym.trim().toLowerCase()));
    
    const counts = symptoms.reduce((acc, symptom) => {
      acc[symptom] = (acc[symptom] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([symptom]) => symptom);
  }

  private calculateBookingFrequency(consultations: any[]): number {
    if (consultations.length === 0) return 0;
    
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    const recentConsultations = consultations.filter(c => 
      new Date(c.created_at) > sixMonthsAgo
    );
    
    return recentConsultations.length / 6; // consultations per month
  }

  private getPreferredTimes(consultations: any[]): string[] {
    const times = consultations
      .map(c => new Date(c.scheduled_at).getHours())
      .filter(h => !isNaN(h));
    
    const counts = times.reduce((acc, hour) => {
      const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      acc[period] = (acc[period] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .map(([period]) => period);
  }

  private calculatePriceCompatibility(fee: number, patientData: PatientData): number {
    // Simple price compatibility based on consultation history
    const avgFee = 20000; // Default average fee
    const ratio = fee / avgFee;
    
    if (ratio <= 0.5) return 1; // Very affordable
    if (ratio <= 1) return 0.8; // Affordable
    if (ratio <= 1.5) return 0.6; // Moderate
    if (ratio <= 2) return 0.4; // Expensive
    return 0.2; // Very expensive
  }

  private calculateResponseTime(consultations: any[]): number {
    const responseTimes = consultations
      .filter(c => c.started_at && c.scheduled_at)
      .map(c => {
        const scheduled = new Date(c.scheduled_at);
        const started = new Date(c.started_at);
        return (started.getTime() - scheduled.getTime()) / (1000 * 60); // minutes
      });
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
  }

  private calculateSuccessRate(consultations: any[]): number {
    if (consultations.length === 0) return 0;
    const completed = consultations.filter(c => c.status === 'completed').length;
    return completed / consultations.length;
  }

  private calculateExpertiseScore(doctor: any, consultations: any[]): number {
    let score = 0;
    
    // Years of experience (40%)
    score += Math.min(doctor.years_experience / 20, 1) * 0.4;
    
    // Number of consultations (30%)
    score += Math.min(consultations.length / 100, 1) * 0.3;
    
    // Success rate (30%)
    score += this.calculateSuccessRate(consultations) * 0.3;
    
    return score;
  }

  private analyzePatientAgeGroups(consultations: any[]): Record<string, number> {
    // This would require joining with patient data
    return {
      '18-30': 0.3,
      '31-45': 0.4,
      '46-60': 0.2,
      '60+': 0.1
    };
  }

  private calculateTreatmentOutcomes(consultations: any[]): number {
    const completed = consultations.filter(c => c.status === 'completed');
    const withFollowUp = completed.filter(c => c.follow_up_required);
    
    // Lower follow-up rate indicates better treatment outcomes
    return completed.length > 0 ? 1 - (withFollowUp.length / completed.length) : 0;
  }

  private calculateOverallSmartScore(insights: DoctorInsights): number {
    const metrics = insights.performanceMetrics;
    
    return (
      metrics.patientSatisfaction * 0.3 +
      (1 - Math.min(metrics.responseTime / 60, 1)) * 0.2 + // Lower response time is better
      metrics.consultationSuccess * 0.25 +
      metrics.specialtyExpertise * 0.25
    ) * 5; // Scale to 0-5
  }
}

export const AIData = new AIDataService();