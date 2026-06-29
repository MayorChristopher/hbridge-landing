import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../utils/design';

const { width } = Dimensions.get('window');

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
  action?: {
    text: string;
    onPress: () => void;
  };
}

export default function Toast({ 
  id, 
  type, 
  title, 
  message, 
  duration = 4000, 
  onDismiss, 
  action 
}: ToastProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(id);
    });
  };

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          color: '#0B7E8A',
          backgroundColor: '#0B7E8A40',
          borderColor: '#0B7E8A60',
        };
      case 'error':
        return {
          icon: 'close-circle',
          color: '#dc2626',
          backgroundColor: '#dc262640',
          borderColor: '#dc262660',
        };
      case 'warning':
        return {
          icon: 'warning',
          color: '#f59e0b',
          backgroundColor: '#f59e0b40',
          borderColor: '#f59e0b60',
        };
      case 'info':
        return {
          icon: 'information-circle',
          color: '#0ea5e9',
          backgroundColor: '#0ea5e940',
          borderColor: '#0ea5e960',
        };
    }
  };

  const config = getToastConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: config.color }]}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
        </View>

        <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {action && (
        <TouchableOpacity 
          style={[styles.actionButton, { borderTopColor: config.borderColor }]}
          onPress={() => {
            action.onPress();
            dismiss();
          }}
        >
          <Text style={[styles.actionText, { color: config.color }]}>{action.text}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...typography.label,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  closeButton: {
    padding: spacing.xs,
  },
  actionButton: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionText: {
    ...typography.label,
    fontWeight: '600',
  },
});