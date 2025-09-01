import { View, Text, TextInput, Button, FlatList, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

type RequestItem = { id: string; kind: 'mold_change'|'material_add'|'maintenance'|'other'; details: string; state: string; };

export default function RequestsScreen() {
  const { user } = useAuth();
  const [kind, setKind] = useState<RequestItem['kind']>('material_add');
  const [details, setDetails] = useState('');
  const [userId, setUserId] = useState('');
  const [items, setItems] = useState<RequestItem[]>([]);

  const load = async () => {
    const res = await api.get('/api/requests');
    setItems(res.data);
  };

  useEffect(() => { load(); }, []);
  const { clear } = useRealtime();
  useFocusEffect(React.useCallback(() => { clear('requests'); }, [clear]));

  const submit = async () => {
    try {
      await api.post('/api/requests', { kind, details, createdBy: userId || user?.id || '00000000-0000-0000-0000-000000000000' });
      setDetails('');
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>업무 요청</Text>
      <TextInput placeholder="작성자 userId(UUID)" value={userId} onChangeText={setUserId} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="요청 내용" value={details} onChangeText={setDetails} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="요청 제출" onPress={submit} />
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text>{item.kind} - {item.state}</Text>
          <Text>{item.details}</Text>
        </View>
      )} />
    </View>
  );
}
