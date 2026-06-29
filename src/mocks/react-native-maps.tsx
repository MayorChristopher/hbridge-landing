import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ style, children }: any) => (
  <View style={[styles.map, style]}>
    <Text style={styles.text}>Map unavailable on web</Text>
    {children}
  </View>
);

export const Marker = () => null;
export const Callout = () => null;
export const Circle = () => null;
export const Polygon = () => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;

const styles = StyleSheet.create({
  map: { backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13, color: '#737373' },
});

export default MapView;
