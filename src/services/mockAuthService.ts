import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock authentication service for demo purposes
export const mockAuthService = {
  async signIn(email: string, password: string) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock successful login
    const mockUser = {
      id: 'mock-user-id',
      email: email,
      user_metadata: {
        full_name: 'Demo User',
        role: 'patient'
      }
    };
    
    await AsyncStorage.setItem('mock_session', JSON.stringify(mockUser));
    return { user: mockUser, error: null };
  },

  async signUp(email: string, password: string, metadata: any) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock successful signup
    const mockUser = {
      id: 'mock-user-id-' + Date.now(),
      email: email,
      user_metadata: metadata
    };
    
    await AsyncStorage.setItem('mock_user_' + email, JSON.stringify(mockUser));
    return { user: mockUser, error: null };
  },

  async getSession() {
    const session = await AsyncStorage.getItem('mock_session');
    return session ? { data: { session: JSON.parse(session) } } : { data: { session: null } };
  },

  async signOut() {
    await AsyncStorage.removeItem('mock_session');
    return { error: null };
  },

  // Mock auth state change listener
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Return a mock subscription
    return {
      data: {
        subscription: {
          unsubscribe: () => console.log('Mock auth listener unsubscribed')
        }
      }
    };
  }
};