import { supabase } from '../lib/supabase';

export interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  is_read?: boolean;
}

export async function sendNotifications(notifications: NotificationInput[]): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-notification', {
    body: { notifications },
  });
  if (error || !data?.verified) {
    throw new Error(data?.message || error?.message || 'Could not send notification');
  }
}
