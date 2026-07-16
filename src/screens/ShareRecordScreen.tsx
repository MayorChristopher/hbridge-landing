import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius, components } from '../utils/design';
import { useToast } from '../components/ToastProvider';

const C = {
  ink: '#083236', teal: '#0B7E8A', bg: '#F5F3EE',
  card: '#FFFFFF', border: '#EAE5DA', muted: '#7A8785', text: '#16211F',
};

export default function ShareRecordScreen({ route, navigation }: any) {
  const { record } = route.params;
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors]         = useState<any[]>([]);
  const [hospitals, setHospitals]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [sharing, setSharing]         = useState(false);

  useEffect(() => {
    loadProviders(searchQuery);
  }, [searchQuery]);

  const loadProviders = async (query: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let doctorsQ = supabase
        .from('doctors')
        .select('id, full_name, specialization, profile_image');

      if (user) doctorsQ = doctorsQ.neq('user_id', user.id);

      let hospitalsQ = supabase
        .from('hospitals')
        .select('id, name, type, address');

      if (query.trim()) {
        doctorsQ   = doctorsQ.ilike('full_name', `%${query.trim()}%`);
        hospitalsQ = hospitalsQ.ilike('name', `%${query.trim()}%`);
      }

      const [doctorsRes, hospitalsRes] = await Promise.all([
        doctorsQ.limit(15),
        hospitalsQ.limit(15),
      ]);

setDoctors(doctorsRes.data || []);
      setHospitals(hospitalsRes.data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareWithProvider = async (providerId: string, providerType: 'doctor' | 'hospital') => {
    setSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if already shared with this provider
      const existingQ = supabase
        .from('medical_record_access')
        .select('id')
        .eq('record_id', record.id)
        .eq('is_active', true);
      if (providerType === 'doctor') existingQ.eq('doctor_id', providerId);
      else existingQ.eq('hospital_id', providerId);
      const { data: existing } = await existingQ.maybeSingle();
      if (existing) {
        toast.showWarning('Already shared', 'This record is already shared with that provider.');
        return;
      }

      const { error } = await supabase.from('medical_record_access').insert({
        record_id:   record.id,
        patient_id:  user.id,
        doctor_id:   providerType === 'doctor' ? providerId : null,
        hospital_id: providerType === 'hospital' ? providerId : null,
        access_type: 'view',
        granted_at:  new Date().toISOString(),
        expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active:   true,
      });

      if (error) throw error;

      toast.showSuccess('Shared', 'Record shared successfully.');
      navigation.goBack();
    } catch (e: any) {
      toast.showError('Failed', e.message || 'Could not share record.');
    } finally {
      setSharing(false);
    }
  };

  const hasResults = doctors.length > 0 || hospitals.length > 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.ink} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Share Record</Text>
          <Text style={s.headerSub}>Send to care team</Text>
        </View>
      </View>

      <View style={s.whiteCard}>
        {/* Record info strip */}
        <View style={s.recordInfo}>
          <Text style={s.recordTitle} numberOfLines={1}>{record.title}</Text>
          <Text style={s.recordType}>{record.record_type?.replace(/_/g, ' ')}</Text>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={C.muted} />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search practitioners or hospitals..."
            placeholderTextColor={C.muted}
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
        ) : !hasResults ? (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={40} color={C.muted} />
            <Text style={s.emptyText}>
              {searchQuery.trim()
                ? `No results for "${searchQuery}"`
                : 'No verified practitioners found'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {doctors.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={s.sectionLabel}>Practitioners</Text>
                {doctors.map((doc: any) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={s.providerCard}
                    onPress={() => shareWithProvider(doc.id, 'doctor')}
                    disabled={sharing}
                  >
                    {doc.profile_image
                      ? <Image source={{ uri: doc.profile_image }} style={s.avatar} />
                      : <View style={s.avatarFallback}>
                          <Text style={s.avatarInitials}>
                            {(doc.full_name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                          </Text>
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={s.providerName}>{doc.full_name}</Text>
                      <Text style={s.providerSub}>{doc.specialization}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {hospitals.length > 0 && (
              <View>
                <Text style={s.sectionLabel}>Hospitals</Text>
                {hospitals.map((h: any) => (
                  <TouchableOpacity
                    key={h.id}
                    style={s.providerCard}
                    onPress={() => shareWithProvider(h.id, 'hospital')}
                    disabled={sharing}
                  >
                    <View style={s.providerIcon}>
                      <MaterialCommunityIcons name="hospital-building" size={22} color={C.teal} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.providerName}>{h.name}</Text>
                      <Text style={s.providerSub}>{h.type}</Text>
                      {h.address && <Text style={s.providerMeta}>{h.address}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.ink },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  whiteCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  recordInfo: { backgroundColor: C.card, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  recordTitle: { fontSize: 15, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 2 },
  recordType:  { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal, textTransform: 'capitalize' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, paddingVertical: 0 },

  sectionLabel: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  providerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8, gap: 12 },
  providerIcon:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(11,126,138,0.09)', alignItems: 'center', justifyContent: 'center' },
  avatar:           { width: 44, height: 44, borderRadius: 22 },
  avatarFallback:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  avatarInitials:   { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#fff' },
  providerName: { fontSize: 14, fontFamily: 'Montserrat_600SemiBold', color: C.text },
  providerSub:  { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },
  providerMeta: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 1 },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center', maxWidth: 240 },
});
