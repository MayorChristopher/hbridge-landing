import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Modal, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

const C = { bg:'#F5F3EE', surface:'#EDE9E0', card:'#FFFFFF', text:'#0C2E30', muted:'#6B7E7F', border:'#EAE5DA', teal:'#0B7E8A', tealLight:'rgba(11,126,138,0.09)' };

const PRIVACY_SECTIONS = [
  { heading: 'Last updated: July 2026', body: '' },
  { heading: '1. Who We Are', body: 'Hbridge (hbridge.ng) is a Nigerian digital health platform connecting patients with verified doctors and hospitals. We are committed to protecting your personal health information.\n\nContact: hbridgenigeria@gmail.com' },
  { heading: '2. Information We Collect', body: '• Personal details: name, email, phone number, date of birth\n• Health data: medical history, symptoms, prescriptions, lab results\n• Device data: device type, OS version, app usage analytics\n• Location data (only if you grant permission)' },
  { heading: '3. How We Use Your Data', body: '• To connect you with verified healthcare providers\n• To maintain your medical records securely\n• To improve the Hbridge platform\n• To send you appointment reminders and health updates\n\nWe never sell your data to third parties.' },
  { heading: '4. Data Security', body: 'Your data is encrypted in transit (TLS) and at rest. We follow industry best practices aligned with healthcare data protection standards. Access to your health records is strictly controlled and limited to authorised practitioners you engage with.' },
  { heading: '5. Sharing Your Data', body: 'Your health data is only shared with:\n• Doctors or hospitals you book through Hbridge\n• Service providers essential to running the platform (e.g. cloud storage, authentication)\n\nWe obtain your consent before any other sharing.' },
  { heading: '6. Your Rights', body: 'You have the right to:\n• Access your personal data\n• Correct inaccurate information\n• Request deletion of your account and data\n• Withdraw consent at any time\n\nTo exercise any right, email hbridgenigeria@gmail.com.' },
  { heading: '7. Cookies & Analytics', body: 'We use anonymous analytics to understand how users interact with the app so we can improve it. You can opt out in Privacy Settings.' },
  { heading: '8. Children', body: 'Hbridge is not intended for users under 16 years of age. If you believe a child has registered, contact us immediately.' },
  { heading: '9. Changes', body: 'We may update this policy. We will notify you of significant changes via email or in-app notification.' },
  { heading: '10. Contact', body: 'Hbridge\nhbridge.ng\nhbridgenigeria@gmail.com' },
];

const TERMS_SECTIONS = [
  { heading: 'Last updated: July 2026', body: '' },
  { heading: '1. Acceptance', body: 'By using Hbridge, you agree to these Terms of Service. If you do not agree, please do not use the platform.' },
  { heading: '2. The Platform', body: 'Hbridge provides a digital marketplace connecting patients with independent healthcare providers. We are a technology platform, not a healthcare provider. All medical decisions are made by the licensed practitioners you engage.' },
  { heading: '3. Eligibility', body: 'You must be at least 16 years old to use Hbridge. By registering, you confirm you meet this requirement.' },
  { heading: '4. User Responsibilities', body: '• Provide accurate personal and health information\n• Keep your account credentials secure\n• Use the platform lawfully and respectfully\n• Not misuse or attempt to manipulate the platform' },
  { heading: '5. Doctor / Practitioner Terms', body: 'Practitioners on Hbridge must:\n• Hold valid Nigerian medical licences\n• Provide accurate credential information\n• Agree to Hbridge\'s practitioner payment split (15% platform fee, 85% to practitioner)\n• Maintain professional conduct at all times' },
  { heading: '6. Payments', body: 'Consultation fees are set by practitioners and displayed clearly before booking. Payments are processed securely via Paystack. Hbridge retains 15% as a platform fee. Refunds are handled case-by-case — contact hbridgenigeria@gmail.com.' },
  { heading: '7. Medical Disclaimer', body: 'Hbridge is not a substitute for emergency medical care. In a medical emergency, call 112 or go to your nearest hospital. The platform does not guarantee specific medical outcomes.' },
  { heading: '8. Intellectual Property', body: 'All content, branding, and technology on Hbridge is owned by Hbridge and may not be copied or used without permission.' },
  { heading: '9. Limitation of Liability', body: 'To the extent permitted by law, Hbridge is not liable for any indirect or consequential losses arising from your use of the platform.' },
  { heading: '10. Governing Law', body: 'These terms are governed by the laws of the Federal Republic of Nigeria.' },
  { heading: '11. Contact', body: 'Hbridge\nhbridge.ng\nhbridgenigeria@gmail.com' },
];

