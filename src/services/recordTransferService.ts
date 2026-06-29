import { supabase } from '../lib/supabase';

export class RecordTransferService {
  static async transferRecord(recordId: string, fromUserId: string, toUserId: string, transferType: 'doctor' | 'hospital'): Promise<{ success: boolean; message: string }> {
    try {
      // Create transfer record
      const { data, error } = await supabase
        .from('record_transfers')
        .insert({
          record_id: recordId,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          transfer_type: transferType,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: 'Failed to initiate transfer' };
      }

      // Send notification to recipient
      await supabase
        .from('notifications')
        .insert({
          user_id: toUserId,
          title: 'Medical Record Shared',
          message: 'A medical record has been shared with you',
          type: 'record_transfer',
          related_id: data.id,
          read: false,
        });

      return { success: true, message: 'Record transferred successfully' };
    } catch (error) {
      return { success: false, message: 'Transfer failed. Please try again.' };
    }
  }

  static async acceptTransfer(transferId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('record_transfers')
        .update({ status: 'accepted' })
        .eq('id', transferId);

      if (error) {
        return { success: false, message: 'Failed to accept transfer' };
      }

      return { success: true, message: 'Record accepted' };
    } catch (error) {
      return { success: false, message: 'Failed to accept transfer' };
    }
  }

  static async rejectTransfer(transferId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('record_transfers')
        .update({ status: 'rejected' })
        .eq('id', transferId);

      if (error) {
        return { success: false, message: 'Failed to reject transfer' };
      }

      return { success: true, message: 'Record rejected' };
    } catch (error) {
      return { success: false, message: 'Failed to reject transfer' };
    }
  }

  static async getPendingTransfers(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('record_transfers')
        .select('*')
        .eq('to_user_id', userId)
        .eq('status', 'pending');

      return data || [];
    } catch (error) {
      return [];
    }
  }
}
