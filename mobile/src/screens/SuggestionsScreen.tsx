import { View, Text, TextInput, Button, FlatList, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

type Sug = { id: string; text: string; createdAt: string };

export default function SuggestionsScreen() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Sug[]>([]);

  const load = async () => {
    try {
      const res = await api.get('/api/suggestions');
      setItems(res.data);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post('/api/suggestions', { text, anonymous: true });
      setText('');
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>익명 제안함</Text>
      <TextInput placeholder="제안 내용" value={text} onChangeText={setText} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="등록" onPress={submit} />
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text>{item.text}</Text>
          <Text style={{ color: '#666' }}>{item.createdAt}</Text>
        </View>
      )} />
    </View>
  );
}