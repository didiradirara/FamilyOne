import { View, Text, TextInput, Button, Alert } from 'react-native';
import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function ReportScreen() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'machine_fault'|'material_shortage'|'defect'|'other'>('machine_fault');
  const [userId, setUserId] = useState('');

  const submit = async () => {
    try {
      const res = await api.post('/api/reports', { type, message, createdBy: userId || user?.id || '00000000-0000-0000-0000-000000000000' });
      Alert.alert('보고 완료', res.data.id);
      setMessage('');
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>보고 작성</Text>
      <TextInput placeholder="작성자 userId(UUID)" value={userId} onChangeText={setUserId} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="메시지" value={message} onChangeText={setMessage} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="제출" onPress={submit} />
    </View>
  );
}
