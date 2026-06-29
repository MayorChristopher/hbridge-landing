import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

export interface PaymentData {
  amount: number;
  email: string;
  reference: string;
  consultation_id?: string;
  doctor_id?: string;
  patient_id: string;
}

export interface PaymentResult {
  success: boolean;
  reference?: string;
  message: string;
  transaction_id?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private paystackPublicKey = Constants.expoConfig?.extra?.paystackPublicKey || process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;
  
  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  async initializePayment(paymentData: PaymentData): Promise<PaymentResult> {
    try {
      if (!this.paystackPublicKey) {
        throw new Error('Paystack configuration missing');
      }

      // Generate unique reference
      const reference = `hbridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize payment with Paystack
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.paystackPublicKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: paymentData.email,
          amount: paymentData.amount * 100, // Convert to kobo
          reference,
          callback_url: 'hbridge://payment/callback',
          metadata: {
            consultation_id: paymentData.consultation_id,
            doctor_id: paymentData.doctor_id,
            patient_id: paymentData.patient_id,
          }
        }),
      });

      const result = await response.json();

      if (result.status) {
        // Store payment record
        await this.createPaymentRecord({
          ...paymentData,
          reference,
          status: 'pending'
        });

        return {
          success: true,
          reference,
          message: 'Payment initialized successfully',
        };
      } else {
        throw new Error(result.message || 'Payment initialization failed');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  async verifyPayment(reference: string): Promise<PaymentResult> {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${this.paystackPublicKey}`,
        },
      });

      const result = await response.json();

      if (result.status && result.data.status === 'success') {
        // Update payment record
        await this.updatePaymentRecord(reference, 'completed', result.data.id);
        
        // Update consultation status if applicable
        if (result.data.metadata?.consultation_id) {
          await this.updateConsultationPayment(result.data.metadata.consultation_id);
        }

        return {
          success: true,
          reference,
          transaction_id: result.data.id,
          message: 'Payment verified successfully',
        };
      } else {
        await this.updatePaymentRecord(reference, 'failed');
        return {
          success: false,
          message: 'Payment verification failed',
        };
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        success: false,
        message: 'Payment verification failed',
      };
    }
  }

  private async createPaymentRecord(data: PaymentData & { status: string }): Promise<void> {
    try {
      await supabase.from('payments').insert({
        reference: data.reference,
        amount: data.amount,
        email: data.email,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        consultation_id: data.consultation_id,
        status: data.status,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating payment record:', error);
    }
  }

  private async updatePaymentRecord(reference: string, status: string, transactionId?: string): Promise<void> {
    try {
      await supabase
        .from('payments')
        .update({
          status,
          transaction_id: transactionId,
          updated_at: new Date().toISOString(),
        })
        .eq('reference', reference);
    } catch (error) {
      console.error('Error updating payment record:', error);
    }
  }

  private async updateConsultationPayment(consultationId: string): Promise<void> {
    try {
      await supabase
        .from('consultations')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', consultationId);
    } catch (error) {
      console.error('Error updating consultation payment:', error);
    }
  }

  async getPaymentHistory(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          consultation:consultations(*),
          doctor:doctors(full_name, specialization)
        `)
        .eq('patient_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }
  }
}