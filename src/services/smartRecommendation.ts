import { supabase } from '../lib/supabase';

export interface DoctorMetrics {
  id: string;
  rating: number;
  totalReviews: number;
  responseTime: number;
  successRate: number;
  specialtyMatch: number;
  availabilityScore: number;
  smartScore: number;
}

export interface PatientPreferences {
  preferredSpecialties: string[];
  preferredConsultationType: 'online' | 'in_person' | 'both';
  maxDistance: number;
  budgetRange: [number, number];
  urgencyLevel: 'low' | 'medium' | 'high';
  previousDoctors: string[];
}

class SmartRecommendationService {
  // Calculate smart score for doctors (like LinkedIn's algorithm)
  async calculateDoctorScore(doctorId: string, patientPrefs?: PatientPreferences): Promise<number> {
    try {
      // Get doctor data
      const { data: doctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', doctorId)
        .single();

      if (!doctor) return 0;

      // Get reviews and ratings
      const { data: reviews } = await supabase
        .from('doctor_reviews')
        .select('rating, created_at')
        .eq('doctor_id', doctorId);

      // Get consultation history
      const { data: consultations } = await supabase
        .from('consultations')
        .select('status, created_at, scheduled_at')
        .eq('doctor_id', doctorId);

      // Calculate metrics
      const metrics = this.calculateMetrics(doctor, reviews || [], consultations || [], patientPrefs);
      
      // Smart scoring algorithm
      const smartScore = this.computeSmartScore(metrics);
      
      return Math.round(smartScore * 100) / 100;
    } catch (error) {
      console.error('Error calculating doctor score:', error);
      return 0;
    }
  }

  private calculateMetrics(doctor: any, reviews: any[], consultations: any[], prefs?: PatientPreferences): DoctorMetrics {
    // Rating calculation (weighted by recency)
    const rating = this.calculateWeightedRating(reviews);
    
    // Response time (average time to respond)
    const responseTime = this.calculateResponseTime(consultations);
    
    // Success rate (completed vs cancelled consultations)
    const successRate = this.calculateSuccessRate(consultations);
    
    // Specialty match with patient preferences
    const specialtyMatch = prefs ? this.calculateSpecialtyMatch(doctor.specialization, prefs.preferredSpecialties) : 0.5;
    
    // Availability score
    const availabilityScore = this.calculateAvailabilityScore(doctor, consultations);

    return {
      id: doctor.id,
      rating,
      totalReviews: reviews.length,
      responseTime,
      successRate,
      specialtyMatch,
      availabilityScore,
      smartScore: 0 // Will be calculated
    };
  }

  private computeSmartScore(metrics: DoctorMetrics): number {
    // Weighted algorithm (similar to LinkedIn's engagement algorithm)
    const weights = {
      rating: 0.25,           // 25% - Patient satisfaction
      successRate: 0.20,      // 20% - Consultation success
      specialtyMatch: 0.15,   // 15% - Specialty relevance
      availabilityScore: 0.15, // 15% - Doctor availability
      responseTime: 0.10,     // 10% - Response speed
      reviewCount: 0.10,      // 10% - Social proof
      recency: 0.05          // 5% - Recent activity
    };

    // Normalize metrics to 0-1 scale
    const normalizedRating = metrics.rating / 5;
    const normalizedResponseTime = Math.max(0, 1 - (metrics.responseTime / 24)); // 24 hours max
    const normalizedReviewCount = Math.min(1, metrics.totalReviews / 50); // 50 reviews = max score
    
    // Calculate smart score
    const smartScore = 
      (normalizedRating * weights.rating) +
      (metrics.successRate * weights.successRate) +
      (metrics.specialtyMatch * weights.specialtyMatch) +
      (metrics.availabilityScore * weights.availabilityScore) +
      (normalizedResponseTime * weights.responseTime) +
      (normalizedReviewCount * weights.reviewCount) +
      (0.8 * weights.recency); // Assume recent activity

    return Math.max(0, Math.min(5, smartScore * 5)); // Scale to 0-5
  }

  private calculateWeightedRating(reviews: any[]): number {
    if (reviews.length === 0) return 0;

    const now = new Date();
    let totalWeight = 0;
    let weightedSum = 0;

    reviews.forEach(review => {
      const daysSinceReview = (now.getTime() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const weight = Math.exp(-daysSinceReview / 365); // Exponential decay over a year
      
      weightedSum += review.rating * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateResponseTime(consultations: any[]): number {
    // Calculate average response time in hours
    const responseTimes = consultations
      .filter(c => c.status === 'completed')
      .map(c => {
        const scheduled = new Date(c.scheduled_at);
        const created = new Date(c.created_at);
        return (scheduled.getTime() - created.getTime()) / (1000 * 60 * 60);
      });

    return responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 24;
  }

  private calculateSuccessRate(consultations: any[]): number {
    if (consultations.length === 0) return 0;
    
    const completed = consultations.filter(c => c.status === 'completed').length;
    return completed / consultations.length;
  }

  private calculateSpecialtyMatch(doctorSpecialty: string, preferredSpecialties: string[]): number {
    if (!preferredSpecialties || preferredSpecialties.length === 0) return 0.5;
    
    return preferredSpecialties.includes(doctorSpecialty) ? 1 : 0.3;
  }

  private calculateAvailabilityScore(doctor: any, consultations: any[]): number {
    // Calculate based on recent booking density
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentBookings = consultations.filter(c => 
      new Date(c.created_at) > lastWeek
    ).length;

    // Lower bookings = higher availability
    return Math.max(0, 1 - (recentBookings / 20)); // 20 bookings per week = 0 availability
  }

  // Get smart recommendations for a patient
  async getSmartRecommendations(patientId: string, limit: number = 10): Promise<any[]> {
    try {
      // Get patient preferences (you might want to store these)
      const patientPrefs = await this.getPatientPreferences(patientId);
      
      // Get all verified doctors
      const { data: doctors } = await supabase
        .from('doctors')
        .select('*')
        .eq('verification_status', 'verified')
        .limit(50); // Get top 50 to score

      if (!doctors) return [];

      // Calculate smart scores for all doctors
      const scoredDoctors = await Promise.all(
        doctors.map(async (doctor) => {
          const smartScore = await this.calculateDoctorScore(doctor.id, patientPrefs);
          return { ...doctor, smartScore };
        })
      );

      // Sort by smart score and return top results
      return scoredDoctors
        .sort((a, b) => b.smartScore - a.smartScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting smart recommendations:', error);
      return [];
    }
  }

  private async getPatientPreferences(patientId: string): Promise<PatientPreferences> {
    // Default preferences - you can enhance this by storing user preferences
    return {
      preferredSpecialties: [],
      preferredConsultationType: 'both',
      maxDistance: 50,
      budgetRange: [0, 50000],
      urgencyLevel: 'medium',
      previousDoctors: []
    };
  }
}

export const SmartRecommendation = new SmartRecommendationService();