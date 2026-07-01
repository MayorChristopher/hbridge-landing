import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import LoadingLogo from '../components/LoadingLogo';

const TEAL = '#0B7E8A';
const GOLD  = '#D4A843';

export default function HospitalDetailScreen({ route, navigation }: any) {
  const { hospitalId } = route.params;
  const [hospital, setHospital] = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadHospital(); }, []);

  const loadHospital = async () => {
    try {
      const { data, error } = await supabase.from('hospitals').select('*').eq('id', hospitalId).single();
      if (error) throw error;
      setHospital(data);
    } catch { } finally { setLoading(false); }
  };

  if (loading) return <LoadingLogo />;

  if (!hospital) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><Text style={s.muted}>Hospital not found</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{hospital.name}</Text>
          <Text style={s.headerSub}>Hospital Details</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* White Card */}
        <View style={s.card}>

          {/* Icon + badges */}
          <View style={s.heroRow}>
            <View style={s.iconBox}>
              <Ionicons name="business" size={32} color={TEAL} />
            </View>
            <View style={s.heroInfo}>
              <Text style={s.heroName}>{hospital.name}</Text>
              <View style={s.badgeRow}>
                {hospital.type && (
                  <View style={[s.badge, { backgroundColor: '#fdf8ee', borderColor: GOLD + '60' }]}>
                    <Text style={[s.badgeText, { color: GOLD }]}>
                      {hospital.type.charAt(0).toUpperCase() + hospital.type.slice(1)}
                    </Text>
                  </View>
                )}
                {hospital.emergency_services && (
                  <View style={[s.badge, { backgroundColor: '#fee2e2', borderColor: '#EF444460' }]}>
                    <Ionicons name="medical" size={11} color="#EF4444" />
                    <Text style={[s.badgeText, { color: '#EF4444' }]}>24/7 Emergency</Text>
                  </View>
                )}
              </View>
              {hospital.rating > 0 && (
                <View style={s.ratingRow}>
                  <Ionicons name="star" size={13} color={GOLD} />
                  <Text style={s.ratingText}>{hospital.rating.toFixed(1)}</Text>
                  {hospital.total_reviews > 0 && (
                    <Text style={s.ratingCount}>({hospital.total_reviews} reviews)</Text>
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={s.divider} />

          {/* Quick Actions */}
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`tel:${hospital.phone}`)}>
              <View style={[s.actionIcon, { backgroundColor: '#E6F5F5' }]}>
                <Ionicons name="call" size={20} color={TEAL} />
              </View>
              <Text style={s.actionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + hospital.address)}`)}>
              <View style={[s.actionIcon, { backgroundColor: '#E6F5F5' }]}>
                <Ionicons name="navigate" size={20} color={TEAL} />
              </View>
              <Text style={s.actionLabel}>Directions</Text>
            </TouchableOpacity>
            {hospital.emergency_phone && (
              <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`tel:${hospital.emergency_phone}`)}>
                <View style={[s.actionIcon, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="medical" size={20} color="#EF4444" />
                </View>
                <Text style={[s.actionLabel, { color: '#EF4444' }]}>Emergency</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.divider} />

          {/* Info Grid */}
          <View style={s.grid}>
            {[
              { icon: 'location', label: 'Location', value: `${hospital.city}, ${hospital.state}` },
              { icon: 'business', label: 'Type', value: hospital.type || '—' },
              { icon: 'medical', label: 'Category', value: hospital.category || '—' },
              { icon: 'time', label: 'Emergency', value: hospital.emergency_services ? '24/7' : 'No', color: hospital.emergency_services ? TEAL : '#EF4444' },
            ].map((item, i) => (
              <View key={i} style={s.gridCard}>
                <Ionicons name={item.icon as any} size={16} color={GOLD} />
                <Text style={s.gridLabel}>{item.label}</Text>
                <Text style={[s.gridValue, item.color ? { color: item.color } : {}]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={s.divider} />

          {/* Address */}
          <Text style={s.sectionTitle}>Address</Text>
          <TouchableOpacity style={s.addressCard} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + hospital.address)}`)}>
            <View style={s.addressIcon}><Ionicons name="location" size={20} color={TEAL} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.addressText}>{hospital.address}</Text>
              {hospital.lga && <Text style={s.addressSub}>{hospital.lga}, {hospital.state} State</Text>}
            </View>
            <Ionicons name="open-outline" size={16} color="#a3a3a3" />
          </TouchableOpacity>

          {/* Contact */}
          <Text style={[s.sectionTitle, { marginTop: 20 }]}>Contact</Text>
          <View style={s.contactRow}>
            <TouchableOpacity style={s.contactCard} onPress={() => Linking.openURL(`tel:${hospital.phone}`)}>
              <Ionicons name="call" size={16} color={TEAL} />
              <Text style={s.contactLabel}>Main Line</Text>
              <Text style={s.contactVal}>{hospital.phone}</Text>
            </TouchableOpacity>
            {hospital.emergency_phone && (
              <TouchableOpacity style={s.contactCard} onPress={() => Linking.openURL(`tel:${hospital.emergency_phone}`)}>
                <Ionicons name="medical" size={16} color="#EF4444" />
                <Text style={s.contactLabel}>Emergency</Text>
                <Text style={[s.contactVal, { color: '#EF4444' }]}>{hospital.emergency_phone}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Services */}
          {hospital.services?.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Services</Text>
              <View style={s.chips}>
                {hospital.services.map((srv: string, i: number) => (
                  <View key={i} style={s.chip}>
                    <Ionicons name="checkmark-circle" size={13} color={TEAL} />
                    <Text style={s.chipText}>{srv}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Book Button */}
          <TouchableOpacity style={s.bookBtn} onPress={() => navigation.navigate('BookConsultation', { doctor: { id: hospital.id, full_name: hospital.name, specialization: 'Hospital', consultation_fee: 0 } })}>
            <Text style={s.bookBtnText}>Book Appointment</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: TEAL },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 14, color: '#737373' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, padding: 24, minHeight: '100%' },
  heroRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 20 },
  iconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#E6F5F5', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: TEAL + '40' },
  heroInfo: { flex: 1, gap: 6 },
  heroName: { fontSize: 18, fontWeight: '700', color: '#171717' },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#404040' },
  ratingCount: { fontSize: 12, color: '#737373' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 16 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#404040' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '47%', backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  gridLabel: { fontSize: 11, color: '#737373' },
  gridValue: { fontSize: 13, fontWeight: '600', color: '#171717', textAlign: 'center', textTransform: 'capitalize' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#171717', marginBottom: 10 },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9f9f9', borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', padding: 14 },
  addressIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E6F5F5', alignItems: 'center', justifyContent: 'center' },
  addressText: { fontSize: 14, fontWeight: '500', color: '#171717', lineHeight: 20 },
  addressSub: { fontSize: 12, color: '#737373', marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactCard: { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  contactLabel: { fontSize: 11, color: '#737373' },
  contactVal: { fontSize: 13, fontWeight: '600', color: '#171717', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E6F5F5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, color: TEAL, fontWeight: '500' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, height: 54, marginTop: 24 },
  bookBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
