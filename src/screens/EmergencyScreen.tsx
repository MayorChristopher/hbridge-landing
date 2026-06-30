import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Linking, ActivityIndicator, ScrollView, StatusBar,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { locationService } from '../services/locationService';
import { CustomAlert } from '../components/CustomAlert';

const C = {
  bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717', muted: '#555F6D',
  border: '#E2E8EF', teal: '#0B7E8A', tealRing1: '#CCECED', tealRing2: '#E6F5F5',
  red: '#ef4444',
};

const SOS_SIZE  = 180;
const RING1_PAD = 12;
const RING2_PAD = 12;

export default function EmergencyScreen({ navigation }: any) {
  const [location, setLocation]           = useState<string>('Detecting location...');
  const [nearestHospital, setNearestHospital] = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [sosActive, setSosActive]         = useState(false);
  const [alertConfig, setAlertConfig]     = useState<{
    visible: boolean; title: string; message: string;
    icon?: string; iconColor?: string;
    buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress: () => void }>;
  }>({ visible: false, title: '', message: '', buttons: [] });

  const pulse   = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = () => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loopRef.current.start();
  };

  useEffect(() => { startPulse(); return () => loopRef.current?.stop(); }, []);
  useEffect(() => { init(); }, []);

  const showAlert = (config: typeof alertConfig) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const init = async () => {
    setLoading(true);
    try {
      const loc = await locationService.getCurrentLocation();
      const { latitude, longitude } = loc.coords;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const geo = await res.json();
        const addr = geo.address;
        const parts = [addr.road, addr.suburb, addr.city || addr.town || addr.state].filter(Boolean);
        setLocation(parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } catch { setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`); }

      const { data } = await supabase.from('hospitals')
        .select('id, name, phone, city, state, latitude, longitude, emergency_services')
        .eq('is_active', true).eq('emergency_services', true).limit(50);

      if (data && data.length > 0) {
        let nearest = data[0], minDist = Infinity;
        for (const h of data) {
          if (h.latitude && h.longitude) {
            const d = locationService.calculateDistance(latitude, longitude, h.latitude, h.longitude);
            if (d < minDist) { minDist = d; nearest = h; }
          }
        }
        setNearestHospital({ ...nearest, distance: minDist.toFixed(1) });
      } else {
        setNearestHospital({ name: 'National Hospital Abuja', phone: '+234 9 461 2200', city: 'Abuja', distance: null });
      }
    } catch {
      setLocation('Location unavailable');
      setNearestHospital({ name: 'National Hospital Abuja', phone: '+234 9 461 2200', city: 'Abuja', distance: null });
    } finally { setLoading(false); }
  };

  const callNumber = (number: string, name: string) => {
    showAlert({
      visible: true, title: `Call ${name}?`, message: `This will dial ${number}`,
      icon: 'call', iconColor: C.teal,
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        { text: 'Call Now', style: 'destructive', onPress: () => Linking.openURL(`tel:${number}`) },
      ],
    });
  };

  const handleSOS = () => {
    showAlert({
      visible: true, title: 'Emergency SOS',
      message: 'This will immediately call the nearest hospital emergency line. Your location will be shared.',
      icon: 'shield', iconColor: C.red,
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        {
          text: 'Call Emergency', style: 'destructive',
          onPress: () => {
            setSosActive(true);
            const number = nearestHospital?.phone || '112';
            Linking.openURL(`tel:${number}`).catch(() => Linking.openURL('tel:112'));
            setTimeout(() => setSosActive(false), 4000);
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        {navigation?.canGoBack() && (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
        )}
        <View style={s.headerIconWrap}>
          <Ionicons name="shield" size={28} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Emergency SOS</Text>
          <Text style={s.headerSubtitle}>Get help fast</Text>
        </View>
        <TouchableOpacity style={s.callIconBtn} onPress={() => callNumber('112', 'Emergency Services')}>
          <Ionicons name="call" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* White Card */}
      <View style={s.card}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Location */}
          <View style={s.locationRow}>
            <Ionicons name="location" size={16} color={C.muted} />
            <Text style={s.locationText} numberOfLines={1}>{location}</Text>
          </View>

          {/* SOS button */}
          <View style={s.sosWrap}>
            <Animated.View style={[s.ring2, { transform: [{ scale: pulse }] }]}>
              <View style={s.ring1}>
                <View style={[s.sosBtn, sosActive ? s.sosBtnActive : s.sosBtnIdle]}>
                  <Ionicons name="shield" size={32} color="#ffffff" />
                  <Text style={s.sosLabel}>SOS</Text>
                </View>
              </View>
            </Animated.View>
            <TouchableOpacity style={s.sosTouchArea} onPress={handleSOS} activeOpacity={1} />
          </View>

          <Text style={s.sosHint}>Tap to connect to the nearest hospital</Text>

          {/* Hospital card */}
          <View style={s.hospCard}>
            {loading ? (
              <ActivityIndicator color={C.teal} />
            ) : (
              <>
                <View style={s.cardHeader}>
                  <Text style={s.cardLabel}>NEAREST HOSPITAL</Text>
                  {nearestHospital?.distance && (
                    <View style={s.badge}>
                      <Ionicons name="location" size={11} color={C.teal} />
                      <Text style={s.badgeText}>{nearestHospital.distance} km away</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardName}>{nearestHospital?.name}</Text>
                {nearestHospital?.phone && (
                  <View style={s.cardPhoneRow}>
                    <Ionicons name="call" size={14} color={C.muted} />
                    <Text style={s.cardPhone}>{nearestHospital.phone}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={s.callBtn}
                  onPress={() => callNumber(nearestHospital?.phone || '112', nearestHospital?.name || 'Emergency')}
                >
                  <Ionicons name="call" size={16} color="#ffffff" />
                  <Text style={s.callBtnText}>Call Now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerNote}>Your location will be shared with emergency responders</Text>
            <TouchableOpacity onPress={() => showAlert({
              visible: true, title: 'Offline Emergency Info',
              message: 'Your emergency contacts and medical information are stored locally and can be accessed even without internet connection.',
              icon: 'information-circle', iconColor: C.teal,
              buttons: [{ text: 'Got it', style: 'default', onPress: () => {} }],
            })}>
              <Text style={s.footerLink}>View offline emergency info</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <CustomAlert
        visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message}
        icon={alertConfig.icon} iconColor={alertConfig.iconColor}
        buttons={alertConfig.buttons} onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },

  // Header
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerTitles:  { flex: 1 },
  headerTitle:   { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle:{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  callIconBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // White card
  card:   { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 28 },

  // Location
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText:{ fontSize: 13, color: C.muted, flex: 1, textAlign: 'center' },

  // SOS
  sosWrap:    { alignItems: 'center', justifyContent: 'center' },
  sosTouchArea: {
    position: 'absolute',
    width:  SOS_SIZE + RING1_PAD * 2,
    height: SOS_SIZE + RING1_PAD * 2,
    borderRadius: (SOS_SIZE + RING1_PAD * 2) / 2,
  },
  ring2: {
    width:  SOS_SIZE + (RING1_PAD + RING2_PAD) * 2,
    height: SOS_SIZE + (RING1_PAD + RING2_PAD) * 2,
    borderRadius: (SOS_SIZE + (RING1_PAD + RING2_PAD) * 2) / 2,
    backgroundColor: C.tealRing2,
    alignItems: 'center', justifyContent: 'center',
  },
  ring1: {
    width:  SOS_SIZE + RING1_PAD * 2,
    height: SOS_SIZE + RING1_PAD * 2,
    borderRadius: (SOS_SIZE + RING1_PAD * 2) / 2,
    backgroundColor: C.tealRing1,
    alignItems: 'center', justifyContent: 'center',
  },
  sosBtn:       { width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sosBtnIdle:   { backgroundColor: C.teal },
  sosBtnActive: { backgroundColor: C.red },
  sosLabel:     { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  sosHint:      { fontSize: 13, color: C.muted, textAlign: 'center' },

  // Hospital card
  hospCard:    { width: '100%', borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, padding: 16, gap: 8 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel:   { fontSize: 10, fontWeight: '500', color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:   { fontSize: 11, color: C.teal, fontWeight: '600' },
  cardName:    { fontSize: 16, fontWeight: '700', color: C.text },
  cardPhoneRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardPhone:   { fontSize: 13, color: C.muted },
  callBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.teal, borderRadius: 10, paddingVertical: 12, marginTop: 4 },
  callBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },

  // Footer
  footer:     { alignItems: 'center', gap: 8 },
  footerNote: { fontSize: 11, color: C.muted, textAlign: 'center' },
  footerLink: { fontSize: 11, color: C.muted, textDecorationLine: 'underline' },
});
