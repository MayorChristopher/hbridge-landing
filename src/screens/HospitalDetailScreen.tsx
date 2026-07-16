import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, StatusBar, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import LoadingLogo from '../components/LoadingLogo';
import FadeScreen from '../components/FadeScreen';

const { height: SH } = Dimensions.get('window');

const C = {
  bg: '#F5F3EE', surface: '#EDE9E0', card: '#FFFFFF', text: '#0C2E30',
  muted: '#6B7E7F', border: '#EAE5DA', teal: '#0B7E8A', tealLight: 'rgba(11,126,138,0.09)',
  gold: '#D4A843', red: '#EF4444',
};

export default function HospitalDetailScreen({ route, navigation }: any) {
  const { hospitalId, hospitalName: hospitalNameParam } = route.params;
  const [hospital, setHospital]         = useState<any>(null);
  const [resolvedId, setResolvedId]     = useState<string | null>(hospitalId || null);
  const [loading, setLoading]           = useState(true);
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const practitionersY = useRef(0);

  useEffect(() => { loadHospital(); }, []);

  const loadHospital = async () => {
    try {
      if (hospitalId) {
        const { data } = await supabase.from('hospitals').select('*').eq('id', hospitalId).single();
        setHospital(data);
        if (data?.id) loadPractitioners(data.id);
      } else if (hospitalNameParam) {
        // Try hospitals table by name first
        const { data: byName } = await supabase
          .from('hospitals').select('*').ilike('name', `%${hospitalNameParam}%`).maybeSingle();
        if (byName) {
          setHospital(byName);
          setResolvedId(byName.id);
          loadPractitioners(byName.id);
        } else {
          // Fall back to profiles — show limited info
          const { data: prof } = await supabase
            .from('profiles')
            .select('hospital_name, full_name, phone')
            .ilike('hospital_name', `%${hospitalNameParam}%`)
            .maybeSingle();
          if (prof) {
            setHospital({
              name: prof.hospital_name || prof.full_name,
              city: null, state: null, phone: prof.phone,
              rating: 0, total_reviews: 0, emergency_services: false, services: [],
            });
          }
        }
      }
    } catch {} finally { setLoading(false); }
  };

  const loadPractitioners = async (hospId: string) => {
    try {
      const { data: staff } = await supabase
        .from('hospital_staff')
        .select('doctors!inner(id, full_name, title, specialization, profile_image, average_rating, is_available, user_id)')
        .eq('hospital_id', hospId)
        .eq('status', 'active');
      if (staff?.length) {
        setPractitioners(staff.map((s: any) => s.doctors).filter(Boolean));
      }
    } catch {}
  };

  if (loading) return <LoadingLogo />;

  if (!hospital) {
    return (
      <FadeScreen>
        <SafeAreaView style={s.container} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted }}>Hospital not found</Text>
          </View>
        </SafeAreaView>
      </FadeScreen>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospital.name} ${hospital.address || ''}`)}`;

  return (
    <FadeScreen>
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />

      {/* Immersive teal hero */}
      <LinearGradient colors={['#0C6570', '#083236']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroOrb} />
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        {/* Bottom row: info left, action right */}
        <View style={s.heroBottom}>
          <View style={s.heroIconRing}>
            <MaterialCommunityIcons name="hospital-building" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroName} numberOfLines={2}>{hospital.name}</Text>
            <View style={s.heroBadgeRow}>
              {hospital.type && (
                <View style={s.badgeGold}>
                  <Text style={s.badgeGoldText}>{hospital.type.charAt(0).toUpperCase() + hospital.type.slice(1)}</Text>
                </View>
              )}
              {hospital.emergency_services && (
                <View style={s.badgeRed}>
                  <Ionicons name="flash" size={10} color={C.red} />
                  <Text style={s.badgeRedText}>24/7 Emergency</Text>
                </View>
              )}
              {hospital.rating > 0 && (
                <View style={s.badgeRating}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={s.badgeRatingText}>{hospital.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={s.heroActionBtn} onPress={() => hospital.phone && Linking.openURL(`tel:${hospital.phone}`)}>
            <Ionicons name="call-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Paper card scrollable */}
      <View style={s.paperCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Quick actions */}
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => hospital.phone && Linking.openURL(`tel:${hospital.phone}`)}>
              <View style={[s.actionIcon, { backgroundColor: C.tealLight }]}>
                <Ionicons name="call" size={20} color={C.teal} />
              </View>
              <Text style={s.actionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(mapsUrl)}>
              <View style={[s.actionIcon, { backgroundColor: C.tealLight }]}>
                <Ionicons name="navigate-outline" size={20} color={C.teal} />
              </View>
              <Text style={s.actionLabel}>Directions</Text>
            </TouchableOpacity>
            {hospital.emergency_phone && (
              <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`tel:${hospital.emergency_phone}`)}>
                <View style={[s.actionIcon, { backgroundColor: 'rgba(239,68,68,0.10)' }]}>
                  <Ionicons name="medkit-outline" size={20} color={C.red} />
                </View>
                <Text style={[s.actionLabel, { color: C.red }]}>Emergency</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.divider} />

          {/* Info grid */}
          <View style={s.grid}>
            {[
              { icon: 'location-outline', label: 'Location', value: [hospital.city, hospital.state].filter(Boolean).join(', ') || '—' },
              { icon: 'business-outline', label: 'Type', value: hospital.type ? hospital.type.charAt(0).toUpperCase() + hospital.type.slice(1) : '—' },
              { icon: 'layers-outline', label: 'Category', value: hospital.category || '—' },
              { icon: 'time-outline', label: 'Emergency', value: hospital.emergency_services ? '24 / 7' : 'None', accent: hospital.emergency_services ? C.teal : C.red },
            ].map((item, i) => (
              <View key={i} style={s.gridCard}>
                <Ionicons name={item.icon as any} size={18} color={C.gold} />
                <Text style={s.gridLabel}>{item.label}</Text>
                <Text style={[s.gridValue, item.accent ? { color: item.accent } : {}]} numberOfLines={2}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={s.divider} />

          {/* Address */}
          <Text style={s.sectionTitle}>Address</Text>
          <TouchableOpacity style={s.addressCard} activeOpacity={0.7} onPress={() => Linking.openURL(mapsUrl)}>
            <View style={s.addressIcon}>
              <Ionicons name="location" size={20} color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.addressText}>{hospital.address || 'Address not available'}</Text>
              {(hospital.lga || hospital.state) && (
                <Text style={s.addressSub}>{[hospital.lga, hospital.state].filter(Boolean).join(', ')} State</Text>
              )}
            </View>
            <Ionicons name="open-outline" size={16} color={C.muted} />
          </TouchableOpacity>

          {/* Contact */}
          {(hospital.phone || hospital.emergency_phone) && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Contact</Text>
              <View style={s.contactRow}>
                {hospital.phone && (
                  <TouchableOpacity style={s.contactCard} onPress={() => Linking.openURL(`tel:${hospital.phone}`)}>
                    <Ionicons name="call" size={16} color={C.teal} />
                    <Text style={s.contactLabel}>Main Line</Text>
                    <Text style={s.contactVal}>{hospital.phone}</Text>
                  </TouchableOpacity>
                )}
                {hospital.emergency_phone && (
                  <TouchableOpacity style={s.contactCard} onPress={() => Linking.openURL(`tel:${hospital.emergency_phone}`)}>
                    <Ionicons name="medkit-outline" size={16} color={C.red} />
                    <Text style={s.contactLabel}>Emergency</Text>
                    <Text style={[s.contactVal, { color: C.red }]}>{hospital.emergency_phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Services */}
          {Array.isArray(hospital.services) && hospital.services.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Services Offered</Text>
              <View style={s.chips}>
                {hospital.services.map((srv: string, i: number) => (
                  <View key={i} style={s.chip}>
                    <Ionicons name="checkmark-circle" size={13} color={C.teal} />
                    <Text style={s.chipText}>{srv}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Practitioners */}
          {practitioners.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}
                onLayout={e => { practitionersY.current = e.nativeEvent.layout.y; }}>
                Our Practitioners
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}
              >
                {practitioners.map((doc: any) => {
                  const title = doc.title || 'Dr.';
                  const displayName = /^dr\.?\s/i.test((doc.full_name || '').trim())
                    ? doc.full_name
                    : `${title.endsWith('.') ? title : title + '.'} ${doc.full_name || ''}`.trim();
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={s.docCard}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('BookConsultation', { doctor: doc })}
                    >
                      {doc.profile_image
                        ? <Image source={{ uri: doc.profile_image }} style={s.docAvatar} />
                        : <View style={[s.docAvatar, s.docAvatarFallback]}>
                            <MaterialCommunityIcons name="stethoscope" size={22} color={C.teal} />
                          </View>}
                      <View style={[s.docAvailDot, { backgroundColor: doc.is_available ? '#22C55E' : C.muted }]} />
                      <Text style={s.docName} numberOfLines={2}>{displayName}</Text>
                      <Text style={s.docSpec} numberOfLines={1}>{doc.specialization || 'General Practice'}</Text>
                      {doc.average_rating > 0 && (
                        <View style={s.docRating}>
                          <Ionicons name="star" size={10} color="#F59E0B" />
                          <Text style={s.docRatingText}>{doc.average_rating.toFixed(1)}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={s.docBookBtn}
                        onPress={() => navigation.navigate('BookConsultation', { doctor: doc })}
                      >
                        <Text style={s.docBookBtnText}>Book</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

        </ScrollView>
      </View>
    </SafeAreaView>
    </FadeScreen>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },

  // Immersive hero
  hero: {
    minHeight: SH * 0.28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -50,
  },
  backBtn: {
    position: 'absolute', top: 14, left: 20,
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  heroIconRing: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2,
  },
  heroActionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  heroName: { fontSize: 18, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  heroBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  badgeRating: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  badgeRatingText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#fff' },

  paperCard: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },

  badgeGold: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(212,168,67,0.10)', borderWidth: 1, borderColor: 'rgba(212,168,67,0.30)' },
  badgeGoldText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.gold },
  badgeRed: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  badgeRedText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: C.red },

  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  actionBtn: { alignItems: 'center', gap: 7 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.text },

  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 24, marginBottom: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  gridCard: { width: '47%', backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.border },
  gridLabel: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  gridValue: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text, textAlign: 'center', textTransform: 'capitalize' },

  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat_700Bold', color: C.text, marginBottom: 10, paddingHorizontal: 20 },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginHorizontal: 20 },
  addressIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  addressText: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: C.text, lineHeight: 21 },
  addressSub: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, marginTop: 2 },

  contactRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  contactCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.border },
  contactLabel: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted },
  contactVal: { fontSize: 13, fontFamily: 'Montserrat_600SemiBold', color: C.text, textAlign: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.tealLight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: C.teal },

  // Practitioners carousel
  docCard: { width: 140, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center', gap: 6, position: 'relative' },
  docAvatar: { width: 60, height: 60, borderRadius: 30, marginBottom: 2 },
  docAvatarFallback: { backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center' },
  docAvailDot: { position: 'absolute', top: 50, right: 18, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.card },
  docName: { fontSize: 12, fontFamily: 'Montserrat_600SemiBold', color: C.text, textAlign: 'center', lineHeight: 17 },
  docSpec: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, textAlign: 'center' },
  docRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  docRatingText: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#F59E0B' },
  docBookBtn: { backgroundColor: C.teal, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 6, marginTop: 2 },
  docBookBtnText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#fff' },
});
