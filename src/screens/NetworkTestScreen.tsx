import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NetworkDiagnostic } from '../utils/networkDiagnostic';

export default function NetworkTestScreen({ navigation }: any) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [autoTest, setAutoTest] = useState(true);

  useEffect(() => {
    if (autoTest) {
      runNetworkTest();
    }
  }, []);

  const runNetworkTest = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      const testResults = await NetworkDiagnostic.testConnection();
      setResults(testResults);
    } catch (error: any) {
      setResults({
        success: false,
        error: error.message,
        details: {
          supabaseUrl: 'https://vapoyosssxnprxznnfgb.supabase.co',
          canReachSupabase: false,
          authWorking: false,
          timestamp: new Date().toISOString(),
        }
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? 'checkmark-circle' : 'close-circle';
  };

  const getStatusColor = (status: boolean) => {
    return status ? '#0B7E8A' : '#EF4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#171717" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Network Diagnostics</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Test</Text>
          <Text style={styles.sectionSubtitle}>
            Testing connectivity to Hbridge servers
          </Text>

          <TouchableOpacity
            style={[styles.testButton, testing && styles.testButtonDisabled]}
            onPress={runNetworkTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="refresh" size={20} color="#ffffff" />
            )}
            <Text style={styles.testButtonText}>
              {testing ? 'Testing...' : 'Run Test'}
            </Text>
          </TouchableOpacity>
        </View>

        {results && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Ionicons 
                  name={getStatusIcon(results.success)} 
                  size={24} 
                  color={getStatusColor(results.success)} 
                />
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle}>Overall Status</Text>
                  <Text style={[styles.resultStatus, { color: getStatusColor(results.success) }]}>
                    {results.success ? 'Connected' : 'Connection Failed'}
                  </Text>
                </View>
              </View>

              <View style={styles.resultRow}>
                <Ionicons 
                  name={getStatusIcon(results.details.canReachSupabase)} 
                  size={24} 
                  color={getStatusColor(results.details.canReachSupabase)} 
                />
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle}>Supabase Reachable</Text>
                  <Text style={[styles.resultStatus, { color: getStatusColor(results.details.canReachSupabase) }]}>
                    {results.details.canReachSupabase ? 'Yes' : 'No'}
                  </Text>
                </View>
              </View>

              <View style={styles.resultRow}>
                <Ionicons 
                  name={getStatusIcon(results.details.authWorking)} 
                  size={24} 
                  color={getStatusColor(results.details.authWorking)} 
                />
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle}>Authentication</Text>
                  <Text style={[styles.resultStatus, { color: getStatusColor(results.details.authWorking) }]}>
                    {results.details.authWorking ? 'Working' : 'Failed'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsSection}>
                <Text style={styles.detailsTitle}>Details</Text>
                <Text style={styles.detailsText}>URL: {results.details.supabaseUrl}</Text>
                <Text style={styles.detailsText}>Time: {new Date(results.details.timestamp).toLocaleString()}</Text>
                {results.error && (
                  <Text style={styles.errorText}>Error: {results.error}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting Tips</Text>
          
          <View style={styles.tipCard}>
            <Ionicons name="wifi" size={20} color="#737373" />
            <Text style={styles.tipText}>
              Check your internet connection and try again
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="refresh" size={20} color="#737373" />
            <Text style={styles.tipText}>
              Close and restart the app if issues persist
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="time" size={20} color="#737373" />
            <Text style={styles.tipText}>
              Wait a few minutes and try again - servers may be temporarily busy
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="cellular" size={20} color="#737373" />
            <Text style={styles.tipText}>
              Try switching between WiFi and mobile data
            </Text>
          </View>
        </View>

        {!results?.success && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.continueButtonText}>Continue Anyway</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#737373',
    marginBottom: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  testButtonDisabled: {
    backgroundColor: '#a3a3a3',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  resultCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 2,
  },
  resultStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 12,
    color: '#737373',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#171717',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#0B7E8A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});