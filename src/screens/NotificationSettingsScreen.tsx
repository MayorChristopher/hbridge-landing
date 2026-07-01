import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { locationService } from '../services/locationService';

const C = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#0A0A0A',
  muted: '#737373',
  border: '#E5E5E5',
  dark: '#171717',
  teal: '#0B7E8A',
};

type Prefs = { push: boolean; email: boolean; sms: boolean; sound: boolean };

type Appointment = {
  id: string;
  scheduled_at: string;
  status: string;
  notes?: string;
  doctor: { full_name: string; specialization: string };
};

function StatusDot({ online }: { online: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!online) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [online]);
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      {online && <Animated.View style={[s.dotPulse, { transform: [{ scale: pulse }] }]} />}
      <View style={[s.dot, { backgroundColor: online ? C.teal : '#C6C6C6' }]} />
    </View>
  );
}

function SectionCard({ icon, title, children, rightEl }: any) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={s.cardTitle}>{title}</Text>
        </View>
        {rightEl}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({ label, sub, value, onChange, showDivider }: any) {
  return (
    <>
      <View style={s.toggleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.toggleLabel}>{label}</Text>
          <Text style={s.toggleSub}>{sub}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: C.border, true: C.teal + '60' }}
          thumbColor={value ? C.teal : '#ccc'}
        />
      </View>
      {showDivider && <View style={s.divider} />}
    </>
  );
}

