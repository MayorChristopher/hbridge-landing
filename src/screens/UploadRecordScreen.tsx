import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, StatusBar, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { MedicalRecordsService } from '../services/medicalRecordsService';
import { colors, typography, spacing, components } from '../utils/design';
import { Toast } from '../utils/toast';

const C = {
  paper: '#F5F3EE', ink: '#0C2E30', teal: '#0B7E8A', hero: '#083236',
  gold: '#D4A843', muted: '#6B7E7F', card: '#FFFFFF', border: '#EAE5DA',
};

export default function UploadRecordScreen({ route, navigation }: any) {
  const { recordType, title } = route.params;
  const [recordTitle, setRecordTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedRecord, setUploadedRecord] = useState<{ id: string; title: string } | null>(null);
  const [showSharePrompt, setShowSharePrompt] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      Toast.showError('Failed to pick document');
    }
  };

  const handleUpload = async () => {
    if (!recordTitle.trim()) {
      Toast.showError('Please enter a title');
      return;
    }

    if (!selectedFile) {
      Toast.showError('Please upload a file (PDF or Image)');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const medicalService = MedicalRecordsService.getInstance();
      
      const recordData: any = {
        title: recordTitle,
        description: description || undefined,
      };

      if (selectedFile) {
        recordData.file_name = selectedFile.name;
        recordData.file_size = selectedFile.size;
        recordData.file_type = selectedFile.mimeType;
      }

      const result = await medicalService.createRecord({
        user_id: user.id,
        record_type: recordType,
        title: recordTitle,
        description,
        data: recordData,
        is_sensitive: true,
      });

      if (result.success && result.record_id) {
        setUploadedRecord({ id: result.record_id, title: recordTitle });
        setShowSharePrompt(true);
      } else {
        Toast.showError(result.message);
      }
    } catch (error) {
      Toast.showError('Failed to upload record');
    } finally {
      setUploading(false);
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
          <Ionicons name="cloud-upload" size={26} color="#fff" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Upload Record</Text>
          <Text style={styles.headerSub}>Add to medical records</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={recordTitle}
            onChangeText={setRecordTitle}
            placeholder="e.g., Blood Test Results"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add notes or details..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Attachment *</Text>
          <TouchableOpacity style={styles.fileButton} onPress={pickDocument}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            <Text style={styles.fileButtonText}>
              {selectedFile ? selectedFile.name : 'Choose File (PDF or Image)'}
            </Text>
          </TouchableOpacity>
          {selectedFile && (
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.removeFile}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={styles.removeFileText}>Remove file</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Your medical records are encrypted and secure. Only you and authorized healthcare providers can access them.
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]} 
          onPress={handleUpload}
          disabled={uploading}
        >
          <Text style={styles.uploadButtonText}>
            {uploading ? 'Uploading...' : 'Upload Record'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </View>

      {/* Share prompt after successful upload */}
      <Modal visible={showSharePrompt} transparent animationType="fade">
        <View style={shareStyles.overlay}>
          <View style={shareStyles.card}>
            <View style={shareStyles.iconCircle}>
              <Ionicons name="checkmark-circle" size={40} color={C.teal} />
            </View>
            <Text style={shareStyles.title}>Record Saved!</Text>
            <Text style={shareStyles.body}>
              <Text style={shareStyles.bold}>{uploadedRecord?.title}</Text> has been added to your medical records.{'\n\n'}Would you like to share it with a doctor or hospital now?
            </Text>
            <TouchableOpacity
              style={shareStyles.primaryBtn}
              onPress={() => {
                setShowSharePrompt(false);
                navigation.replace('ShareRecord', { record: { id: uploadedRecord?.id, title: uploadedRecord?.title } });
              }}
            >
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={shareStyles.primaryText}>Share with a Health Worker</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={shareStyles.secondaryBtn}
              onPress={() => { setShowSharePrompt(false); navigation.goBack(); }}
            >
              <Text style={shareStyles.secondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const shareStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,50,54,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: C.card, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(11,126,138,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Montserrat_700Bold', color: C.ink, marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, fontFamily: 'Montserrat_400Regular', color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  bold: { fontFamily: 'Montserrat_600SemiBold', color: C.ink },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.teal, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', marginBottom: 10 },
  primaryText: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
  secondaryBtn: { paddingVertical: 10 },
  secondaryText: { fontSize: 14, fontFamily: 'Montserrat_500Medium', color: C.muted },
});

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
  section: { marginBottom: spacing.xl },
  label: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    ...components.input,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...components.card,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  fileButtonText: { ...typography.body, color: colors.textSecondary },
  removeFile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  removeFileText: { ...typography.caption, color: colors.error },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  infoText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  uploadButton: {
    ...components.button,
    backgroundColor: colors.primary,
    marginBottom: spacing.xxl,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { ...typography.button, color: colors.textInverse },
});
