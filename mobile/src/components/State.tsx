import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export function Loading({ label = '로딩 중...' }: { label?: string }) {
  return (
    <View style={{ padding: 16, alignItems: 'center', gap: 8 }}>
      <ActivityIndicator />
      <Text style={{ color: '#666' }}>{label}</Text>
    </View>
  );
}

export function Empty({ label = '표시할 항목이 없습니다.' }: { label?: string }) {
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: '#666' }}>{label}</Text>
    </View>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={{ padding: 12, backgroundColor: '#fdecea', borderColor: '#f5c6cb', borderWidth: 1 }}>
      <Text style={{ color: '#a94442' }}>{message}</Text>
    </View>
  );
}

