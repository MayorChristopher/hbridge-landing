import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

export const locationService = {
  async requestPermissions() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentLocation() {
    const hasPermission = await this.requestPermissions();
    
    if (!hasPermission) {
      throw new Error('Location permission denied');
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });
      return location;
    } catch (error) {
      // Fallback to lower accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        timeout: 5000,
      });
      return location;
    }
  },

  async getAddressFromCoordinates(latitude: number, longitude: number) {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      return addresses[0];
    } catch (error) {
      console.error('Error getting address:', error);
      return null;
    }
  },

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
  },

  deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  },

  async shareEmergencyLocation() {
    try {
      const location = await this.getCurrentLocation();
      const address = await this.getAddressFromCoordinates(
        location.coords.latitude,
        location.coords.longitude
      );
      
      // Haptic feedback for emergency action
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      const locationText = address 
        ? `${address.street}, ${address.city}, ${address.region}`
        : `${location.coords.latitude}, ${location.coords.longitude}`;
        
      return {
        coordinates: location.coords,
        address: locationText,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sharing emergency location:', error);
      throw error;
    }
  }
};