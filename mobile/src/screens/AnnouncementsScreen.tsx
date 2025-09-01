import { View, Text, TextInput, Button, FlatList, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

type Ann = { id: string; title: string; body: string; readBy: string[] };

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [userId, setUserId] = useState('');
  const [items, setItems] = useState<Ann[]>([]);

  const load = async () => {
    const res = await api.get('/api/announcements');
    setItems(res.data);
  };

  useEffect(() => { load(); }, []);
  const { clear } = useRealtime();
  useFocusEffect(React.useCallback(() => { clear('announcements'); }, [clear]));

  const submit = async () => {
    try {
      await api.post('/api/announcements', { title, body, createdBy: userId || user?.id || '00000000-0000-0000-0000-000000000000' });
      setTitle(''); setBody('');
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>공지 등록/목록</Text>
      <TextInput placeholder="작성자 userId(UUID)" value={userId} onChangeText={setUserId} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="제목" value={title} onChangeText={setTitle} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="내용" value={body} onChangeText={setBody} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="공지 등록" onPress={submit} />
      <FlatList data={items} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text style={{ fontWeight: '600' }}>{item.title}</Text>
          <Text>{item.body}</Text>
          <Text>읽음: {item.readBy.length}명</Text>
        </View>
      )} />
    </View>
  );
}
