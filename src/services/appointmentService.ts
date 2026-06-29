import { supabase } from '../lib/supabase';
import { PaymentService } from './paymentService';

export interface AppointmentData {
  doctor_id: string;
  patient_id: string;
  consultation_type: 'online' | 'in_person';
  scheduled_at: string;
  symptoms?: string;
  notes?: string;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export class AppointmentService {
  private static instance: AppointmentService;
  private paymentService = PaymentService.getInstance();
  
  static getInstance(): AppointmentService {
    if (!AppointmentService.instance) {
      AppointmentService.instance = new AppointmentService();
    }
    return AppointmentService.instance;
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<TimeSlot[]> {
    try {
      // Get doctor's availability for the day
      const dayOfWeek = new Date(date).toLocaleLowerCase().slice(0, 3) + 'day';
      
      const { data: availability, error } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);

      if (error) throw error;

      if (!availability || availability.length === 0) {
        return [];
      }

      // Get existing appointments for the date
      const { data: appointments } = await supabase
        .from('consultations')
        .select('scheduled_at')
        .eq('doctor_id', doctorId)
        .gte('scheduled_at', `${date}T00:00:00`)
        .lt('scheduled_at', `${date}T23:59:59`)
        .in('status', ['scheduled', 'in_progress']);

      const bookedTimes = appointments?.map(apt => apt.scheduled_at) || [];

      // Generate available time slots
      const slots: TimeSlot[] = [];
      const startTime = availability[0].start_time;
      const endTime = availability[0].end_time;
      
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${date}T${endTime}`);
      
      while (start < end) {
        const slotTime = start.toISOString();
        const isBooked = bookedTimes.includes(slotTime);
        
        slots.push({
          start_time: slotTime,
          end_time: new Date(start.getTime() + 30 * 60000).toISOString(), // 30-minute slots
          is_available: !isBooked
        });
        
        start.setMinutes(start.getMinutes() + 30);
      }

      return slots;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      return [];
    }
  }

  async bookAppointment(appointmentData: AppointmentData): Promise<{
    success: boolean;
    consultation_id?: string;
    payment_required?: boolean;
    payment_reference?: string;
    message: string;
  }> {
    try {
      // Check if slot is still available
      const isAvailable = await this.isSlotAvailable(
        appointmentData.doctor_id,
        appointmentData.scheduled_at
      );

      if (!isAvailable) {
        return {
          success: false,
          message: 'Selected time slot is no longer available'
        };
      }

      // Get doctor's consultation fee
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('consultation_fee, full_name')
        .eq('id', appointmentData.doctor_id)
        .single();

      if (doctorError) throw doctorError;

      // Create consultation record
      const { data: consultation, error: consultationError } = await supabase
        .from('consultations')
        .insert({
          ...appointmentData,
          consultation_fee: doctor.consultation_fee,
          status: 'scheduled',
          payment_status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (consultationError) throw consultationError;

      // Get patient email for payment
      const { data: patient } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', appointmentData.patient_id)
        .single();

      // Initialize payment if consultation fee > 0
      if (doctor.consultation_fee > 0 && patient) {
        const paymentResult = await this.paymentService.initializePayment({
          amount: doctor.consultation_fee,
          email: patient.email,
          reference: `consultation_${consultation.id}`,
          consultation_id: consultation.id,
          doctor_id: appointmentData.doctor_id,
          patient_id: appointmentData.patient_id,
        });

        if (paymentResult.success) {
          return {
            success: true,
            consultation_id: consultation.id,
            payment_required: true,
            payment_reference: paymentResult.reference,
            message: 'Appointment booked. Please complete payment to confirm.'
          };
        } else {
          // Delete consultation if payment initialization failed
          await supabase.from('consultations').delete().eq('id', consultation.id);
          return {
            success: false,
            message: 'Failed to initialize payment. Please try again.'
          };
        }
      }

      return {
        success: true,
        consultation_id: consultation.id,
        payment_required: false,
        message: 'Appointment booked successfully!'
      };

    } catch (error) {
      console.error('Error booking appointment:', error);
      return {
        success: false,
        message: 'Failed to book appointment. Please try again.'
      };
    }
  }

  async cancelAppointment(consultationId: string, userId: string): Promise<{
    success: boolean;
    refund_initiated?: boolean;
    message: string;
  }> {
    try {
      // Get consultation details
      const { data: consultation, error } = await supabase
        .from('consultations')
        .select('*, payments(*)')
        .eq('id', consultationId)
        .eq('patient_id', userId)
        .single();

      if (error) throw error;

      if (!consultation) {
        return {
          success: false,
          message: 'Appointment not found'
        };
      }

      // Check if appointment can be cancelled (at least 2 hours before)
      const appointmentTime = new Date(consultation.scheduled_at);
      const now = new Date();
      const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilAppointment < 2) {
        return {
          success: false,
          message: 'Cannot cancel appointment less than 2 hours before scheduled time'
        };
      }

      // Update consultation status
      await supabase
        .from('consultations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', consultationId);

      // Handle refund if payment was made
      let refundInitiated = false;
      if (consultation.payment_status === 'paid') {
        // In a real implementation, you would initiate refund through Paystack API
        await supabase
          .from('payments')
          .update({
            status: 'refund_pending',
            updated_at: new Date().toISOString()
          })
          .eq('consultation_id', consultationId);
        
        refundInitiated = true;
      }

      return {
        success: true,
        refund_initiated,
        message: refundInitiated 
          ? 'Appointment cancelled. Refund will be processed within 3-5 business days.'
          : 'Appointment cancelled successfully.'
      };

    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return {
        success: false,
        message: 'Failed to cancel appointment. Please try again.'
      };
    }
  }

  async getUserAppointments(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select(`
          *,
          doctor:doctors(
            full_name,
            specialization,
            profile_image
          )
        `)
        .eq('patient_id', userId)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  }

  private async isSlotAvailable(doctorId: string, scheduledAt: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('scheduled_at', scheduledAt)
        .in('status', ['scheduled', 'in_progress']);

      if (error) throw error;
      return !data || data.length === 0;
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return false;
    }
  }

  async rescheduleAppointment(
    consultationId: string,
    newScheduledAt: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if new slot is available
      const { data: consultation } = await supabase
        .from('consultations')
        .select('doctor_id')
        .eq('id', consultationId)
        .eq('patient_id', userId)
        .single();

      if (!consultation) {
        return { success: false, message: 'Appointment not found' };
      }

      const isAvailable = await this.isSlotAvailable(consultation.doctor_id, newScheduledAt);
      if (!isAvailable) {
        return { success: false, message: 'New time slot is not available' };
      }

      // Update appointment
      const { error } = await supabase
        .from('consultations')
        .update({
          scheduled_at: newScheduledAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultationId);

      if (error) throw error;

      return { success: true, message: 'Appointment rescheduled successfully' };
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      return { success: false, message: 'Failed to reschedule appointment' };
    }
  }
}