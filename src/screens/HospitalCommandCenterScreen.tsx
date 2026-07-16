import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Dimensions, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../utils/design';
import { Toast } from '../utils/toast';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

export default function HospitalCommandCenterScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [emergencyAlert, setEmergencyAlert] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: hospitalProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(hospitalProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  
  const [newBookings] = useState([
    { id: '1', name: 'Sarah Lee', time: '1:00 PM - 1:30 PM', date: '20 Oct', status: 'pending' },
    { id: '2', name: 'Sarah Lee', time: '1:00 PM - 1:30 PM', date: '20 Oct', status: 'reschedule' },
    { id: '3', name: 'Soela Sharma', time: '10:00 AM - 1:30 PM', date: '20 Oct', status: 'pending' },
    { id: '4', name: 'Andser Tee', time: '1:00 PM - 1:30 PM', date: '20 Oct', status: 'pending' },
    { id: '5', name: 'Rnowr Slams', time: '1:00 PM - 1:30 PM', date: '20 Oct', status: 'pending' },
    { id: '6', name: 'Uned Fmi', time: '1:00 PM - 1:30 PM', date: '20 Oct', status: 'pending' },
  ]);

  const [doctors] = useState([
    { id: '1', name: 'Dr. Anya Sharma', specialty: 'Pediatrician', avatar: null, status: 'online' },
    { id: '2', name: 'Dr. Anya Sharma', specialty: 'Pediatrician', avatar: null, status: 'online' },
    { id: '3', name: 'Dr. Andersed', specialty: 'Cardiologist', avatar: null, status: 'message' },
  ]);

  const handleAcceptBooking = (bookingId: string) => {
    Toast.showSuccess('Booking Accepted', 'Patient has been notified');
  };

  const handleRescheduleBooking = (bookingId: string) => {
    Toast.showInfo('Reschedule', 'Opening reschedule options');
  };

  const handleConnectDoctor = (doctorId: string) => {
    Toast.showInfo('Connecting', 'Initiating connection with doctor');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#083236" />
      {/* Emergency Alert */}
      {emergencyAlert && (
        <View style={styles.emergencyAlert}>
          <View style={styles.emergencyContent}>
            <Ionicons name="medical" size={20} color={colors.textInverse} />
            <Text style={styles.emergencyText}>Emergency Booking: Tap to Accept</Text>
          </View>
          <TouchableOpacity 
            style={styles.acceptEmergencyButton}
            onPress={() => setEmergencyAlert(false)}
          >
            <Text style={styles.acceptEmergencyText}>Accept Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.closeEmergency}
            onPress={() => setEmergencyAlert(false)}
          >
            <Ionicons name="close" size={16} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} />
            ) : (
              <View style={styles.defaultProfileImage}>
                <Ionicons name="business" size={24} color={colors.textInverse} />
              </View>
            )}
          </View>
          <View style={styles.greetingSection}>
            <Text style={styles.headerTitle}>{getGreeting()}</Text>
            <Text style={styles.hospitalName}>{profile?.full_name || 'Hospital Admin'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.mainContent, isTablet && styles.tabletLayout]}>
          {/* New Patient Bookings */}
          <View style={[styles.section, isTablet && styles.leftSection]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Our Connected Patients</Text>
              <View style={styles.connectedIndicator}>
                <View style={styles.onlineIndicator} />
                <Text style={styles.connectedCount}>24 Online</Text>
              </View>
            </View>
            <ScrollView style={styles.bookingsList} nestedScrollEnabled>
              {newBookings.map((booking) => (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingInfo}>
                    <View style={styles.patientAvatar}>
                      <Ionicons name="person" size={20} color={colors.primary} />
                      <View style={styles.patientOnlineIndicator} />
                    </View>
                    <View style={styles.bookingDetails}>
                      <Text style={styles.patientName}>{booking.name}</Text>
                      <Text style={styles.bookingTime}>{booking.date} • {booking.time}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.bookingActionButton,
                      booking.status === 'reschedule' ? styles.rescheduleButton : styles.acceptButton
                    ]}
                    onPress={() => booking.status === 'reschedule' 
                      ? handleRescheduleBooking(booking.id)
                      : handleAcceptBooking(booking.id)
                    }
                  >
                    <Text style={styles.bookingActionText}>
                      {booking.status === 'reschedule' ? 'Reschedule' : 'Accept'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Contact Doctors */}
          <View style={[styles.section, isTablet && styles.rightSection]}>
            <Text style={styles.sectionTitle}>Contact Doctors</Text>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.doctorsList} nestedScrollEnabled>
              {doctors.map((doctor) => (
                <View key={doctor.id} style={styles.doctorCard}>
                  <View style={styles.doctorInfo}>
                    <View style={styles.doctorAvatar}>
                      <MaterialCommunityIcons name="stethoscope" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.doctorDetails}>
                      <Text style={styles.doctorName}>{doctor.name}</Text>
                      <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
                      {doctor.status === 'message' && (
                        <Text style={styles.doctorMessage}>Message</Text>
                      )}
                    </View>
                  </View>
                  {doctor.status !== 'message' && (
                    <TouchableOpacity 
                      style={styles.connectButton}
                      onPress={() => handleConnectDoctor(doctor.id)}
                    >
                      <Text style={styles.connectButtonText}>Connect</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Staffing & Hiring */}
        <View style={styles.staffingSection}>
          <Text style={styles.sectionTitle}>Staffing & Hiring</Text>
          <View style={styles.staffingContent}>
            <TouchableOpacity 
              style={styles.staffingButton}
              onPress={() => navigation.navigate('PostJobVacancy')}
            >
              <Text style={styles.staffingButtonText}>Post Job Vacancy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.staffingButton}
              onPress={() => navigation.navigate('ReviewApplications')}
            >
              <Text style={styles.staffingButtonText}>Review Applications</Text>
            </TouchableOpacity>
            
            <View style={styles.openPositions}>
              <Text style={styles.openPositionsLabel}>Open Positions:</Text>
              <Text style={styles.openPositionsCount}>5</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => Toast.showInfo('Dashboard', 'Already on dashboard')}>
          <Ionicons name="grid" size={24} color={colors.primary} />
          <Text style={[styles.navText, { color: colors.primary }]}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => Toast.showInfo('Schedule', 'Opening schedule')}>
          <Ionicons name="calendar" size={24} color={colors.textSecondary} />
          <Text style={styles.navText}>Schedule</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => Toast.showInfo('Staff', 'Opening staff management')}>
          <Ionicons name="people" size={24} color={colors.textSecondary} />
          <Text style={styles.navText}>Staff</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => Toast.showInfo('More', 'Opening more options')}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#083236' },
  emergencyAlert: {
    backgroundColor: '#FF5722',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  emergencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  emergencyText: {
    ...typography.label,
    color: colors.textInverse,
  },
  acceptEmergencyButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  acceptEmergencyText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '600',
  },
  closeEmergency: {
    padding: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    marginRight: spacing.md,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  defaultProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingSection: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textInverse,
    fontWeight: '600',
  },
  hospitalName: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  menuButton: {
    padding: spacing.sm,
  },
  content: { flex: 1 },
  mainContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  tabletLayout: {
    flexDirection: 'row',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minHeight: 300,
  },
  leftSection: {
    flex: 1,
    marginRight: spacing.md,
  },
  rightSection: {
    flex: 1,
    marginLeft: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  connectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  connectedCount: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  bookingsList: {
    maxHeight: 400,
  },
  bookingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    position: 'relative',
  },
  patientOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  bookingDetails: {
    flex: 1,
  },
  patientName: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  bookingTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bookingActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  acceptButton: {
    backgroundColor: '#0B7E8A',
  },
  rescheduleButton: {
    backgroundColor: colors.error,
  },
  bookingActionText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  doctorsList: {
    maxHeight: 300,
  },
  doctorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  doctorSpecialty: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  doctorMessage: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  connectButton: {
    backgroundColor: '#0B7E8A',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  connectButtonText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '600',
  },
  staffingSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    margin: spacing.lg,
    padding: spacing.lg,
  },
  staffingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  staffingButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    flex: isTablet ? 0 : 1,
    minWidth: isTablet ? 200 : undefined,
  },
  staffingButtonText: {
    ...typography.label,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  openPositions: {
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 120,
  },
  openPositionsLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  openPositionsCount: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  navText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});