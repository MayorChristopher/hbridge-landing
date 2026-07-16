import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius, components } from '../utils/design';
import { Toast } from '../utils/toast';
import { drName } from '../utils/formatters';

export default function ShareRecordsScreen({ navigation }: any) {
  const [records, setRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [providerType, setProviderType] = useState<'doctor' | 'hospital'>('doctor');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecords();
    loadProviders();
  }, [providerType]);

  const loadRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('medical_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const loadProviders = async () => {
    try {
      if (providerType === 'doctor') {
        const { data } = await supabase
          .from('doctors')
          .select('*')
          .eq('verification_status', 'verified')
          .ilike('full_name', `%${searchQuery}%`)
          .limit(20);
        setDoctors(data || []);
      } else {
        const { data } = await supabase
          .from('hospitals')
          .select('*')
          .eq('is_active', true)
          .ilike('name', `%${searchQuery}%`)
          .limit(20);
        setHospitals(data || []);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const grantAccess = async () => {
    if (!selectedProvider || selectedRecords.length === 0) {
      Toast.showError('Please select records and a provider');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const accessGrants = selectedRecords.map(recordId => ({
        record_id: recordId,
        patient_id: user.id,
        doctor_id: providerType === 'doctor' ? selectedProvider.id : null,
        hospital_id: providerType === 'hospital' ? selectedProvider.id : null,
        access_type: 'view',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        notes: `Access granted to ${selectedProvider.full_name || selectedProvider.name}`
      }));

      const { error } = await supabase
        .from('medical_record_access')
        .insert(accessGrants);

      if (error) throw error;

      Toast.showSuccess(
        'Records Shared Successfully',
        `${selectedRecords.length} record(s) have been shared with ${selectedProvider.full_name || selectedProvider.name}. They now have 30-day view access.`
      );
      
      navigation.goBack();
    } catch (error) {
      Toast.showError('Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
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
      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            You are sharing your medical records with healthcare providers. They will have view access for 30 days.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Select Your Records to Share</Text>
        {records.map((record: any) => (
          <TouchableOpacity
            key={record.id}
            style={[styles.recordItem, selectedRecords.includes(record.id) && styles.recordSelected]}
            onPress={() => toggleRecordSelection(record.id)}
          >
            <View style={styles.recordIcon}>
              <Ionicons name="document" size={20} color={colors.primary} />
            </View>
            <View style={styles.recordInfo}>
              <Text style={styles.recordTitle}>{record.title}</Text>
              <Text style={styles.recordType}>{record.record_type.replace('_', ' ')}</Text>
            </View>
            {selectedRecords.includes(record.id) && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.providerSection}>
          <Text style={styles.sectionTitle}>Choose Healthcare Provider</Text>
          <Text style={styles.sectionSubtitle}>Select who will receive access to your records</Text>
          
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, providerType === 'doctor' && styles.tabActive]}
              onPress={() => setProviderType('doctor')}
            >
              <Text style={[styles.tabText, providerType === 'doctor' && styles.tabTextActive]}>
                Doctors
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, providerType === 'hospital' && styles.tabActive]}
              onPress={() => setProviderType('hospital')}
            >
              <Text style={[styles.tabText, providerType === 'hospital' && styles.tabTextActive]}>
                Hospitals
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${providerType}s...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={loadProviders}
          />

          {(providerType === 'doctor' ? doctors : hospitals).map((provider: any) => (
            <TouchableOpacity
              key={provider.id}
              style={[styles.providerItem, selectedProvider?.id === provider.id && styles.providerSelected]}
              onPress={() => setSelectedProvider(provider)}
            >
              <View style={styles.providerIcon}>
                <Ionicons 
                  name={providerType === 'doctor' ? 'medical' : 'business'} 
                  size={24} 
                  color={colors.primary} 
                />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {providerType === 'doctor'
                    ? drName(provider.full_name, provider.title)
                    : provider.name}
                </Text>
                <Text style={styles.providerDetail}>
                  {providerType === 'doctor' ? provider.specialization : provider.type}
                </Text>
              </View>
              {selectedProvider?.id === provider.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.shareButton, (!selectedProvider || selectedRecords.length === 0) && styles.shareButtonDisabled]}
          onPress={grantAccess}
          disabled={loading || !selectedProvider || selectedRecords.length === 0}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
          <Text style={styles.shareButtonText}>
            Share with {selectedProvider?.full_name || selectedProvider?.name} ({selectedRecords.length} records)
          </Text>
          )}
        </TouchableOpacity>
      </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  whiteCard: { flex: 1, backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  content: { flex: 1, padding: spacing.lg },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...components.card,
    marginBottom: spacing.sm,
  },
  recordSelected: { borderColor: colors.primary, borderWidth: 2 },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  recordInfo: { flex: 1 },
  recordTitle: { ...typography.label, color: colors.textPrimary },
  recordType: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  providerSection: { marginTop: spacing.xl },
  tabs: { flexDirection: 'row', marginBottom: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.label, color: colors.textSecondary },
  tabTextActive: { color: colors.textInverse },
  searchInput: { ...components.input, marginBottom: spacing.md },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...components.card,
    marginBottom: spacing.sm,
  },
  providerSelected: { borderColor: colors.primary, borderWidth: 2 },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  providerInfo: { flex: 1 },
  providerName: { ...typography.label, color: colors.textPrimary },
  providerDetail: { ...typography.caption, color: colors.textSecondary },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  shareButton: { ...components.button, backgroundColor: colors.primary },
  shareButtonDisabled: { opacity: 0.5 },
  shareButtonText: { ...typography.button, color: colors.textInverse },
});