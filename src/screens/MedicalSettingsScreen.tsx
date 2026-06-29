import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, components } from '../utils/design';

export default function MedicalSettingsScreen({ navigation }: any) {
  const settingsOptions = [
    {
      icon: 'key-outline',
      title: 'Change PIN',
      subtitle: 'Update your medical records PIN',
      action: () => navigation.navigate('ChangePIN'),
      color: colors.primary
    },
    {
      icon: 'share-outline',
      title: 'Share Records',
      subtitle: 'Grant access to doctors or hospitals',
      action: () => navigation.navigate('ShareRecords'),
      color: '#059669'
    },
    {
      icon: 'download-outline',
      title: 'Export Records',
      subtitle: 'Download your medical data',
      action: () => navigation.navigate('ExportRecords'),
      color: '#DC2626'
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy Settings',
      subtitle: 'Manage data privacy preferences',
      action: () => navigation.navigate('PrivacySettings'),
      color: '#7C3AED'
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIconCircle}>
          <Ionicons name="settings" size={26} color="#fff" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Medical Settings</Text>
          <Text style={styles.headerSub}>Manage your preferences</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Security & Privacy</Text>
        
        {settingsOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.settingItem}
            onPress={option.action}
          >
            <View style={[styles.settingIcon, { backgroundColor: option.color + '15' }]}>
              <Ionicons name={option.icon as any} size={24} color={option.color} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>{option.title}</Text>
              <Text style={styles.settingSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your medical records are encrypted and secure. Only you control who has access to your health information.
          </Text>
        </View>
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
  content: { flex: 1, padding: spacing.lg },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.lg },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...components.card,
    marginBottom: spacing.md,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingInfo: { flex: 1 },
  settingTitle: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
  settingSubtitle: { ...typography.caption, color: colors.textSecondary },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  infoText: { ...typography.caption, color: colors.primary, flex: 1, lineHeight: 18 },
});