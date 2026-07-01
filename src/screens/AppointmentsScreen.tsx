import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Alert, RefreshControl, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import RatingModal from '../components/RatingModal';

const C = { bg: '#FFFFFF', surface: '#F5F7FA', text: '#0A0A0A', muted: '#555F6D', border: '#E2E8EF', teal: '#0B7E8A', tealLight: '#E6F5F5' };

interface Consultation {
  id: string; scheduled_at: string; status: 'scheduled' | 'completed' | 'cancelled' | 'in_progress';
  consultation_type: string; consultation_fee: number; symptoms?: string; diagnosis?: string;
  doctor: { id: string; full_name: string; specialization: string; profile_image?: string; };
}

function formatDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }

function StatusBadge({ status }: { status: string }) {
  const isCancelled = status === 'cancelled';
  return (
    <View style={[s.badge, isCancelled ? s.badgeCancelled : s.badgeGrey]}>
      <Text style={isCancelled ? s.badgeTextCancelled : s.badgeText}>
        {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </Text>
    </View>
  );
}

function SpecIcon({ spec }: { spec: string }) {
  const sl = spec?.toLowerCase() || '';
  let icon: any = 'medical-outline';
  if (sl.includes('cardio') || sl.includes('heart')) icon = 'heart-outline';
  else if (sl.includes('neuro')) icon = 'pulse-outline';
  else if (sl.includes('ortho')) icon = 'body-outline';
  return <Ionicons name={icon} size={20} color={C.muted} />;
}

export default function AppointmentsScreen({ navigation }: any) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeFilter, setActiveFilter]   = useState<'All' | 'In-Person' | 'Video Call'>('All');
  const [search, setSearch]               = useState('');
  const [ratingModal, setRatingModal]     = useState<{ visible: boolean; doctorId: string; doctorName: string; consultationId: string } | null>(null);

  useEffect(() => { loadConsultations(); }, []);

  const loadConsultations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('consultations')
        .select('id,scheduled_at,status,consultation_type,consultation_fee,symptoms,diagnosis,doctors(id,full_name,specialization,profile_image)')
        .eq('patient_id', user.id).order('scheduled_at', { ascending: false });
      if (error) throw error;
      setConsultations((data || []).map((c: any) => ({
        id: c.id, scheduled_at: c.scheduled_at, status: c.status,
        consultation_type: c.consultation_type, consultation_fee: c.consultation_fee || 0,
        symptoms: c.symptoms, diagnosis: c.diagnosis,
        doctor: { id: c.doctors?.id, full_name: c.doctors?.full_name || 'Unknown Doctor', specialization: c.doctors?.specialization || 'General', profile_image: c.doctors?.profile_image },
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadConsultations(); setRefreshing(false); };

  const handleBookAgain = async (c: Consultation) => {
    const { data } = await supabase.from('doctors').select('*').eq('id', c.doctor.id).single();
    if (data) navigation.navigate('BookConsultation', { doctor: data });
  };

  const handleReschedule = async (c: Consultation) => {
    const { data } = await supabase.from('consultations').select('*,doctors(*)').eq('id', c.id).single();
    if (data?.doctors) navigation.navigate('BookConsultation', { doctor: data.doctors, reschedule: true, consultationId: c.id, existingData: { type: data.consultation_type, symptoms: data.symptoms } });
  };

  const handleViewReport = (c: Consultation) => {
    Alert.alert(
      `Dr. ${c.doctor.full_name}`,
      `Date: ${formatDate(c.scheduled_at)}\nType: ${c.consultation_type}\n\n${c.diagnosis ? `Diagnosis: ${c.diagnosis}` : c.symptoms ? `Symptoms: ${c.symptoms}` : 'No notes available.'}`,
      [
        { text: 'Close' },
        ...(c.status === 'completed' ? [{ text: 'Rate Doctor', onPress: () => setRatingModal({ visible: true, doctorId: c.doctor.id, doctorName: c.doctor.full_name, consultationId: c.id }) }] : []),
      ]
    );
  };

  const filtered = consultations.filter(c => {
    const matchesFilter = activeFilter === 'All'
      || (activeFilter === 'Video Call' && (c.consultation_type === 'video' || c.consultation_type === 'audio'))
      || (activeFilter === 'In-Person' && c.consultation_type === 'in_person');
    const matchesSearch = !search.trim()
      || c.doctor.full_name.toLowerCase().includes(search.toLowerCase())
      || c.doctor.specialization.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerIconWrap}>
          <Ionicons name="calendar" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Consultations</Text>
          <Text style={s.headerSubtitle}>Your health history</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 16 }}>
            {/* Search */}
            <View style={s.searchBar}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput style={s.searchInput} placeholder="Search consultations..." placeholderTextColor={C.muted} value={search} onChangeText={setSearch} />
            </View>

            {/* Chips */}
            <View style={s.chips}>
              {(['All', 'In-Person', 'Video Call'] as const).map(f => (
                <TouchableOpacity key={f} style={[s.chip, activeFilter === f && s.chipActive]} onPress={() => setActiveFilter(f)}>
                  <Text style={[s.chipText, activeFilter === f && s.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* List */}
            {loading ? (
              <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
            ) : filtered.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconWrap}><Ionicons name="calendar-outline" size={36} color={C.teal} /></View>
                <Text style={s.emptyTitle}>No consultations found</Text>
                <Text style={s.emptyText}>Book a consultation with a doctor to get started</Text>
                <TouchableOpacity style={s.bookBtn} onPress={() => navigation.navigate('Explore')}>
                  <Text style={s.bookBtnText}>Find a Doctor</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {filtered.map(c => {
                  const isVirtual   = c.consultation_type === 'video' || c.consultation_type === 'audio';
                  const isCancelled = c.status === 'cancelled';
                  const isCompleted = c.status === 'completed';
                  return (
                    <View key={c.id} style={s.consCard}>
                      <View style={s.cardHeader}>
                        <View style={s.avatarWrap}>
                          {c.doctor.profile_image
                            ? <Image source={{ uri: c.doctor.profile_image }} style={s.avatarImg} />
                            : <SpecIcon spec={c.doctor.specialization} />}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={s.doctorName}>Dr. {c.doctor.full_name}</Text>
                            <StatusBadge status={c.status} />
                          </View>
                          <Text style={s.specialty}>{c.doctor.specialization}</Text>
                        </View>
                      </View>
                      <View style={s.divider} />
                      <View style={s.metaRow}>
                        <View style={s.metaItem}><Ionicons name="calendar-outline" size={13} color={C.muted} /><Text style={s.metaText}>{formatDate(c.scheduled_at)}</Text></View>
                        <View style={s.metaItem}><Ionicons name="time-outline" size={13} color={C.muted} /><Text style={s.metaText}>{formatTime(c.scheduled_at)}</Text></View>
                        <View style={s.metaItem}>
                          {isVirtual ? <Ionicons name="videocam-outline" size={13} color={C.muted} /> : <Ionicons name="location-outline" size={13} color={C.muted} />}
                          <Text style={s.metaText}>{isVirtual ? 'Video Call' : 'In-Person'}</Text>
                        </View>
                      </View>
                      {(c.diagnosis || c.symptoms) && <Text style={s.notes} numberOfLines={2}>{c.diagnosis ? `Diagnosis: ${c.diagnosis}` : `Symptoms: ${c.symptoms}`}</Text>}
                      {isCancelled && <Text style={s.notes}>Appointment was cancelled.</Text>}
                      <View style={s.actions}>
                        {isCancelled ? (
                          <TouchableOpacity style={[s.btnDark, { flex: 1 }]} onPress={() => handleReschedule(c)}>
                            <Ionicons name="calendar-outline" size={14} color="#fff" /><Text style={s.btnDarkText}>Reschedule</Text>
                          </TouchableOpacity>
                        ) : isCompleted ? (
                          <>
                            <TouchableOpacity style={s.btnOutline} onPress={() => handleViewReport(c)}><Ionicons name="document-text-outline" size={14} color={C.teal} /><Text style={s.btnOutlineText}>View Report</Text></TouchableOpacity>
                            <TouchableOpacity style={s.btnDark} onPress={() => handleBookAgain(c)}><Ionicons name="refresh-outline" size={14} color="#fff" /><Text style={s.btnDarkText}>Book Again</Text></TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={s.btnOutline} onPress={() => handleViewReport(c)}><Ionicons name="document-text-outline" size={14} color={C.teal} /><Text style={s.btnOutlineText}>View Details</Text></TouchableOpacity>
                            <TouchableOpacity style={s.btnDark} onPress={() => handleReschedule(c)}><Ionicons name="create-outline" size={14} color="#fff" /><Text style={s.btnDarkText}>Reschedule</Text></TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {ratingModal && (
        <RatingModal
          visible={ratingModal.visible} onClose={() => setRatingModal(null)}
          doctorId={ratingModal.doctorId} doctorName={ratingModal.doctorName}
          consultationId={ratingModal.consultationId}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  backButton:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerTitles:   { flex: 1 },
  headerTitle:    { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // White card
  card: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },

  // Search
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },

  // Chips
  chips:         { flexDirection: 'row', gap: 8 },
  chip:          { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive:    { backgroundColor: C.teal, borderColor: C.teal },
  chipText:      { fontSize: 13, color: C.muted, fontWeight: '500' },
  chipTextActive:{ color: '#fff', fontWeight: '600' },

  // Cards
  consCard:    { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 12, backgroundColor: C.bg },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarWrap:  { width: 48, height: 48, borderRadius: 24, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg:   { width: 48, height: 48, borderRadius: 24 },
  doctorName:  { fontSize: 14, fontWeight: '600', color: C.text },
  specialty:   { fontSize: 12, color: C.muted },
  divider:     { height: 1, backgroundColor: C.border },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 12, color: C.muted },
  notes:       { fontSize: 12, color: C.muted, lineHeight: 18 },
  badge:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeGrey:   { backgroundColor: C.tealLight },
  badgeCancelled: { backgroundColor: '#fee2e2' },
  badgeText:   { fontSize: 11, fontWeight: '600', color: C.teal },
  badgeTextCancelled: { fontSize: 11, fontWeight: '600', color: '#EF4444' },
  actions:     { flexDirection: 'row', gap: 8, paddingTop: 4 },
  btnOutline:  { flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.teal, borderRadius: 10 },
  btnOutlineText: { fontSize: 12, fontWeight: '600', color: C.teal },
  btnDark:     { flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.teal, borderRadius: 10 },
  btnDarkText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Empty
  empty:        { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  emptyText:    { fontSize: 14, color: C.muted, textAlign: 'center', maxWidth: 260 },
  bookBtn:      { marginTop: 4, backgroundColor: C.teal, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  bookBtnText:  { fontSize: 14, fontWeight: '600', color: '#fff' },
});
