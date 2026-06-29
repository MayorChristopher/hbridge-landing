import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../utils/design';
import { AppTestSuite, TestResult } from '../services/appTestSuite';
import { sanitizeForLog } from '../utils/security';
import { MemoizedComponent } from '../utils/performance';

function DatabaseTestScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  useEffect(() => {
    runDatabaseTests();
  }, []);

  const runDatabaseTests = useCallback(async () => {
    setLoading(true);
    try {
      const testService = AppTestSuite.getInstance();
      const testResults = await testService.runAllTests();
      setResults(testResults);
    } catch (error) {
      console.error('App test error:', sanitizeForLog(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASSED': return '#059669';
      case 'FAILED': return '#DC2626';
      case 'WARNING': return '#D97706';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED': return 'checkmark-circle';
      case 'FAILED': return 'close-circle';
      case 'WARNING': return 'warning';
      default: return 'help-circle';
    }
  };

  const getOverallStatus = useMemo(() => {
    const failed = results.filter(r => r.status === 'FAILED').length;
    const warnings = results.filter(r => r.status === 'WARNING').length;
    const passed = results.filter(r => r.status === 'PASSED').length;

    if (failed > 0) return { status: 'CRITICAL', color: '#DC2626', message: `${failed} critical issues found` };
    if (warnings > 0) return { status: 'WARNING', color: '#D97706', message: `${warnings} warnings, ${passed} passed` };
    return { status: 'HEALTHY', color: '#059669', message: `All ${passed} tests passed` };
  }, [results]);

  const overall = getOverallStatus;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Health</Text>
        <TouchableOpacity onPress={runDatabaseTests}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {!loading && results.length > 0 && (
        <View style={[styles.overallCard, { borderLeftColor: overall.color }]}>
          <View style={styles.overallHeader}>
            <Ionicons name="pulse" size={24} color={overall.color} />
            <Text style={styles.overallTitle}>System Status</Text>
            <View style={[styles.overallBadge, { backgroundColor: overall.color }]}>
              <Text style={styles.overallBadgeText}>{overall.status}</Text>
            </View>
          </View>
          <Text style={styles.overallMessage}>{overall.message}</Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Running comprehensive system tests...</Text>
          </View>
        ) : (
          results.map((result, index) => (
            <View key={index} style={[styles.testCard, { borderLeftColor: getStatusColor(result.status) }]}>
              <View style={styles.testHeader}>
                <Ionicons 
                  name={getStatusIcon(result.status)} 
                  size={24} 
                  color={getStatusColor(result.status)} 
                />
                <Text style={styles.testName}>{result.testName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(result.status) }]}>
                  <Text style={styles.statusText}>{result.status}</Text>
                </View>
              </View>
              <Text style={styles.testMessage}>{result.message}</Text>
              {result.details && (
                <View style={styles.detailsContainer}>
                  {typeof result.details === 'object' && result.details !== null ? (
                    Object.entries(result.details).map(([key, value]) => (
                      <Text key={key} style={styles.detailText}>
                        {key}: {String(value)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.detailText}>{String(result.details)}</Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  overallCard: {
    backgroundColor: colors.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  overallTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  overallBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  overallBadgeText: {
    ...typography.caption,
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '600',
  },
  overallMessage: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: { flex: 1, padding: spacing.lg },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  testCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  testName: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '600',
  },
  testMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  detailsContainer: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  detailText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontFamily: 'monospace',
    fontSize: 11,
  },
});

export default MemoizedComponent(DatabaseTestScreen);