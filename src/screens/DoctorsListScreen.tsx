import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { usePresence } from '../context/PresenceContext';

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', cardBorder: '#EAE5DA',
  text: '#0C2E30', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  gold: '#D4A843', muted: '#6B7E7F', muted2: '#97A2A0',
};

const SPEC_FILTERS = ['All', 'General Practice', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Dermatology', 'Gynecology', 'Neurology'];

export default function DoctorsListScreen({ navigation }: any) {
  const [search, setSearch]                           = useState('');
  const [doctors, setDoctors]                         = useState<any[]>([]);
  const [loading, setLoading]                         = useState(true);
  const [refreshing, setRefreshing]                   = useState(false);
  const [activeSpec, setActiveSpec]                   = useState('All');
  const [messagingId, setMessagingId]                 = useState<string | null>(null);
  const [currentUserDoctorId, setCurrentUserDoctorId] = useState<string | null>(null);
  const searchTimeout = useRef<any>(null);
  const onlineUserIds = usePresence();

  useEffect(() => { getCurrentUser(); loadDoctors(''); }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: doctorData } = await supabase.from('doctors').select('id').eq('user_id', user.id).maybeSingle();
        if (doctorData) setCurrentUserDoctorId(doctorData.id);
      }
    } catch {}
  };

  const openChat = async (d: any) => {
    setMessagingId(d.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existing } = await supabase.from('conversations').select('id').eq('patient_id', user.id).eq('doctor_id', d.id).maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created } = await supabase.from('conversations').insert({ patient_id: user.id, doctor_id: d.id }).select('id').single();
        conversationId = created?.id;
      }
      navigation.navigate('Conversation', {
        conversationId, other: { id: d.id, full_name: d.full_name, avatar_url: d.profile_image, isDoctor: true, title: d.title || 'Dr.' }, currentUserId: user.id,
      });
    } finally { setMessagingId(null); }
  };

  const loadDoctors = async (text: string, spec?: string) => {
    setLoading(true);
    try {
      let query = supabase.from('doctors')
        .select('id,user_id,full_name,specialization,average_rating,total_reviews,profile_image,is_available,years_experience,consultation_fee,medical_license,title,user_id')
        .eq('verification_status', 'verified').ilike('full_name', `%${text}%`).order('average_rating', { ascending: false }).limit(30);
      const sp = spec ?? activeSpec;
      if (sp !== 'All') query = query.ilike('specialization', `%${sp}%`);
      const { data } = await query;
      setDoctors(data || []);
    } catch { setDoctors([]); } finally { setLoading(false); }
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadDoctors(text), 400);
  };

  const onSpecPress = (spec: string) => { setActiveSpec(spec); loadDoctors(search, spec); };
  const onRefresh   = async () => { setRefreshing(true); await loadDoctors(search); setRefreshing(false); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Deep teal header — matches HospitalsListScreen but without icon */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Find Practitioners</Text>
          <Text style={s.headerSubtitle}>Browse verified medical professionals</Text>
        </View>
      </View>

      {/* Paper card */}
      <View style={s.paperCard}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Toggle */}
          <View style={s.toggleWrap}>
            <View style={s.toggle}>
              <TouchableOpacity style={s.toggleBtn} onPress={() => navigation.replace('HospitalsList')}>
                <MaterialCommunityIcons name="hospital-building" size={13} color={C.muted} />
                <Text style={s.toggleTextInactive}>Hospitals</Text>
              </TouchableOpacity>
              <View style={[s.toggleBtn, s.toggleBtnActive]}>
                <MaterialCommunityIcons name="stethoscope" size={13} color="#fff" />
                <Text style={s.toggleTextActive}>Practitioners</Text>
              </View>
            </View>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={17} color={C.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by name or specialty…"
              placeholderTextColor={C.muted}
              value={search}
              onChangeText={onSearchChange}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); loadDoctors(''); }}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Specialty chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
            {SPEC_FILTERS.map(sp => (
              <TouchableOpacity key={sp} style={[s.chip, activeSpec === sp && s.chipActive]} onPress={() => onSpecPress(sp)}>
                <Text style={[s.chipText, activeSpec === sp && s.chipTextActive]}>{sp}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Count */}
          <View style={s.resultsBar}>
            <Text style={s.resultsLabel}>
              {loading ? 'Searching…' : `${doctors.length} practitioner${doctors.length !== 1 ? 's' : ''} found`}
            </Text>
          </View>

          {/* List */}
          <View style={s.list}>
            {loading ? (
              <ActivityIndicator size="large" color={C.teal} style={{ marginTop: 40 }} />
            ) : doctors.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <MaterialCommunityIcons name="stethoscope" size={32} color={C.teal} />
                </View>
                <Text style={s.emptyTitle}>No practitioners found</Text>
                <Text style={s.emptyHint}>Try adjusting the filter or search</Text>
              </View>
            ) : (
              doctors.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={s.docCard}
                  onPress={() => navigation.navigate('DoctorDetail', { doctor: d })}
                  activeOpacity={0.8}
                >
                  <View style={s.docPhoto}>
                    {d.profile_image
                      ? <Image source={{ uri: d.profile_image }} style={s.docPhotoImg} />
                      : <MaterialCommunityIcons name="stethoscope" size={26} color={C.teal} />}
                  </View>
                  <View style={s.docInfo}>
                    <View style={s.docNameRow}>
                      <Text style={s.docName} numberOfLines={1}>{d.title || 'Dr.'} {d.full_name}</Text>
                      {d.medical_license && <Ionicons name="checkmark-circle" size={14} color={C.gold} />}
                      {currentUserDoctorId === d.id && <View style={s.youBadge}><Text style={s.youBadgeText}>You</Text></View>}
                    </View>
                    <Text style={s.docSpec} numberOfLines={1}>{d.specialization}{d.years_experience ? ` · ${d.years_experience} yrs` : ''}</Text>
                    <View style={s.docMeta}>
                      <Ionicons name="star" size={11} color="#F59E0B" />
                      <Text style={s.docRatingVal}>{(d.average_rating || 0).toFixed(1)}</Text>
                      {onlineUserIds.has(d.user_id) && d.is_available && (
                        <>
                          <View style={s.availDot} />
                          <Text style={s.availText}>Open to consult</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={s.docRight}>
                    <Text style={s.feeVal}>{d.consultation_fee ? `₦${Number(d.consultation_fee).toLocaleString()}` : '—'}</Text>
                    <Text style={s.feeLbl}>per visit</Text>
                    <TouchableOpacity
                      style={s.msgBtn}
                      onPress={() => openChat(d)}
                      disabled={messagingId === d.id}
                    >
                      {messagingId === d.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="chatbubble-outline" size={14} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const C2 = C; // alias for style references

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.70)', marginTop: 2 },

  paperCard: { flex: 1, backgroundColor: C2.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  toggleWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  toggle: { flexDirection: 'row', backgroundColor: C2.surface, borderRadius: 14, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: C2.teal },
  toggleTextActive: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },
  toggleTextInactive: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C2.muted },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, backgroundColor: C2.card, borderRadius: 14, borderWidth: 1.5, borderColor: C2.cardBorder, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C2.text, paddingVertical: 0 },

  chipsRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C2.surface, borderWidth: 1.5, borderColor: C2.cardBorder },
  chipActive: { backgroundColor: C2.tealLight, borderColor: C2.teal },
  chipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C2.text },
  chipTextActive: { fontFamily: 'SpaceGrotesk_500Medium', color: C2.teal },

  resultsBar: { paddingHorizontal: 20, paddingBottom: 10 },
  resultsLabel: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C2.muted },

  list: { paddingHorizontal: 16, gap: 12 },

  docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C2.card, borderRadius: 18, borderWidth: 1, borderColor: C2.cardBorder, padding: 14 },
  docPhoto: { width: 56, height: 56, borderRadius: 14, backgroundColor: C2.tealLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  docPhotoImg: { width: 56, height: 56 },
  docInfo: { flex: 1, minWidth: 0 },
  docNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  docName: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C2.text, flexShrink: 1 },
  docSpec: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C2.muted, marginTop: 2 },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  docRatingVal: { fontSize: 11.5, fontFamily: 'Montserrat_700Bold', color: '#D97706' },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  availText: { fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', color: '#10B981' },
  docRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  feeVal: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: C2.teal },
  feeLbl: { fontSize: 10, fontFamily: 'SpaceGrotesk_400Regular', color: C2.muted },
  msgBtn: { backgroundColor: C2.teal, borderRadius: 8, padding: 6, alignItems: 'center', justifyContent: 'center' },

  youBadge: { backgroundColor: C2.teal, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 },
  youBadgeText: { fontSize: 10, fontFamily: 'Montserrat_700Bold', color: '#fff' },

  empty: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: C2.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: C2.text },
  emptyHint: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: C2.muted },

});
