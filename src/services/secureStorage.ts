import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error storing secure item:', error);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting secure item:', error);
      return null;
    }
  },

  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing secure item:', error);
    }
  },

  // Medical data specific methods
  async saveMedicalRecord(userId: string, record: any) {
    const key = `medical_${userId}_${record.id}`;
    await this.setItem(key, JSON.stringify(record));
  },

  async getMedicalRecord(userId: string, recordId: string) {
    const key = `medical_${userId}_${recordId}`;
    const data = await this.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  async saveEmergencyContacts(userId: string, contacts: any[]) {
    const key = `emergency_contacts_${userId}`;
    await this.setItem(key, JSON.stringify(contacts));
  },

  async getEmergencyContacts(userId: string) {
    const key = `emergency_contacts_${userId}`;
    const data = await this.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  async saveOfflineMessages(userId: string, messages: any[]) {
    const key = `offline_messages_${userId}`;
    await this.setItem(key, JSON.stringify(messages));
  },

  async getOfflineMessages(userId: string) {
    const key = `offline_messages_${userId}`;
    const data = await this.getItem(key);
    return data ? JSON.parse(data) : [];
  }
};