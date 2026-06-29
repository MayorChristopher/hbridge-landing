import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { sanitizeForLog } from '../utils/security';

export interface NotificationData {
  user_id: string;
  title: string;
  message: string;
  type: 'appointment' | 'emergency' | 'payment' | 'system' | 'reminder';
  data?: any;
}

export class NotificationService {
  private static instance: NotificationService;
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions not granted');
      return;
    }

    // Get push token
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await this.savePushToken(token);
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  }

  private async savePushToken(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: user.id,
          push_token: token,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  async createNotification(notificationData: NotificationData): Promise<{
    success: boolean;
    notification_id?: string;
    message: string;
  }> {
    try {
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          ...notificationData,
          is_read: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Send push notification
      await this.sendPushNotification(notificationData.user_id, {
        title: notificationData.title,
        body: notificationData.message,
        data: notificationData.data
      });

      return {
        success: true,
        notification_id: notification.id,
        message: 'Notification created successfully'
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      return {
        success: false,
        message: 'Failed to create notification'
      };
    }
  }

  private async sendPushNotification(userId: string, notification: {
    title: string;
    body: string;
    data?: any;
  }): Promise<void> {
    try {
      // Get user's push token
      const { data: tokenData } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', userId)
        .single();

      if (!tokenData?.push_token) return;

      // Send via Expo push service
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: tokenData.push_token,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: 'default',
          priority: 'high'
        }),
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  async getUserNotifications(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      return !error;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Scheduled notifications for appointments
  async scheduleAppointmentReminder(
    consultationId: string,
    patientId: string,
    doctorName: string,
    appointmentTime: string
  ): Promise<void> {
    try {
      const appointmentDate = new Date(appointmentTime);
      const reminderTime = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before

      if (reminderTime > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Appointment Reminder',
            body: `You have an appointment with Dr. ${doctorName} tomorrow at ${appointmentDate.toLocaleTimeString()}`,
            data: { consultation_id: consultationId, type: 'appointment_reminder' },
          },
          trigger: { date: reminderTime },
        });

        // Also create database notification
        await this.createNotification({
          user_id: patientId,
          title: 'Appointment Reminder',
          message: `You have an appointment with Dr. ${doctorName} tomorrow`,
          type: 'reminder',
          data: { consultation_id: consultationId }
        });
      }
    } catch (error) {
      const sanitizedError = sanitizeForLog(error);
      console.error('Error scheduling appointment reminder:', sanitizedError);
    }
  }

  // Emergency notifications
  async sendEmergencyAlert(
    patientId: string,
    location: { latitude: number; longitude: number; address: string },
    symptoms: string
  ): Promise<void> {
    try {
      // Get emergency contacts
      const { data: patient } = await supabase
        .from('profiles')
        .select('emergency_contact_name, emergency_contact_phone, full_name')
        .eq('id', patientId)
        .single();

      if (patient?.emergency_contact_phone) {
        // Send SMS to emergency contact (would need SMS service integration)
        console.log(`Emergency alert would be sent to ${patient.emergency_contact_phone}`);
      }

      // Create emergency notification
      await this.createNotification({
        user_id: patientId,
        title: 'Emergency Alert Sent',
        message: 'Emergency services have been notified of your situation',
        type: 'emergency',
        data: { location, symptoms }
      });
    } catch (error) {
      console.error('Error sending emergency alert:', error);
    }
  }

  // Payment notifications
  async sendPaymentNotification(
    userId: string,
    amount: number,
    status: 'success' | 'failed',
    reference: string
  ): Promise<void> {
    const title = status === 'success' ? 'Payment Successful' : 'Payment Failed';
    const message = status === 'success' 
      ? `Your payment of ₦${amount.toLocaleString()} was successful`
      : `Your payment of ₦${amount.toLocaleString()} failed. Please try again.`;

    await this.createNotification({
      user_id: userId,
      title,
      message,
      type: 'payment',
      data: { amount, status, reference }
    });
  }
}