function statusBadge(status: string) {
  const isUpcoming = status === 'scheduled';
  return (
    <View style={[s.badge, isUpcoming ? s.badgeDark : s.badgeLight]}>
      <Text style={[s.badgeText, isUpcoming ? s.badgeTextDark : s.badgeTextLight]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

function apptIcon(specialization: string) {
  const sp = specialization?.toLowerCase() || '';
  if (sp.includes('cardio') || sp.includes('heart')) return 'heart';
  if (sp.includes('eye') || sp.includes('ophthal')) return 'eye';
  return 'stethoscope';
}

const DEFAULT_PREFS: Prefs = { push: true, email: false, sms: true, sound: true };

export default function NotificationSettingsScreen({ navigation }: any) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [location, setLocation] = useState<{ lat: string; lon: string; address: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [loadingAppts, setLoadingAppts] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    await Promise.all([loadPrefs(user.id), loadAppointments(user.id), fetchLocation()]);
  };

  const loadPrefs = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', uid)
      .maybeSingle();
    if (data?.notification_prefs) {
      setPrefs({ ...DEFAULT_PREFS, ...data.notification_prefs });
    }
  };

  const togglePref = async (key: keyof Prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ notification_prefs: updated })
      .eq('id', userId);
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save preference. Please try again.');
      setPrefs(prefs);
    }
  };

  const loadAppointments = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('consultations')
        .select('id, scheduled_at, status, notes, doctor:doctors(full_name, specialization)')
        .eq('patient_id', uid)
        .order('scheduled_at', { ascending: false })
        .limit(3);
      if (data) {
        setAppointments(data.map((c: any) => ({
          id: c.id,
          scheduled_at: c.scheduled_at,
          status: c.status,
          notes: c.notes,
          doctor: {
            full_name: c.doctor?.full_name || 'Unknown Doctor',
            specialization: c.doctor?.specialization || 'General',
          },
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoadingAppts(false); }
  };

  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await locationService.getCurrentLocation();
      const { latitude, longitude } = loc.coords;
      const address = await locationService.getAddressFromCoordinates(latitude, longitude);
      setLocation({
        lat: `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`,
        lon: `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`,
        address: address?.formattedAddress || address?.name || 'Current Location',
      });
    } catch {
      setLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const shareLocation = () => {
    if (!location) { Alert.alert('Location unavailable', 'Enable location access first.'); return; }
    Alert.alert('Share Location', `Your location: ${location.address}\nLat: ${location.lat}, Lon: ${location.lon}`);
  };

  const formatApptDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' — ' + new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerIconCircle}>
          <Ionicons name="notifications" size={26} color="#fff" />
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSub}>Manage alerts</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {saving && <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />}
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* White Card */}
      <View style={s.whiteCard}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>

        {/* ── Notification Preferences ── */}
        <SectionCard
          icon={<Ionicons name="notifications" size={16} color={C.text} />}
          title="Notification Preferences"
        >
          <ToggleRow
            label="Push Notifications"
            sub="Receive alerts on your device"
            value={prefs.push}
            onChange={() => togglePref('push')}
            showDivider
          />
          <ToggleRow
            label="Email Notifications"
            sub="Get updates via email"
            value={prefs.email}
            onChange={() => togglePref('email')}
            showDivider
          />
          <ToggleRow
            label="SMS Alerts"
            sub="Text message reminders"
            value={prefs.sms}
            onChange={() => togglePref('sms')}
            showDivider
          />
          <ToggleRow
            label="Sound"
            sub="Play notification sounds"
            value={prefs.sound}
            onChange={() => togglePref('sound')}
            showDivider={false}
          />
        </SectionCard>

        {/* ── Appointment Record ── */}
        <SectionCard
          icon={<Ionicons name="calendar-outline" size={16} color={C.text} />}
          title="Appointment Record"
        >
          {loadingAppts ? (
            <ActivityIndicator color={C.dark} style={{ marginTop: 12 }} />
          ) : appointments.length === 0 ? (
            <View style={s.emptyRow}>
              <Text style={s.emptyText}>No appointments found</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {appointments.map(appt => (
                <View key={appt.id} style={s.apptRow}>
                  <View style={s.apptIconBox}>
                    <MaterialCommunityIcons
                      name={apptIcon(appt.doctor.specialization) as any}
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.apptName}>Dr. {appt.doctor.full_name}</Text>
                    <Text style={s.apptSpec}>{appt.doctor.specialization}</Text>
                    <Text style={s.apptDate}>{formatApptDate(appt.scheduled_at)}</Text>
                  </View>
                  {statusBadge(appt.status)}
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        {/* ── Real-Time Location ── */}
        <SectionCard
          icon={<Ionicons name="location" size={16} color={C.text} />}
          title="Real-Time Location"
          rightEl={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[s.liveDot, { backgroundColor: location ? C.teal : C.muted }]} />
              <Text style={s.liveText}>{location ? 'Live' : 'Offline'}</Text>
            </View>
          }
        >
          <View style={s.mapBox}>
            <View style={s.mapPin}>
              <View style={s.mapPinOuter}>
                <View style={s.mapPinInner}>
                  <Ionicons name="navigate" size={12} color="#FFFFFF" />
                </View>
              </View>
            </View>
            {location && (
              <View style={s.mapLabel}>
                <Ionicons name="location" size={12} color="#FFFFFF" />
                <Text style={s.mapLabelText} numberOfLines={1}>{location.address}</Text>
              </View>
            )}
            {locationLoading && (
              <View style={[s.mapLabel, { justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={s.coordsRow}>
            <View style={s.coordItem}>
              <Text style={s.coordLabel}>Latitude</Text>
              <Text style={s.coordValue}>{location?.lat ?? '—'}</Text>
            </View>
            <View style={s.coordDivider} />
            <View style={s.coordItem}>
              <Text style={s.coordLabel}>Longitude</Text>
              <Text style={s.coordValue}>{location?.lon ?? '—'}</Text>
            </View>
            <View style={s.coordDivider} />
            <View style={s.coordItem}>
              <Text style={s.coordLabel}>Accuracy</Text>
              <Text style={s.coordValue}>±5m</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={s.btnOutline} onPress={shareLocation}>
              <Ionicons name="share-outline" size={16} color={C.text} />
              <Text style={s.btnOutlineText}>Share Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDark} onPress={fetchLocation}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={s.btnDarkText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B7E8A' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  whiteCard: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },

  card: {
    borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 16, gap: 12, backgroundColor: C.bg,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: C.text },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: C.text },
  toggleSub: { fontSize: 12, color: C.muted },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },

  apptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
  },
  apptIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center',
  },
  apptName: { fontSize: 14, fontWeight: '500', color: C.text },
  apptSpec: { fontSize: 12, color: C.muted },
  apptDate: { fontSize: 12, color: C.muted },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeDark: { backgroundColor: C.dark },
  badgeLight: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  badgeText: { fontSize: 11, fontWeight: '500' },
  badgeTextDark: { color: '#FFFFFF' },
  badgeTextLight: { color: C.muted },

  mapBox: {
    height: 160, backgroundColor: C.surface, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    marginTop: 4,
  },
  mapPin: { alignItems: 'center', justifyContent: 'center' },
  mapPinOuter: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(23,23,23,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  mapPinInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center',
  },
  mapLabel: {
    position: 'absolute', bottom: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(23,23,23,0.7)', borderRadius: 8, padding: 8,
  },
  mapLabelText: { fontSize: 12, fontWeight: '500', color: '#FFFFFF', flex: 1 },

  coordsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
  },
  coordItem: { flex: 1, alignItems: 'center', gap: 4 },
  coordLabel: { fontSize: 11, color: C.muted },
  coordValue: { fontSize: 13, fontWeight: '500', color: C.text },
  coordDivider: { width: 1, height: 32, backgroundColor: C.border },

  btnOutline: {
    flex: 1, height: 36, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
  },
  btnOutlineText: { fontSize: 13, fontWeight: '500', color: C.text },
  btnDark: {
    flex: 1, height: 36, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    backgroundColor: C.dark, borderRadius: 8,
  },
  btnDarkText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },

  dot: { width: 12, height: 12, borderRadius: 6, position: 'absolute' },
  dotPulse: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.teal, opacity: 0.3, position: 'absolute',
  },

  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 12, color: C.muted },

  emptyRow: { paddingVertical: 12, alignItems: 'center' },
  emptyText: { fontSize: 13, color: C.muted },
});
