import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius } from '../utils/design';

interface MedicalRecord {
  id: string;
  date: string;
  doctor: string;
  specialty: string;
  diagnosis: string;
  prescription: string;
  notes: string;
}

export default function MedicalHistoryScreen({ navigation }: any) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedicalHistory();
  }, []);

  const loadMedicalHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          id,
          scheduled_at,
          diagnosis,
          prescription,
          notes,
          doctors (
            full_name,
            specialization
          )
        `)
        .eq('patient_id', user.id)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false });

      const medicalRecords: MedicalRecord[] = (consultations || []).map(consultation => ({
        id: consultation.id,
        date: consultation.scheduled_at,
        doctor: consultation.doctors?.full_name || 'Unknown Doctor',
        specialty: consultation.doctors?.specialization || 'General',
        diagnosis: consultation.diagnosis || 'No diagnosis recorded',
        prescription: consultation.prescription || 'No prescription',
        notes: consultation.notes || 'No additional notes'
      }));

      setRecords(medicalRecords);
    } catch (error) {
      console.error('Error loading medical history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerIconCircle}>
            <Ionicons name="medical" size={26} color="#fff" />
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Medical History</Text>
            <Text style={styles.headerSub}>Your health timeline</Text>
          </View>
        </View>
        <View style={styles.whiteCard}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading medical history...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIconCircle}>
          <Ionicons name="medical" size={26} color="#fff" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Medical History</Text>
          <Text style={styles.headerSub}>Your health timeline</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
      <ScrollView style={styles.content}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Medical Records</Text>
            <Text style={styles.emptyText}>
              Your completed consultations will appear here as medical records.
            </Text>
          </View>
        ) : (
          records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordDate}>
                  {new Date(record.date).toLocaleDateString()}
                </Text>
                <View style={styles.specialtyBadge}>
                  <Text style={styles.specialtyText}>{record.specialty}</Text>
                </View>
              </View>
              
              <Text style={styles.doctorName}>Dr. {record.doctor}</Text>
              
              <View style={styles.recordSection}>
                <Text style={styles.sectionLabel}>Diagnosis</Text>
                <Text style={styles.sectionValue}>{record.diagnosis}</Text>
              </View>
              
              <View style={styles.recordSection}>
                <Text style={styles.sectionLabel}>Prescription</Text>
                <Text style={styles.sectionValue}>{record.prescription}</Text>
              </View>
              
              {record.notes && (
                <View style={styles.recordSection}>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.sectionValue}>{record.notes}</Text>
                </View>
              )}
            </View>
          ))
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
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recordDate: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  specialtyBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  specialtyText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  doctorName: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  recordSection: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionValue: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});