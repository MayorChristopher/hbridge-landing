import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius } from '../utils/design';
import { SUBSCRIPTION_PLANS } from '../config/subscriptions';
import { Toast } from '../utils/toast';

const TEAL = '#0B7E8A';

// Temporarily disable Paystack until properly installed
// import { Paystack } from 'react-native-paystack-webview';

export default function SubscriptionScreen({ route, navigation }: any) {
  const { userType } = route.params || { userType: 'patient' };
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
      setUser(data);
    }
  };

  const plans = userType === 'patient' ? SUBSCRIPTION_PLANS.patient : SUBSCRIPTION_PLANS.doctor;

  const handleSubscribe = async (planId: string) => {
    Toast.showInfo('Payment Integration', 'Paystack integration will be enabled once properly configured.');
    // setSelectedPlan(planId);
  };

  const handlePaymentSuccess = async (response: any) => {
    try {
      const plan = selectedPlan === 'patient_premium' ? plans.premium : plans.pro;
      
      await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan_id: selectedPlan,
        status: 'active',
        amount: plan.price,
        payment_reference: response.reference,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      await supabase.from('profiles').update({
        subscription_plan: selectedPlan,
        subscription_status: 'active'
      }).eq('id', user.id);

      Toast.showSuccess('Subscription Active', 'Your premium plan is now active!');
      navigation.goBack();
    } catch (error) {
      console.error('Subscription error:', error);
      Toast.showError('Subscription Failed', 'Please contact support.');
    }
    setSelectedPlan(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerIconWrap}>
          <Ionicons name="star" size={26} color="#ffffff" />
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Upgrade Plan</Text>
          <Text style={styles.headerSubtitle}>Choose the plan that works for you</Text>
        </View>
      </View>

      <View style={styles.card}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ height: 16 }} />
        {Object.entries(plans).map(([key, plan]: [string, any]) => (
          <View key={key} style={[styles.planCard, plan.price > 0 && styles.premiumCard]}>
            {plan.price > 0 && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>POPULAR</Text>
              </View>
            )}
            
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.currency}>₦</Text>
              <Text style={styles.price}>{plan.price.toLocaleString()}</Text>
              {plan.interval && <Text style={styles.interval}>/{plan.interval}</Text>}
            </View>

            {plan.commission !== undefined && (
              <Text style={styles.commission}>{plan.commission}% Platform Commission</Text>
            )}

            <View style={styles.features}>
              {plan.features.map((feature: string, index: number) => (
                <View key={index} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {plan.price > 0 ? (
              <TouchableOpacity 
                style={styles.subscribeButton}
                onPress={() => handleSubscribe(plan.id)}
              >
                <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.currentPlanButton}>
                <Text style={styles.currentPlanText}>Current Plan</Text>
              </View>
            )}
          </View>
        ))}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Cancel anytime. No hidden fees. Secure payment with Paystack.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Paystack component temporarily disabled */}
      {/* {selectedPlan && user && (
        <Paystack
          paystackKey="pk_live_bffbf95e5e25d5d56521b8619c35923e4553ac1f"
          amount={(selectedPlan === 'patient_premium' ? 5000 : 10000) * 100}
          billingEmail={user.email}
          billingName={user.full_name}
          channels={['card', 'bank', 'ussd', 'bank_transfer']}
          onCancel={() => setSelectedPlan(null)}
          onSuccess={handlePaymentSuccess}
          autoStart={true}
        />
      )} */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TEAL,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  card: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    position: 'relative',
  },
  premiumCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '05',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  popularText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 10,
  },
  planName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  currency: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  price: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  interval: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  commission: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  features: {
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  subscribeButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  currentPlanButton: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  currentPlanText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  infoText: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
  },
});
