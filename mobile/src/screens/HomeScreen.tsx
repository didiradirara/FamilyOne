import { View, Text, Button, TextInput, ScrollView, Alert } from 'react-native';
import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const { connected } = useRealtime();
  const [userId, setUserId] = useState('');

  const quickReport = async () => {
    try {
      const res = await api.post('/api/reports', {
        type: 'machine_fault',
        message: '긴급: 설비 이상 감지',
        createdBy: userId || user?.id || '00000000-0000-0000-0000-000000000000',
      });
      Alert.alert('보고 완료', `ID: ${res.data.id}`);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>FamilyOne</Text>
      <Text style={{ color: '#555' }}>{user ? `안녕하세요, ${user.name}님` : '로그인 필요'}</Text>
      <Text style={{ color: connected ? 'green' : 'red' }}>Realtime: {connected ? '연결됨' : '미연결'}</Text>
      <Text>데모용 사용자 ID 입력(서버 seed 사용자 사용):</Text>
      <TextInput
        placeholder="userId(UUID)"
        value={userId}
        onChangeText={setUserId}
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 }}
      />
      <Button title="원클릭 보고(설비 고장)" onPress={quickReport} />
      <Text>하단 탭에서 기능을 탐색하세요.</Text>
    </ScrollView>
  );
}
