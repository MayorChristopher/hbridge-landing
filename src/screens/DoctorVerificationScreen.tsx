import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = {
  paper: '#F5F3EE', ink: '#0C2E30', teal: '#0B7E8A', hero: '#083236',
  gold: '#D4A843', muted: '#6B7E7F', card: '#FFFFFF', border: '#EAE5DA',
  green: '#1E9E5A', greenBg: '#E7F6EE', amber: '#B5750B', amberBg: '#FCF1DD',
  red: '#EF4444', redBg: '#FEE2E2',
};

export default function DoctorVerificationScreen({ navigation }: any) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadDoctor(); }, []);

  const loadDoctor = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('doctors')
      .select('id, verification_status, verification_documents, verification_notes')
      .eq('user_id', user.id)
      .maybeSingle();
    setDoctor(data);
    setLoading(false);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled === false && result.assets && result.assets[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch {
      toast.showError('Error', 'Failed to pick document');
    }
  };

  const submitDocument = async () => {
    if (!selectedFile) { toast.showWarning('Required', 'Please choose a document first'); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = (selectedFile.name?.split('.').pop() || 'pdf').toLowerCase();
      const mime = selectedFile.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
      const storagePath = `licenses/${user.id}/${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', { uri: selectedFile.uri, name: selectedFile.name || `file.${ext}`, type: mime } as any);

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const supabaseUrl = (supabase as any).supabaseUrl as string;

      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/attachments/${storagePath}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error(await uploadRes.text());

      const existingDocs: string[] = doctor?.verification_documents || [];
      const { error } = await supabase
        .from('doctors')
        .update({ verification_documents: [...existingDocs, storagePath] })
        .eq('user_id', user.id);
      if (error) throw error;

      setSelectedFile(null);
      toast.showSuccess('Submitted', 'Your document has been submitted for review.');
      loadDoctor();
    } catch (e: any) {
      toast.showError('Upload Failed', e.message || 'Could not submit document');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={C.hero} />
        <ActivityIndicator style={{ marginTop: 100 }} color={C.teal} size="large" />
      </SafeAreaView>
    );
  }

  const status: 'pending' | 'verified' | 'rejected' = doctor?.verification_status || 'pending';
  const hasSubmitted = (doctor?.verification_documents?.length || 0) > 0;

  const statusCard = {
    verified: { bg: C.greenBg, color: C.green, icon: 'checkmark-circle', title: 'Verified', body: 'Your medical license has been verified. Patients can find and book you.' },
    pending: {
      bg: C.amberBg, color: C.amber, icon: 'time-outline',
      title: hasSubmitted ? 'Under Review' : 'Verification Required',
      body: hasSubmitted
        ? 'Your document has been submitted and is awaiting review. This can take a few days. You will not appear in patient search until approved.'
        : 'Upload your medical license or practicing certificate below. Your account will not appear in patient search until it has been reviewed and approved.',
    },
    rejected: {
      bg: C.redBg, color: C.red, icon: 'close-circle',
      title: 'Not Approved',
      body: doctor?.verification_notes || 'Your submission was not approved. Please upload a clearer or valid document.',
    },
  }[status];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.hero} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Verification</Text>
          <Text style={styles.headerSubtitle}>Confirm your medical credentials</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20 }}>
        <View style={[styles.statusCard, { backgroundColor: statusCard.bg }]}>
          <Ionicons name={statusCard.icon as any} size={28} color={statusCard.color} />
          <Text style={[styles.statusTitle, { color: statusCard.color }]}>{statusCard.title}</Text>
          <Text style={styles.statusBody}>{statusCard.body}</Text>
        </View>

        {status !== 'verified' && (
          <View style={styles.uploadSection}>
            <Text style={styles.sectionLabel}>
              {hasSubmitted ? 'Upload another document' : 'Upload document'}
            </Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={pickDocument}>
              <Ionicons name="document-attach-outline" size={20} color={C.teal} />
              <Text style={styles.pickerBtnText} numberOfLines={1}>
                {selectedFile ? selectedFile.name : 'Choose PDF or image'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedFile || uploading) && styles.submitBtnDisabled]}
              onPress={submitDocument}
              disabled={!selectedFile || uploading}
            >
              {uploading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Submit for Review</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  header: {
    backgroundColor: C.hero, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitles: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Montserrat_600SemiBold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' },
  content: { flex: 1 },
  statusCard: { borderRadius: 16, padding: 20, alignItems: 'flex-start', gap: 8 },
  statusTitle: { fontSize: 17, fontFamily: 'Montserrat_700Bold' },
  statusBody: { fontSize: 14, color: C.ink, fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 20 },
  uploadSection: { marginTop: 20, gap: 12 },
  sectionLabel: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14,
  },
  pickerBtnText: { flex: 1, fontSize: 14, color: C.ink, fontFamily: 'SpaceGrotesk_400Regular' },
  submitBtn: {
    backgroundColor: C.teal, borderRadius: 12, padding: 15, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Montserrat_600SemiBold' },
});
