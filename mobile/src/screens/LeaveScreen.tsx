import { View, Text, TextInput, Button, FlatList, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type LR = { id: string; userId: string; startDate: string; endDate: string; state: string };

export default function LeaveScreen() {
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [items, setItems] = useState<LR[]>([]);

  const load = async () => {
    const res = await api.get('/api/leave-requests');
    setItems(res.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post('/api/leave-requests', { userId: userId || user?.id || '00000000-0000-0000-0000-000000000000', startDate, endDate });
      setStartDate(''); setEndDate('');
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>휴가 신청</Text>
      <TextInput placeholder="userId(UUID)" value={userId} onChangeText={setUserId} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="시작일 YYYY-MM-DD" value={startDate} onChangeText={setStartDate} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="종료일 YYYY-MM-DD" value={endDate} onChangeText={setEndDate} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="신청" onPress={submit} />
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text>{item.userId} / {item.startDate}~{item.endDate} / {item.state}</Text>
        </View>
      )} />
    </View>
  );
}
