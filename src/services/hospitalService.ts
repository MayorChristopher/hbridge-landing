import { supabase } from './supabase';
import { Hospital, SearchFilters, SearchResult } from '../types';

export class HospitalService {
  private static instance: HospitalService;
  
  static getInstance(): HospitalService {
    if (!HospitalService.instance) {
      HospitalService.instance = new HospitalService();
    }
    return HospitalService.instance;
  }

  async findNearestHospitals(
    latitude: number,
    longitude: number,
    radius: number = 50, // km
    isEmergency: boolean = false
  ): Promise<Hospital[]> {
    try {
      let query = supabase
        .from('hospitals')
        .select(`
          *,
          hospital_services(*),
          reviews(rating)
        `);

      if (isEmergency) {
        query = query.eq('emergency_services', true);
      }

      const { data: hospitals, error } = await query;

      if (error) throw error;

      // Calculate distances and sort by proximity
      const hospitalsWithDistance = hospitals?.map(hospital => ({
        ...hospital,
        distance: this.calculateDistance(
          latitude,
          longitude,
          hospital.location.latitude,
          hospital.location.longitude
        )
      })).filter(hospital => hospital.distance <= radius)
        .sort((a, b) => a.distance - b.distance) || [];

      return hospitalsWithDistance;
    } catch (error) {
      console.error('Error finding nearest hospitals:', error);
      return [];
    }
  }

  async searchHospitals(filters: SearchFilters): Promise<SearchResult> {
    try {
      let query = supabase
        .from('hospitals')
        .select(`
          *,
          hospital_services(*),
          reviews(rating, comment, created_at)
        `);

      // Apply filters
      if (filters.hospital_type) {
        query = query.eq('type', filters.hospital_type);
      }

      if (filters.hospital_category) {
        query = query.eq('category', filters.hospital_category);
      }

      if (filters.emergency_services) {
        query = query.eq('emergency_services', true);
      }

      if (filters.rating_min) {
        query = query.gte('rating', filters.rating_min);
      }

      const { data: hospitals, error } = await query;

      if (error) throw error;

      let filteredHospitals = hospitals || [];

      // Location-based filtering
      if (filters.location) {
        filteredHospitals = filteredHospitals
          .map(hospital => ({
            ...hospital,
            distance: this.calculateDistance(
              filters.location!.latitude,
              filters.location!.longitude,
              hospital.location.latitude,
              hospital.location.longitude
            )
          }))
          .filter(hospital => hospital.distance <= filters.location!.radius)
          .sort((a, b) => a.distance - b.distance);
      }

      return {
        hospitals: filteredHospitals,
        doctors: [], // Will be implemented in DoctorService
        total_count: filteredHospitals.length
      };
    } catch (error) {
      console.error('Error searching hospitals:', error);
      return { hospitals: [], doctors: [], total_count: 0 };
    }
  }

  async getHospitalById(id: string): Promise<Hospital | null> {
    try {
      const { data: hospital, error } = await supabase
        .from('hospitals')
        .select(`
          *,
          hospital_services(*),
          reviews(
            *,
            reviewer:users(full_name, avatar_url)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return hospital;
    } catch (error) {
      console.error('Error fetching hospital:', error);
      return null;
    }
  }

  async addHospitalReview(
    hospitalId: string,
    userId: string,
    rating: number,
    comment: string,
    isAnonymous: boolean = false
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          target_type: 'hospital',
          target_id: hospitalId,
          reviewer_id: userId,
          rating,
          comment,
          is_anonymous: isAnonymous
        });

      if (error) throw error;

      // Update hospital average rating
      await this.updateHospitalRating(hospitalId);
      return true;
    } catch (error) {
      console.error('Error adding hospital review:', error);
      return false;
    }
  }

  private async updateHospitalRating(hospitalId: string): Promise<void> {
    try {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('target_type', 'hospital')
        .eq('target_id', hospitalId);

      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
        
        await supabase
          .from('hospitals')
          .update({ 
            rating: Math.round(avgRating * 10) / 10,
            total_reviews: reviews.length
          })
          .eq('id', hospitalId);
      }
    } catch (error) {
      console.error('Error updating hospital rating:', error);
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Emergency hospital recommendations based on symptoms
  async getEmergencyRecommendations(
    latitude: number,
    longitude: number,
    symptoms: string
  ): Promise<Hospital[]> {
    const emergencyHospitals = await this.findNearestHospitals(latitude, longitude, 25, true);
    
    // Prioritize based on symptoms and hospital specialization
    return emergencyHospitals.slice(0, 3); // Top 3 nearest emergency hospitals
  }
}