import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

const C = { bg: '#FFFFFF', surface: '#F5F7FA', text: '#171717', muted: '#555F6D', border: '#E2E8EF', teal: '#0B7E8A', tealLight: '#E6F5F5' };

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; route?: string; params?: any }> = {
  booking:       { icon: 'calendar',          color: C.teal,    bg: C.tealLight, route: 'Appointments' },
  message:       { icon: 'chatbubble',         color: '#8B5CF6', bg: '#F5F3FF',   route: 'Chat' },
  alert:         { icon: 'warning',            color: '#EF4444', bg: '#FEF2F2' },
  appointment:   { icon: 'calendar-outline',  color: C.teal,    bg: C.tealLight, route: 'Appointments' },
  record_shared: { icon: 'document-text',      color: '#F59E0B', bg: '#FFFBEB',   route: 'MedicalRecords' },
  default:       { icon: 'notifications',      color: C.muted,   bg: C.surface },
};

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('notifications').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(60);
      setNotifications(data || []);
      await supabase.from('notifications').update({ is_read: true })
        .eq('user_id', user.id).eq('is_read', false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadNotifications(); setRefreshing(false); };

  const handleTap = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.default;
    if (cfg.route) navigation.navigate(cfg.route, cfg.params);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso), now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const todayStr = new Date().toDateString();
  const today    = notifications.filter(n => new Date(n.created_at).toDateString() === todayStr);
  const earlier  = notifications.filter(n => new Date(n.created_at).toDateString() !== todayStr);
  const sections = [
    ...(today.length   > 0 ? [{ title: 'Today',   data: today   }] : []),
    ...(earlier.length > 0 ? [{ title: 'Earlier', data: earlier }] : []),
  ];
  const flatData = sections.flatMap(s => [{ _header: s.title }, ...s.data]);

  const renderItem = ({ item }: any) => {
    if (item._header) return <Text style={s.sectionHeader}>{item._header}</Text>;
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.default;
    return (
      <TouchableOpacity
        style={[s.item, !item.is_read && s.itemUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
      >
        <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
        <View style={s.content}>
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.message} numberOfLines={2}>{item.message}</Text>
          <Text style={s.time}>{formatTime(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={s.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />

      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={s.headerIconWrap}>
          <Ionicons name="notifications" size={26} color="#ffffff" />
        </View>
        <View style={s.headerTitles}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSubtitle}>Stay in the loop</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.card}>
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ flex: 1 }} />
        ) : flatData.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={40} color={C.teal} />
            </View>
            <Text style={s.emptyText}>No notifications yet</Text>
            <Text style={s.emptySub}>You'll see booking updates and messages here</Text>
          </View>
        ) : (
          <FlatList
            data={flatData}
            keyExtractor={(item, i) => item.id || `header-${i}`}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 }}
          />
        )}
      </View>
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

  // Section header
  sectionHeader: { fontSize: 12, fontWeight: '700', color: C.muted, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Item
  item:       { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  itemUnread: { backgroundColor: C.tealLight },
  iconBox:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content:    { flex: 1, gap: 3 },
  title:      { fontSize: 14, fontWeight: '600', color: C.text },
  message:    { fontSize: 13, color: C.muted, lineHeight: 18 },
  time:       { fontSize: 11, color: C.muted },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal, marginTop: 6, flexShrink: 0 },

  // Empty
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.tealLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText:    { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub:     { fontSize: 13, color: C.muted, textAlign: 'center', maxWidth: 240 },
});
