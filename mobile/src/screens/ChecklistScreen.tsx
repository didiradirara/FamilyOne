import { View, Text, Button, FlatList, Alert, Pressable } from 'react-native';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Item = { id: string; title: string; checked: boolean; category: 'safety'|'quality' };

export default function ChecklistScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);

  const load = async () => {
    try {
      const res = await api.get('/api/checklists/templates/safety');
      setItems(res.data);
    } catch (e: any) {
      console.error('[Checklist] Failed to load templates', e?.message || e);
      Alert.alert('실패', e?.response?.data?.error || e?.message || '오류');
    }
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

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const allChecked = items.length > 0 && items.every(i => i.checked);

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>안전 체크리스트(데모)</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggleItem(item.id)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, marginVertical: 4 }}
          >
            <Text style={{ marginRight: 8 }}>{item.checked ? '☑' : '☐'}</Text>
            <Text>{item.title}</Text>
          </Pressable>
        )}
      />
      <Pressable
        onPress={() => setItems(prev => prev.map(i => ({ ...i, checked: !allChecked })))}
        style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}
      >
        <Text style={{ marginRight: 8 }}>{allChecked ? '☑' : '☐'}</Text>
        <Text>모두 체크</Text>
      </Pressable>
      <Button title="제출" onPress={submit} disabled={!allChecked} />
    </View>
  );
}
