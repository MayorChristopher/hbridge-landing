import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, safeArea } from '../utils/design';

interface ScreenWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ 
  children, 
  backgroundColor = colors.background,
  edges = ['top']
}) => {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={edges}>
      <View style={styles.content}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 80, // Space for tab bar
  },
});