function PolicyText({ sections }: { sections: { heading: string; body: string }[] }) {
  return (
    <View style={{ gap: 16 }}>
      {sections.map((sec, i) => (
        <View key={i}>
          {sec.heading ? <Text style={{ fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#0C2E30', marginBottom: sec.body ? 4 : 0 }}>{sec.heading}</Text> : null}
          {sec.body ? <Text style={{ fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: '#5C6B69', lineHeight: 20 }}>{sec.body}</Text> : null}
        </View>
      ))}
    </View>
  );
}

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
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [policyType, setPolicyType] = useState<'privacy' | 'terms' | null>(null);

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
    // Two-factor auth requires server-side enrollment — inform user
    if (key === 'two_factor_enabled') {
      toast.showInfo('Two-Factor Auth', 'To enable 2FA, go to your email provider and set up two-step verification. We will support in-app TOTP soon.');
      return;
    }

    // Location sharing — request permission when turning on
    if (key === 'location_sharing' && !settings.location_sharing) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.showError('Permission Denied', 'Location permission is required to enable this feature.');
        return;
      }
    }

    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    setSaving(key);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('privacy_settings')
        .upsert({ user_id: user.id, [key]: newVal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch(e) {
      setSettings(prev => ({ ...prev, [key]: !newVal }));
      toast.showError('Save Failed', 'Failed to save setting. Please try again.');
    } finally { setSaving(null); }
  };

  const handleChangePassword = () => setShowChangePassword(true);

  const doSendResetLink = async () => {
    setSendingReset(true);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      setShowChangePassword(false);
      if (error) toast.showError('Error', error.message);
      else toast.showSuccess('Email Sent', `Reset link sent to ${user.email}`);
    } finally { setSendingReset(false); }
  };

  const handleDeleteAccount = () => setShowDeleteAccount(true);

  const doDeleteAccount = () => {
    setShowDeleteAccount(false);
    toast.showInfo('Contact Support', 'Please email hbridgenigeria@gmail.com with subject "Delete Account" to complete this request.');
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
    { icon: 'document-text-outline', label: 'Privacy Policy', desc: 'Read how we handle your data', onPress: () => setPolicyType('privacy') },
    { icon: 'newspaper-outline', label: 'Terms of Service', desc: 'View terms and conditions', onPress: () => setPolicyType('terms') },
    { icon: 'lock-closed-outline', label: 'Data Export', desc: 'Request a copy of your data', onPress: () => toast.showInfo('Data Export', 'Your data export will be emailed to hbridgenigeria@gmail.com within 48 hours.') },
  ];

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#083236" />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
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
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Teal Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
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

      {/* Change Password Sheet */}
      <Modal visible={showChangePassword} transparent animationType="slide" onRequestClose={() => setShowChangePassword(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Change Password</Text>
            <Text style={s.sheetBody}>A password reset link will be sent to your registered email address.</Text>
            <TouchableOpacity style={s.sheetConfirmBtn} onPress={doSendResetLink} disabled={sendingReset}>
              {sendingReset
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.sheetConfirmText}>Send Reset Link</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowChangePassword(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy / Terms Modal */}
      <Modal visible={!!policyType} transparent animationType="slide" onRequestClose={() => setPolicyType(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '88%', paddingBottom: 0 }]}>
            <View style={s.sheetHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[s.sheetTitle, { flex: 1, textAlign: 'left' }]}>
                {policyType === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </Text>
              <TouchableOpacity onPress={() => setPolicyType(null)}>
                <Ionicons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
              {policyType === 'privacy' ? (
                <PolicyText sections={PRIVACY_SECTIONS} />
              ) : (
                <PolicyText sections={TERMS_SECTIONS} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Account Sheet */}
      <Modal visible={showDeleteAccount} transparent animationType="slide" onRequestClose={() => setShowDeleteAccount(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Delete Account</Text>
            <Text style={s.sheetBody}>This will permanently delete all your data. This cannot be undone.</Text>
            <TouchableOpacity style={s.sheetDestructiveBtn} onPress={doDeleteAccount}>
              <Text style={s.sheetDestructiveText}>Delete My Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowDeleteAccount(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#083236' },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:12, paddingBottom:28, gap:14 },
  backBtn: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' },
  headerIconCircle: { width:52, height:52, borderRadius:26, backgroundColor:'rgba(255,255,255,0.18)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.3)', alignItems:'center', justifyContent:'center' },
  headerCenter: { flex:1 },
  headerTitle: { fontSize:26, fontFamily:'Montserrat_800ExtraBold', color:'#fff', letterSpacing:-0.5 },
  headerSub: { fontSize:13, fontFamily:'SpaceGrotesk_400Regular', color:'rgba(255,255,255,0.70)', marginTop:2 },
  whiteCard: { flex:1, backgroundColor:C.bg, borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden' },
  sectionLabel: { paddingHorizontal:24, paddingTop:20, paddingBottom:8 },
  sectionLabelText: { fontSize:11, fontFamily:'Montserrat_700Bold', color:C.muted, letterSpacing:1.2, textTransform:'uppercase' },
  card: { marginHorizontal:16, backgroundColor:C.card, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  dangerCard: { marginHorizontal:16, backgroundColor:C.card, borderRadius:16, borderWidth:1, borderColor:'#fecaca', overflow:'hidden' },
  row: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, gap:14 },
  rowIcon: { width:38, height:38, borderRadius:10, backgroundColor:C.tealLight, alignItems:'center', justifyContent:'center', flexShrink:0 },
  dangerIcon: { width:38, height:38, borderRadius:10, backgroundColor:'#fee2e2', alignItems:'center', justifyContent:'center', flexShrink:0 },
  rowBody: { flex:1, gap:2 },
  rowLabel: { fontSize:15, fontFamily:'Montserrat_600SemiBold', color:C.text },
  dangerLabel: { fontSize:15, fontFamily:'Montserrat_600SemiBold', color:'#EF4444' },
  rowDesc: { fontSize:12, fontFamily:'SpaceGrotesk_400Regular', color:C.muted },
  divider: { height:1, backgroundColor:C.border, marginLeft:68 },
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  sheet: { backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:36, gap:12 },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:'center', marginBottom:8 },
  sheetTitle: { fontSize:18, fontFamily:'Montserrat_700Bold', color:C.text, textAlign:'center' },
  sheetBody: { fontSize:14, fontFamily:'SpaceGrotesk_400Regular', color:C.muted, textAlign:'center', lineHeight:20 },
  sheetConfirmBtn: { backgroundColor:C.teal, borderRadius:12, paddingVertical:14, alignItems:'center' },
  sheetConfirmText: { fontSize:15, fontFamily:'Montserrat_600SemiBold', color:'#fff' },
  sheetDestructiveBtn: { backgroundColor:'#EF4444', borderRadius:12, paddingVertical:14, alignItems:'center' },
  sheetDestructiveText: { fontSize:15, fontFamily:'Montserrat_600SemiBold', color:'#fff' },
  sheetCancelBtn: { borderRadius:12, paddingVertical:14, alignItems:'center', backgroundColor:C.surface },
  sheetCancelText: { fontSize:15, fontFamily:'Montserrat_600SemiBold', color:C.muted },
});
