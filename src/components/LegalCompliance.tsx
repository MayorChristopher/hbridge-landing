import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../utils/design';

interface MedicalDisclaimerProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function MedicalDisclaimer({ visible, onAccept, onDecline }: MedicalDisclaimerProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="medical" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Medical Disclaimer</Text>
          <Text style={styles.subtitle}>Important Information</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Not a Medical Device</Text>
            <Text style={styles.text}>
              Hbridge is NOT a medical device, diagnostic tool, or replacement for professional medical care. 
              This application provides general health information and connects you with healthcare professionals.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏥 For Medical Emergencies</Text>
            <Text style={styles.text}>
              In case of medical emergencies, ALWAYS call 112 (Nigeria's emergency number) or visit the nearest hospital immediately. 
              Do not rely solely on this app for emergency medical decisions.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤖 AI Limitations</Text>
            <Text style={styles.text}>
              Our AI assistant can make mistakes and may provide incorrect or incomplete information. 
              All AI responses are for informational purposes only and should not be considered medical advice.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👨‍⚕️ Professional Medical Advice</Text>
            <Text style={styles.text}>
              Always consult qualified healthcare professionals for proper diagnosis, treatment, and medical decisions. 
              This app facilitates connections with licensed doctors but does not provide medical diagnoses.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔒 Privacy & Data</Text>
            <Text style={styles.text}>
              Your health information is encrypted and protected. We follow strict privacy standards and do not share 
              your personal medical data with third parties without your explicit consent.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚖️ Liability</Text>
            <Text style={styles.text}>
              The creators and operators of Hbridge assume no liability for any harm, injury, or adverse outcomes 
              resulting from the use of this application. Use at your own risk and judgment.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🇳🇬 Nigerian Healthcare Context</Text>
            <Text style={styles.text}>
              This app is designed for the Nigerian healthcare system. Information provided may not be applicable 
              to other countries' medical practices or regulations.
            </Text>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="warning" size={24} color={colors.error} />
            <Text style={styles.warningText}>
              By using Hbridge, you acknowledge that you understand these limitations and agree to use 
              the app responsibly as a supplementary health information tool only.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
            <Text style={styles.declineText}>I Do Not Agree</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Text style={styles.acceptText}>I Understand & Agree</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function PrivacyPolicy() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Text style={styles.linkText}>Privacy Policy</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Privacy Policy</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.text}>
              <Text style={styles.bold}>Last Updated:</Text> {new Date().toLocaleDateString()}
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Information We Collect</Text>
              <Text style={styles.text}>
                • Account information (name, email, phone number){'\n'}
                • Health information you voluntarily provide{'\n'}
                • Usage data and app interactions{'\n'}
                • Location data (with your permission){'\n'}
                • Device information for security purposes
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How We Use Your Information</Text>
              <Text style={styles.text}>
                • Provide healthcare services and AI assistance{'\n'}
                • Connect you with healthcare professionals{'\n'}
                • Improve our services and user experience{'\n'}
                • Send important notifications and updates{'\n'}
                • Ensure platform security and prevent fraud
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Data Protection</Text>
              <Text style={styles.text}>
                • All health data is encrypted in transit and at rest{'\n'}
                • We follow international healthcare data standards{'\n'}
                • Regular security audits and updates{'\n'}
                • Limited access on a need-to-know basis{'\n'}
                • Secure data centers with backup systems
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Rights</Text>
              <Text style={styles.text}>
                • Access your personal data{'\n'}
                • Correct inaccurate information{'\n'}
                • Delete your account and data{'\n'}
                • Export your health records{'\n'}
                • Opt-out of non-essential communications
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

export function TermsOfService() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Text style={styles.linkText}>Terms of Service</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms of Service</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
              <Text style={styles.text}>
                By using Hbridge, you agree to these terms and conditions. 
                If you do not agree, please do not use our services.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Permitted Use</Text>
              <Text style={styles.text}>
                • Use the app for legitimate healthcare information{'\n'}
                • Provide accurate information about yourself{'\n'}
                • Respect other users and healthcare professionals{'\n'}
                • Follow all applicable laws and regulations{'\n'}
                • Use the service responsibly and ethically
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prohibited Activities</Text>
              <Text style={styles.text}>
                • Misuse the AI system for non-medical purposes{'\n'}
                • Share false or misleading health information{'\n'}
                • Attempt to hack or compromise the system{'\n'}
                • Use the platform for illegal activities{'\n'}
                • Impersonate healthcare professionals
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Terms</Text>
              <Text style={styles.text}>
                • Consultation fees are clearly displayed{'\n'}
                • Payments are processed securely through Paystack{'\n'}
                • Refunds available according to our refund policy{'\n'}
                • No hidden fees or charges{'\n'}
                • Receipts provided for all transactions
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginVertical: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error + '30',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginVertical: spacing.lg,
  },
  warningText: {
    ...typography.body,
    color: colors.error,
    marginLeft: spacing.md,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  declineButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  declineText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  acceptText: {
    ...typography.button,
    color: colors.textInverse,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});