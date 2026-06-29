import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { colors, typography, spacing, borderRadius, components } from '../utils/design';
import { Toast } from '../utils/toast';

export default function ShareRecordScreen({ route, navigation }: any) {
  const { record } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadProviders();
  }, [searchQuery]);

  const loadProviders = async () => {
    try {
      const doctorsQuery = supabase
        .from('doctors')
        .select('id, full_name, specialization, hospital_name')
        .eq('verification_status', 'verified');

      const hospitalsQuery = supabase
        .from('hospitals')
        .select('id, name, type, address');

      if (searchQuery) {
        doctorsQuery.ilike('full_name', `%${searchQuery}%`);
        hospitalsQuery.ilike('name', `%${searchQuery}%`);
      }

      const [doctorsData, hospitalsData] = await Promise.all([
        doctorsQuery.limit(10),
        hospitalsQuery.limit(10)
      ]);

      setDoctors(doctorsData.data || []);
      setHospitals(hospitalsData.data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const shareWithProvider = async (providerId: string, providerType: 'doctor' | 'hospital') => {
    setSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const medicalService = MedicalRecordsService.getInstance();
      const result = await medicalService.shareRecord(record.id, providerId, user.id, providerType);

      if (result.success) {
        Toast.showSuccess('Record shared successfully');
        navigation.goBack();
      } else {
        Toast.showError(result.message);
      }
    } catch (error) {
      Toast.showError('Failed to share record');
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIconCircle}>
          <Ionicons name="share-social" size={26} color="#fff" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Share Record</Text>
          <Text style={styles.headerSub}>Send to care team</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
      <View style={styles.recordInfo}>
        <Text style={styles.recordTitle}>{record.title}</Text>
        <Text style={styles.recordType}>{record.record_type?.replace('_', ' ')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search doctors or hospitals..."
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <ScrollView style={styles.content}>
        {doctors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Doctors</Text>
            {doctors.map((doctor: any) => (
              <TouchableOpacity
                key={doctor.id}
                style={styles.providerCard}
                onPress={() => shareWithProvider(doctor.id, 'doctor')}
                disabled={sharing}
              >
                <View style={styles.providerIcon}>
                  <MaterialCommunityIcons name="stethoscope" size={24} color={colors.primary} />
                </View>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{doctor.full_name}</Text>
                  <Text style={styles.providerDetails}>{doctor.specialization}</Text>
                  {doctor.hospital_name && (
                    <Text style={styles.providerLocation}>{doctor.hospital_name}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {hospitals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hospitals</Text>
            {hospitals.map((hospital: any) => (
              <TouchableOpacity
                key={hospital.id}
                style={styles.providerCard}
                onPress={() => shareWithProvider(hospital.id, 'hospital')}
                disabled={sharing}
              >
                <View style={styles.providerIcon}>
                  <MaterialCommunityIcons name="hospital-building" size={24} color={colors.primary} />
                </View>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{hospital.name}</Text>
                  <Text style={styles.providerDetails}>{hospital.type}</Text>
                  {hospital.address && (
                    <Text style={styles.providerLocation}>{hospital.address}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  whiteCard: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  recordInfo: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recordTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.xs },
  recordType: { ...typography.caption, color: colors.primary },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  content: { flex: 1 },
  section: { padding: spacing.lg },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...components.card,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInfo: { flex: 1 },
  providerName: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
  providerDetails: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  providerLocation: { ...typography.caption, color: colors.textTertiary },
});