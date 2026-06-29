import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#0A0A0A',
  muted: '#737373',
  border: '#E5E5E5',
  teal: '#0B7E8A',
  red: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  iconColor?: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress: () => void;
  }>;
  onClose: () => void;
}

export function CustomAlert({ visible, title, message, icon, iconColor, buttons, onClose }: CustomAlertProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Icon */}
          {icon && (
            <View style={[s.iconBox, { backgroundColor: (iconColor || C.teal) + '15' }]}>
              <Ionicons name={icon as any} size={24} color={iconColor || C.teal} />
            </View>
          )}
          
          {/* Title */}
          <Text style={s.title}>{title}</Text>
          
          {/* Message */}
          <Text style={s.message}>{message}</Text>
          
          {/* Buttons */}
          <View style={s.buttonRow}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  s.button,
                  button.style === 'destructive' && s.buttonDestructive,
                  button.style === 'cancel' && s.buttonCancel,
                  buttons.length === 1 && s.buttonSingle,
                ]}
                onPress={() => {
                  button.onPress();
                  onClose();
                }}
              >
                <Text style={[
                  s.buttonText,
                  button.style === 'destructive' && s.buttonTextDestructive,
                  button.style === 'cancel' && s.buttonTextCancel,
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: C.teal,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  buttonDestructive: {
    backgroundColor: C.red,
  },
  buttonSingle: {
    flex: 0,
    minWidth: 120,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextCancel: {
    color: C.text,
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});