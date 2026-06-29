import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const C = { bg:'#FFFFFF', surface:'#F5F5F5', text:'#171717', muted:'#737373', border:'#E5E5E5', teal:'#0B7E8A' };

type Settings = {
  profile_visible: boolean;
  share_health_data: boolean;
  two_factor_enabled: boolean;
  data_analytics: boolean;
  location_sharing: boolean;
};

const DEFAULT: Settings = {
  profile_visible: true,
  share_health_data: false,
  two_factor_enabled: false,
  data_analytics: true,
  location_sharing: false,
};

export default function PrivacySettingsScreen({ navigation }: any) {
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          profile_visible: data.profile_visible ?? DEFAULT.profile_visible,
          share_health_data: data.share_health_data ?? DEFAULT.share_health_data,
          two_factor_enabled: data.two_factor_enabled ?? DEFAULT.two_factor_enabled,
          data_analytics: data.data_analytics ?? DEFAULT.data_analytics,
          location_sharing: data.location_sharing ?? DEFAULT.location_sharing,
        });
      } else {
        // create default row
        const { data:{ user: u } } = await supabase.auth.getUser();
        if (u) await supabase.from('privacy_settings').insert({ user_id: u.id, ...DEFAULT });
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggle = async (key: keyof Settings) => {
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    setSaving(key);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('privacy_settings')
        .upsert({ user_id: user.id, [key]: newVal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch(e) {
      // revert on failure
      setSettings(prev => ({ ...prev, [key]: !newVal }));
      Alert.alert('Error', 'Failed to save setting');
    } finally { setSaving(null); }
  };

  const handleChangePassword = () => {
    Alert.alert('Change Password', 'A password reset link will be sent to your email.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Link', onPress: async () => {
        const { data:{ user } } = await supabase.auth.getUser();
        if (!user?.email) return;
        const { error } = await supabase.auth.resetPasswordForEmail(user.email);
        Alert.alert(error ? 'Error' : 'Email Sent', error ? error.message : `Reset link sent to ${user.email}`);
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This will permanently delete all your data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =>
        Alert.alert('Contact Support', 'Please email mayoru24@gmail.com with subject "Delete Account" to complete this request.') },
    ]);
  };

  const privacyToggles = [
    { key: 'profile_visible' as const, icon: 'eye-outline', label: 'Profile Visibility', desc: 'Allow doctors & hospitals to search your profile' },
    { key: 'share_health_data' as const, icon: 'share-outline', label: 'Share Health Data', desc: 'Share anonymised data for medical research' },
    { key: 'two_factor_enabled' as const, icon: 'shield-checkmark-outline', label: 'Two-Factor Auth', desc: 'Require email confirmation on new sign-ins' },
    { key: 'data_analytics' as const, icon: 'bar-chart-outline', label: 'Usage Analytics', desc: 'Help improve the app with anonymous usage data' },
    { key: 'location_sharing' as const, icon: 'location-outline', label: 'Location Sharing', desc: 'Auto-sort nearby hospitals & doctors by distance' },
  ];

  const securityActions = [
    { icon: 'key-outline', label: 'Change Password', desc: 'Update your account password', onPress: handleChangePassword },
    { icon: 'document-text-outline', label: 'Privacy Policy', desc: 'Read how we handle your data', onPress: () => Linking.openURL('https://hbridge.app/privacy') },
    { icon: 'newspaper-outline', label: 'Terms of Service', desc: 'View terms and conditions', onPress: () => Linking.openURL('https://hbridge.app/terms') },
    { icon: 'lock-closed-outline', label: 'Data Export', desc: 'Request a copy of your data', onPress: () => Alert.alert('Data Export', 'Your data export will be emailed to you within 48 hours.') },
  ];

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerIconCircle}>
            <Ionicons name="shield-checkmark" size={26} color="#fff" />
          </View>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Privacy Settings</Text>
            <Text style={s.headerSub}>Control your data</Text>
          </View>
        </View>
        <View style={s.whiteCard}>
          <ActivityIndicator color={C.teal} style={{flex:1}} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7E8A" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerIconCircle}>
          <Ionicons name="shield-checkmark" size={26} color="#fff" />
        </View>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Privacy Settings</Text>
          <Text style={s.headerSub}>Control your data</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={s.whiteCard}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:40}}>

        {/* Privacy Toggles */}
        <View style={s.sectionLabel}><Text style={s.sectionLabelText}>PRIVACY</Text></View>
        <View style={s.card}>
          {privacyToggles.map((item, i) => (
            <View key={item.key}>
              <View style={s.row}>
                <View style={s.rowIcon}>
                  <Ionicons name={item.icon as any} size={20} color={C.teal} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowLabel}>{item.label}</Text>
                  <Text style={s.rowDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={settings[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: C.border, true: C.teal + '60' }}
                  thumbColor={settings[item.key] ? C.teal : '#ccc'}
                  disabled={saving === item.key}
                />
              </View>
              {i < privacyToggles.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

        {/* Security Actions */}
        <View style={s.sectionLabel}><Text style={s.sectionLabelText}>SECURITY</Text></View>
        <View style={s.card}>
          {securityActions.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity style={s.row} onPress={item.onPress}>
                <View style={s.rowIcon}>
                  <Ionicons name={item.icon as any} size={20} color={C.teal} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowLabel}>{item.label}</Text>
                  <Text style={s.rowDesc}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </TouchableOpacity>
              {i < securityActions.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

        {/* Delete Account */}
        <View style={s.sectionLabel}><Text style={s.sectionLabelText}>DANGER ZONE</Text></View>
        <View style={s.dangerCard}>
          <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
            <View style={s.dangerIcon}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </View>
            <View style={s.rowBody}>
              <Text style={s.dangerLabel}>Delete Account</Text>
              <Text style={s.rowDesc}>Permanently delete your account and all data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0B7E8A' },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:12, paddingBottom:20, gap:14 },
  backBtn: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  headerIconCircle: { width:56, height:56, borderRadius:28, backgroundColor:'rgba(255,255,255,0.2)', borderWidth:1, borderColor:'rgba(255,255,255,0.4)', alignItems:'center', justifyContent:'center' },
  headerCenter: { flex:1 },
  headerTitle: { fontSize:26, fontWeight:'700', color:'#fff', letterSpacing:-0.3 },
  headerSub: { fontSize:14, color:'rgba(255,255,255,0.75)', marginTop:2 },
  whiteCard: { flex:1, backgroundColor:'#ffffff', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden' },
  sectionLabel: { paddingHorizontal:24, paddingTop:20, paddingBottom:8 },
  sectionLabelText: { fontSize:11, fontWeight:'700', color:C.muted, letterSpacing:1 },
  card: { marginHorizontal:16, backgroundColor:C.bg, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  dangerCard: { marginHorizontal:16, backgroundColor:C.bg, borderRadius:16, borderWidth:1, borderColor:'#fecaca', overflow:'hidden' },
  row: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, gap:14 },
  rowIcon: { width:38, height:38, borderRadius:10, backgroundColor:'#E6F5F5', alignItems:'center', justifyContent:'center', flexShrink:0 },
  dangerIcon: { width:38, height:38, borderRadius:10, backgroundColor:'#fee2e2', alignItems:'center', justifyContent:'center', flexShrink:0 },
  rowBody: { flex:1, gap:2 },
  rowLabel: { fontSize:15, fontWeight:'600', color:C.text },
  dangerLabel: { fontSize:15, fontWeight:'600', color:'#EF4444' },
  rowDesc: { fontSize:12, color:C.muted },
  divider: { height:1, backgroundColor:C.border, marginLeft:68 },
});
