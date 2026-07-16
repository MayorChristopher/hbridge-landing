import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius, components } from '../utils/design';

export default function RecordDetailScreen({ route, navigation }: any) {
  const { record, isIncoming, isReceived } = route.params;
  const [recordData, setRecordData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecordDetails();
  }, []);

  const loadRecordDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('id', record.id)
        .single();

      if (error) throw error;
      setRecordData(data);
    } catch (error) {
      console.error('Error loading record details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#083236" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Record Details</Text>
            <Text style={styles.headerSub}>Medical document</Text>
          </View>
        </View>
        <View style={styles.whiteCard} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Teal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Record Details</Text>
          <Text style={styles.headerSub}>Medical document</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ShareRecord', { record: recordData })}>
          <Ionicons name="share-outline" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
      <ScrollView style={styles.content}>
        <View style={styles.recordCard}>
          <View style={styles.recordHeader}>
            <Text style={styles.recordTitle}>{recordData?.title}</Text>
            <View style={styles.recordType}>
              <Text style={styles.recordTypeText}>
                {recordData?.record_type?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.recordMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                Created: {formatDate(recordData?.created_at)}
              </Text>
            </View>

{recordData?.is_sensitive && (
              <View style={styles.metaItem}>
                <Ionicons name="lock-closed" size={16} color={colors.error} />
                <Text style={[styles.metaText, { color: colors.error }]}>
                  Sensitive Information
                </Text>
              </View>
            )}
          </View>

          {recordData?.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionContent}>{recordData.description}</Text>
            </View>
          )}

          {recordData?.data && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.dataContainer}>
                {Object.entries(recordData.data).map(([key, value]) => (
                  <View key={key} style={styles.dataItem}>
                    <Text style={styles.dataKey}>{key.replace('_', ' ')}:</Text>
                    <Text style={styles.dataValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
headerCenter: { flex: 1 },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  whiteCard: { flex: 1, backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  content: { flex: 1, padding: spacing.lg },
  recordCard: {
    backgroundColor: colors.surface,
    ...components.card,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  recordHeader: {
    marginBottom: spacing.lg,
  },
  recordTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  recordType: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  recordTypeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  recordMeta: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  sectionContent: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  dataContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  dataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataKey: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    flex: 1,
  },
  dataValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
});