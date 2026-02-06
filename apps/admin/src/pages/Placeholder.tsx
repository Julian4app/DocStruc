import React from 'react';
import { View, Text } from 'react-native';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: 'white', borderRadius: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{title}</Text>
      <Text style={{ marginTop: 16, color: '#666' }}>This feature is under construction.</Text>
    </View>
  );
}
