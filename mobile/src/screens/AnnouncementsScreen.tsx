import { View, Text, TextInput, Button, FlatList, Alert, Pressable } from 'react-native';
import { Loading, Empty } from '../components/State';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

type Ann = { id: string; title: string; body: string; readBy: string[]; mustRead?: boolean; attachmentUrl?: string };

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mustRead, setMustRead] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<{ team: string; details: string[] }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/announcements', { params: { site: (user as any)?.site, team: selectedTeam !== 'all' ? selectedTeam : undefined } });
      setItems(res.data);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedTeam]);
  useEffect(() => {
    (async () => {
      try { const r = await api.get('/api/org/teams', { params: { site: (user as any)?.site } }); setTeams(r.data.map((x:any)=>({ team:x.team, details:x.details })));
      } catch {}
    })();
  }, []);
  const { clear } = useRealtime();
  useFocusEffect(React.useCallback(() => { clear('announcements'); }, [clear]));

  const canPost = user?.role === 'manager' || user?.role === 'admin';

  const submit = async () => {
    try {
      await api.post('/api/announcements', {
        title, body, createdBy: user?.id || '00000000-0000-0000-0000-000000000000',
        mustRead, attachmentUrl: attachmentUrl || undefined,
        site: (user as any)?.site,
        team: selectedTeam !== 'all' ? selectedTeam : undefined,
      });
      setTitle(''); setBody(''); setMustRead(false); setAttachmentUrl('');
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.post(`/api/announcements/${id}/read`, { userId: user?.id || '00000000-0000-0000-0000-000000000000' });
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>공지 목록</Text>
      {!canPost && (
        <Text style={{ color: '#666' }}>공지 등록은 매니저/관리자만 가능합니다.</Text>
      )}
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
        {(['all', ...teams.map(t=>t.team)] as string[]).map(t => (
          <Pressable key={t} onPress={()=>setSelectedTeam(t)} style={{ paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderColor: selectedTeam===t?'#2d6cdf':'#ddd', backgroundColor: selectedTeam===t?'#2d6cdf':'#f6f6f6', borderRadius:14 }}>
            <Text style={{ color:selectedTeam===t?'#fff':'#333' }}>{t==='all'?'전체팀':t}</Text>
          </Pressable>
        ))}
      </View>
      {canPost && (
        <View style={{ gap: 8 }}>
          <Button title={showForm ? '작성 폼 접기' : '공지 작성'} onPress={() => setShowForm((v) => !v)} />
          {showForm && (
            <View style={{ gap: 8, borderWidth: 1, padding: 8, borderColor: '#ddd' }}>
              <TextInput placeholder="제목" value={title} onChangeText={setTitle} style={{ borderWidth: 1, padding: 8 }} />
              <TextInput placeholder="내용" value={body} onChangeText={setBody} style={{ borderWidth: 1, padding: 8 }} multiline />
              <TextInput placeholder="첨부파일 URL (선택사항)" value={attachmentUrl} onChangeText={setAttachmentUrl} style={{ borderWidth: 1, padding: 8 }} />
              <Pressable onPress={() => setMustRead(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
                <View style={{ width: 20, height: 20, borderWidth: 1, borderColor: '#666', backgroundColor: mustRead ? '#2d6cdf' : '#fff' }} />
                <Text>필수 확인 공지</Text>
              </Pressable>
              <Button title="공지 등록" onPress={submit} />
            </View>
          )}
        </View>
      )}
      <FlatList data={items} keyExtractor={(i) => i.id} ListEmptyComponent={<Empty label="등록된 공지가 없습니다." />} renderItem={({ item }) => {
        const unread = !!(user && !item.readBy.includes(user.id));
        return (
          <Pressable onPress={() => unread && markRead(item.id)}>
            <View style={{ padding: 12, borderWidth: 1, marginVertical: 4, gap: 8, borderColor: '#ddd', borderRadius: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontWeight: '600', flex: 1, fontSize: 16 }}>{item.title}</Text>
                {item.mustRead && <Text style={{ color: '#fff', backgroundColor: '#f57c00', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontSize: 12, fontWeight: 'bold' }}>필수</Text>}
                {unread && <Text style={{ color: '#fff', backgroundColor: '#e53935', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontSize: 12, fontWeight: 'bold' }}>NEW</Text>}
              </View>
              <Text style={{ color: '#333' }}>{item.body}</Text>
              {!!(item as any)?.site && (
                <Text style={{ color: '#666', fontSize: 12 }}>{(item as any).site} / {(item as any).team || '전체'}</Text>
              )}
              {item.attachmentUrl && <Button title="첨부파일 다운로드" onPress={() => Alert.alert('다운로드', item.attachmentUrl)} />}
              <Text style={{ fontSize: 12, color: '#666' }}>읽음: {item.readBy.length}명</Text>
              {unread && (
                <View style={{ marginTop: 8 }}>
                  <Button title="읽음 표시" onPress={() => markRead(item.id)} />
                </View>
              )}
              {canPost && item.mustRead && (
                <Button title="미확인자 목록" onPress={async () => {
                  try {
                    const res = await api.get(`/api/announcements/${item.id}/unread`);
                    Alert.alert('미확인자', res.data.map((u: any) => u.name).join(', ') || '없음');
                  } catch (e: any) { Alert.alert('실패', e?.response?.data?.error || '오류'); }
                }} />
              )}
            </View>
          </Pressable>
        );
      }} />
    </View>
  );
}
