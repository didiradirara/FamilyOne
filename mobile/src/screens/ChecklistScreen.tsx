import { View, Text, Button, FlatList, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Item = { id: string; title: string; checked: boolean; category: 'safety'|'quality' };

export default function ChecklistScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);

  const load = async () => {
    const res = await api.get('/api/checklists/templates/safety');
    setItems(res.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post('/api/checklists/submit', { date: new Date().toISOString().slice(0,10), userId: user?.id || '00000000-0000-0000-0000-000000000000', category: 'safety', items });
      Alert.alert('체크 완료');
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>안전 체크리스트(데모)</Text>
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text>{item.title}</Text>
        </View>
      )} />
      <Button title="제출" onPress={submit} />
    </View>
  );
}
