import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

type LocationRequestProps = {
  onLocationSelect: (location: { lat: number; lon: number; method: 'gps' | 'manual'; address?: string }) => void;
  onCancel: () => void;
};

export default function LocationRequest({ onLocationSelect, onCancel }: LocationRequestProps) {
  const [loading, setLoading] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [error, setError] = useState('');

  const handleGPSLocation = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enter manually.');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      onLocationSelect({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        method: 'gps'
      });
      setLoading(false);
    } catch (err) {
      setError('Unable to get your location. Please enter manually.');
      setLoading(false);
    }
  };

  const handleManualLocation = () => {
    if (!manualLocation.trim()) {
      setError('Please enter your location');
      return;
    }
    
    onLocationSelect({
      lat: 0,
      lon: 0,
      method: 'manual',
      address: manualLocation.trim()
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="location-on" size={24} color="#2563eb" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Share Your Location</Text>
          <Text style={styles.subtitle}>To find the nearest hospitals, I need to know where you are.</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={16} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.gpsButton, loading && styles.buttonDisabled]}
        onPress={handleGPSLocation}
        disabled={loading}
      >
        <View style={styles.buttonContent}>
          <View style={styles.buttonIcon}>
            <MaterialIcons name="my-location" size={20} color="#fff" />
          </View>
          <View style={styles.buttonText}>
            <Text style={styles.buttonTitle}>Use GPS Location</Text>
            <Text style={styles.buttonSubtitle}>Most accurate - finds closest hospitals</Text>
          </View>
        </View>
        {loading ? (
          <Text style={styles.loadingText}>...</Text>
        ) : (
          <MaterialIcons name="chevron-right" size={20} color="#fff" />
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.manualSection}>
        <TextInput
          style={styles.textInput}
          value={manualLocation}
          onChangeText={(text) => {
            setManualLocation(text);
            setError('');
          }}
          placeholder="Enter city or area (e.g., Lagos, Abuja)"
          placeholderTextColor="#9ca3af"
          onSubmitEditing={handleManualLocation}
        />
        <TouchableOpacity
          style={styles.manualButton}
          onPress={handleManualLocation}
        >
          <MaterialIcons name="edit-location" size={16} color="#6b7280" />
          <Text style={styles.manualButtonText}>Enter Location Manually</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#fca5a5',
    marginLeft: 8,
  },
  gpsButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  buttonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  buttonText: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 8,
  },
  manualSection: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  manualButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});