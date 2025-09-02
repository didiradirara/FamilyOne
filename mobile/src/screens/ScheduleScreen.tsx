import { View, Text, FlatList, TextInput, Button, Alert } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty } from '../components/State';

export default function ScheduleScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const canEdit = useMemo(() => user?.role === 'manager' || user?.role === 'admin', [user]);
  const [date, setDate] = useState('');
  const [uid, setUid] = useState('');
  const [shift, setShift] = useState('A');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/schedule');
        setItems(Array.isArray(res.data) ? res.data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>근무 스케줄</Text>
      {canEdit && (
        <View style={{ gap: 8, marginBottom: 8 }}>
          <Text style={{ fontWeight: '600' }}>스케줄 추가</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="오늘" onPress={() => setDate(new Date().toISOString().slice(0,10))} />
            <Button title="내일" onPress={() => { const d=new Date(); d.setDate(d.getDate()+1); setDate(d.toISOString().slice(0,10)); }} />
          </View>
          <TextInput placeholder="날짜 YYYY-MM-DD" value={date} onChangeText={setDate} style={{ borderWidth: 1, padding: 8 }} />
          <TextInput placeholder="대상 userId(UUID)" value={uid} onChangeText={setUid} style={{ borderWidth: 1, padding: 8 }} />
          <TextInput placeholder="근무조(예: A/B/C)" value={shift} onChangeText={setShift} style={{ borderWidth: 1, padding: 8 }} />
          <Button title="추가" onPress={async () => {
            try {
              await api.post('/api/schedule', { date, userId: uid || user?.id || '00000000-0000-0000-0000-000000000000', shift });
              setDate(''); setUid(''); setShift('A');
              const res = await api.get('/api/schedule'); setItems(res.data);
            } catch (e:any) { Alert.alert('실패', e?.response?.data?.error || '오류'); }
          }} />
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id || String(item.date) + String(item.userId)}
        ListEmptyComponent={<Empty label="등록된 스케줄이 없습니다." />}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
            <Text>{item.date} / {item.userId} / 조:{item.shift}</Text>
            {canEdit && (
              <View style={{ marginTop: 8 }}>
                <Button title="삭제" color="#cc3333" onPress={async () => {
                  try { await api.delete(`/api/schedule/${item.id}`); const res = await api.get('/api/schedule'); setItems(res.data); }
                  catch(e:any){ Alert.alert('실패', e?.response?.data?.error || '오류'); }
                }} />
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}
