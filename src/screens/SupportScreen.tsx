import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius } from '../utils/design';
import { useToast } from '../components/ToastProvider';

export default function SupportScreen({ navigation }: any) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('help');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    if (activeTab === 'tickets') {
      loadTickets();
    }
  }, [activeTab]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitTicket = async () => {
    if (!title.trim() || !description.trim()) {
      toast.showWarning('Required Fields', 'Please fill in all required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'open'
      });

      if (error) throw error;

      toast.showSuccess('Ticket Submitted', 'We\'ll get back to you soon.');
      setTitle('');
      setDescription('');
      setCategory('technical');
      setPriority('medium');
      loadTickets();
    } catch (error) {
      toast.showError('Submission Failed', 'Please try again.');
    }
  };

  const helpTopics = [
    {
      icon: 'heart-outline',
      title: 'Using AI Health Assistant',
      description: 'Learn how to get accurate health advice from our AI',
      action: () => navigation.navigate('Chat')
    },
    {
      icon: 'search-outline',
      title: 'Finding Doctors & Hospitals',
      description: 'Search and filter healthcare providers near you',
      action: () => navigation.navigate('Search')
    },
    {
      icon: 'calendar-outline',
      title: 'Booking Consultations',
      description: 'Schedule appointments with verified doctors',
      action: () => {}
    },
    {
      icon: 'alert-circle-outline',
      title: 'Emergency Services',
      description: 'Quick access to emergency help and nearest hospitals',
      action: () => navigation.navigate('Emergency')
    }
  ];

  const contactMethods = [
    {
      icon: 'call',
      title: 'Emergency Hotline',
      subtitle: '24/7 Medical Emergency',
      value: '112',
      action: () => Linking.openURL('tel:112')
    },
    {
      icon: 'mail',
      title: 'Email Support',
      subtitle: 'General inquiries and support',
      value: 'support@hbridge.com',
      action: () => Linking.openURL('mailto:support@hbridge.com')
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Teal Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerIconCircle}>
          <Ionicons name="help-circle" size={26} color="#fff" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSub}>We're here to help</Text>
        </View>
      </View>

      {/* White Card */}
      <View style={styles.whiteCard}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'help' && styles.tabActive]}
          onPress={() => setActiveTab('help')}
        >
          <Ionicons name="help-circle" size={20} color={activeTab === 'help' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'help' && styles.tabTextActive]}>Help</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'contact' && styles.tabActive]}
          onPress={() => setActiveTab('contact')}
        >
          <Ionicons name="call" size={20} color={activeTab === 'contact' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'contact' && styles.tabTextActive]}>Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tickets' && styles.tabActive]}
          onPress={() => setActiveTab('tickets')}
        >
          <Ionicons name="ticket" size={20} color={activeTab === 'tickets' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'tickets' && styles.tabTextActive]}>Tickets</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'help' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How can we help you?</Text>
            {helpTopics.map((topic, index) => (
              <TouchableOpacity key={index} style={styles.helpCard} onPress={topic.action}>
                <View style={styles.helpIcon}>
                  <Ionicons name={topic.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.helpContent}>
                  <Text style={styles.helpTitle}>{topic.title}</Text>
                  <Text style={styles.helpDescription}>{topic.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'contact' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Get in touch</Text>
            {contactMethods.map((method, index) => (
              <TouchableOpacity key={index} style={styles.contactCard} onPress={method.action}>
                <View style={styles.contactIcon}>
                  <Ionicons name={method.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactTitle}>{method.title}</Text>
                  <Text style={styles.contactSubtitle}>{method.subtitle}</Text>
                  <Text style={styles.contactValue}>{method.value}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.ticketForm}>
              <Text style={styles.formTitle}>Submit a Support Ticket</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Brief description of your issue"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Please provide detailed information about your issue"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={submitTicket}>
                <Text style={styles.submitText}>Submit Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'tickets' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Support Tickets</Text>
            {tickets.length > 0 ? (
              tickets.map((ticket) => (
                <View key={ticket.id} style={styles.ticketCard}>
                  <Text style={styles.ticketTitle}>{ticket.title}</Text>
                  <Text style={styles.ticketDescription}>{ticket.description}</Text>
                  <Text style={styles.ticketDate}>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="ticket" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No support tickets yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#083236',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 26, fontFamily: 'Montserrat_700Bold', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  whiteCard: { flex: 1, backgroundColor: '#F5F3EE', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  helpIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  helpDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  contactSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  contactValue: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  ticketForm: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitText: {
    ...typography.body,
    color: colors.textInverse,
    fontWeight: '700',
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  ticketTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  ticketDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ticketDate: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});