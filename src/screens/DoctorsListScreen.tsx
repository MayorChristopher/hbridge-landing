import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717', muted: '#555F6D',
  border: '#E2E8EF', teal: '#0B7E8A', tealLight: '#E6F5F5', white: '#FFFFFF',
};

const SPEC_FILTERS = [
  'All', 'General Practice', 'Cardiology', 'Pediatrics',
  'Orthopedics', 'Dermatology', 'Gynecology', 'Neurology',
];

export default function DoctorsListScreen({ navigation }: any) {
  const [search, setSearch]                         = useState('');
  const [doctors, setDoctors]                       = useState<any[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [refreshing, setRefreshing]                 = useState(false);
  const [activeSpec, setActiveSpec]                 = useState('All');
  const [messagingId, setMessagingId]               = useState<string | null>(null);
  const [currentUserDoctorId, setCurrentUserDoctorId] = useState<string | null>(null);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    getCurrentUser();
    loadDoctors('');
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: doctorData } = await supabase
          .from('doctors').select('id').eq('user_id', user.id).maybeSingle();
        if (doctorData) setCurrentUserDoctorId(doctorData.id);
      }
    } catch {}
  };

  const openChat = async (d: any) => {
    setMessagingId(d.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('patient_id', user.id).eq('doctor_id', d.id).maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created } = await supabase.from('conversations')
          .insert({ patient_id: user.id, doctor_id: d.id }).select('id').single();
        conversationId = created?.id;
      }
      const title = d.title || 'Dr.';
      navigation.navigate('Conversation', {
        conversationId,
        other: { id: d.id, full_name: d.full_name, avatar_url: d.profile_image, isDoctor: true, title },
        currentUserId: user.id,
      });
    } finally { setMessagingId(null); }
  };

  const loadDoctors = async (text: string, spec?: string) => {
    setLoading(true);
    try {
      let query = supabase.from('doctors')
        .select('id,user_id,full_name,specialization,average_rating,total_reviews,profile_image,is_available,years_experience,consultation_fee,medical_license,title')
        .eq('verification_status', 'verified')
        .ilike('full_name', `%${text}%`)
        .order('average_rating', { ascending: false })
        .limit(30);
      const sp = spec ?? activeSpec;
      if (sp !== 'All') query = query.ilike('specialization', `%${sp}%`);
      const { data } = await query;
      setDoctors(data || []);
    } catch { setDoctors([]); }
    finally { setLoading(false); }
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadDoctors(text), 400);
  };

  const onSpecPress = (spec: string) => { setActiveSpec(spec); loadDoctors(search, spec); };
  const onRefresh   = async () => { setRefreshing(true); await loadDoctors(search); setRefreshing(false); };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <View style={s.headerBranding}>
          <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={s.headerIconWrap}>
            <MaterialCommunityIcons name="stethoscope" size={28} color="#ffffff" />
          </View>
          <View style={s.headerTitles}>
            <Text style={s.headerTitle}>Find Doctors</Text>
            <Text style={s.headerSubtitle}>Browse verified specialists</Text>
          </View>
        </View>
      </View>

      {/* White Card */}
      <View style={s.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />
          }
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          {/* Toggle */}
          <View style={s.toggleWrap}>
            <View style={s.toggle}>
              <TouchableOpacity style={s.toggleBtn} onPress={() => navigation.replace('HospitalsList')}>
                <Text style={s.toggleTextInactive}>Hospitals</Text>
              </TouchableOpacity>
              <View style={[s.toggleBtn, s.toggleBtnActive]}>
                <Text style={s.toggleTextActive}>Doctors</Text>
              </View>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <View style={s.searchBar}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search doctors..."
                placeholderTextColor={C.muted}
                value={search}
                onChangeText={onSearchChange}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Specialty chips */}
          <View style={s.chipsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsContainer}>
              {SPEC_FILTERS.map(sp => (
                <TouchableOpacity
                  key={sp}
                  style={[s.chip, activeSpec === sp && s.chipActive]}
                  onPress={() => onSpecPress(sp)}
                >
                  <Text style={[s.chipText, activeSpec === sp && s.chipTextActive]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Results header */}
          <View style={s.resultsHeader}>
            <Text style={s.resultsTitle}>Nearby Doctors</Text>
            <Text style={s.resultsCount}>{doctors.length} found</Text>
          </View>

          {/* List */}
          <View style={s.cardsList}>
            {loading ? (
              <ActivityIndicator size="large" color={C.teal} style={{ marginTop: 32 }} />
            ) : doctors.length === 0 ? (
              <View style={s.empty}>
                <MaterialCommunityIcons name="stethoscope" size={40} color={C.muted} />
                <Text style={s.emptyText}>No doctors found</Text>
              </View>
            ) : (
              doctors.map(d => (
                <View key={d.id} style={s.docCard}>
                  <View style={s.cardTop}>
                    <View style={s.avatarWrap}>
                      {d.profile_image
                        ? <Image source={{ uri: d.profile_image }} style={s.avatar} />
                        : <MaterialCommunityIcons name="stethoscope" size={28} color={C.muted} />}
                    </View>
                    <View style={s.cardInfo}>
                      <View style={s.nameRow}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.cardName} numberOfLines={1}>{d.title || 'Dr.'} {d.full_name}</Text>
                          {currentUserDoctorId === d.id && (
                            <View style={s.youBadge}>
                              <Text style={s.youBadgeText}>You</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.ratingRow}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={s.ratingText}>{(d.average_rating || 0).toFixed(1)}</Text>
                        </View>
                      </View>
                      <Text style={s.specText}>{d.specialization}</Text>
                      <View style={s.metaRow}>
                        <View style={s.metaItem}><Ionicons name="location" size={12} color={C.muted} /><Text style={s.metaText}>Nigeria</Text></View>
                        {d.years_experience && <View style={s.metaItem}><Ionicons name="briefcase" size={12} color={C.muted} /><Text style={s.metaText}>{d.years_experience} yrs</Text></View>}
                        {d.medical_license && <View style={s.metaItem}><Ionicons name="document-text" size={12} color={C.muted} /><Text style={s.metaText}>{d.medical_license}</Text></View>}
                      </View>
                    </View>
                  </View>
                  <View style={s.cardBottom}>
                    <View style={s.metaItem}>
                      <Ionicons name="time" size={12} color={C.muted} />
                      <Text style={s.metaText}>{d.is_available ? 'Available Today' : 'Check Availability'}</Text>
                    </View>
                    <Text style={s.feeText}>
                      {d.consultation_fee ? `₦${Number(d.consultation_fee).toLocaleString()}` : 'Fee on request'}
                    </Text>
                  </View>
                  <View style={s.btnRow}>
                    {currentUserDoctorId === d.id ? (
                      <TouchableOpacity style={[s.darkBtn, { flex: 1 }]} onPress={() => navigation.navigate('Profile')}>
                        <Text style={s.darkBtnText}>Edit Profile</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity style={s.outlineBtn} onPress={() => navigation.navigate('DoctorDetail', { doctor: d })}>
                          <Text style={s.outlineBtnText}>View Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.darkBtn} onPress={() => openChat(d)} disabled={messagingId === d.id}>
                          {messagingId === d.id
                            ? <ActivityIndicator size="small" color="#ffffff" />
                            : <Text style={s.darkBtnText}>Message</Text>}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B7E8A',
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  headerBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // White card
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  // Toggle
  toggleWrap: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  toggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: C.teal },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  toggleTextInactive: { fontSize: 13, fontWeight: '500', color: C.muted },

  // Search
  searchWrap: { paddingHorizontal: 24, paddingBottom: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1.5, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text, paddingVertical: 0 },

  // Chips
  chipsWrap: { paddingBottom: 16 },
  chipsContainer: { paddingHorizontal: 24, gap: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.bg,
  },
  chipActive: { backgroundColor: C.teal, borderColor: C.teal },
  chipText: { fontSize: 11, color: C.text },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },

  // Results header
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 12,
  },
  resultsTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  resultsCount: { fontSize: 11, color: C.muted },

  // Cards list
  cardsList: { paddingHorizontal: 24, gap: 16 },
  docCard: {
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg, padding: 16, gap: 16,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatarWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
    borderWidth: 2, borderColor: C.tealLight,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  cardInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 13, fontWeight: '600', color: C.text, flex: 1, marginRight: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontWeight: '500', color: C.text },
  specText: { fontSize: 11, color: C.teal, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: C.muted },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feeText: { fontSize: 13, fontWeight: '700', color: C.teal },
  btnRow: { flexDirection: 'row', gap: 8 },
  outlineBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.teal,
    borderRadius: 10, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { fontSize: 12, fontWeight: '600', color: C.teal },
  darkBtn: {
    flex: 1, backgroundColor: C.teal,
    borderRadius: 10, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  darkBtnText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  youBadge: { backgroundColor: C.teal, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { fontSize: 9, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 13, color: C.muted },
});
