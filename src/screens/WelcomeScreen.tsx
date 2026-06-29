import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ImageBackground, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full screen background image */}
      <ImageBackground
        source={require('../../assets/welcome-bg.jpeg')}
        style={styles.bg}
        resizeMode="cover"
        imageStyle={{ top: 0, bottom: 0 }}
      >
        {/* Dark gradient overlay */}
        <View style={styles.overlay} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Top — branding */}
          <View style={styles.topSection}>
            <Image
              source={require('../../assets/hbridge3.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          {/* Bottom — title + buttons */}
          <View style={styles.bottomSection}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🇳🇬 Nigeria's #1 Health App</Text>
            </View>
            <Text style={styles.title}>Your Health,{'\n'}Our Priority</Text>
            <Text style={styles.subtitle}>
              Connect with verified doctors, find hospitals nearby, manage your medical records and get AI-powered medical guidance — all in one place.
            </Text>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.signUpButton}
                onPress={() => navigation.navigate('SignUp')}
                activeOpacity={0.85}
              >
                <Text style={styles.signUpText}>Get Started</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('SignIn')}
                activeOpacity={0.7}
                style={styles.signInLink}
              >
                <Text style={styles.signInText}>I already have an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  bg: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  topSection: {
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0B7E8A',
  },
  badge: {
    backgroundColor: '#D4A843',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D4A843',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  bottomSection: {
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 48,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    marginBottom: 8,
  },
  buttons: {
    gap: 12,
    marginTop: 8,
  },
  signUpButton: {
    backgroundColor: '#0B7E8A',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  signInText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },
});
