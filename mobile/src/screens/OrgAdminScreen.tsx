import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, Button, Alert, Pressable } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty } from '../components/State';

type OrgResp = { sites: { site: string; name: string }[]; teams: Record<string, { id: string; team: string; details: string[] }[]> };

export default function OrgAdminScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<OrgResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<'hq'|'jeonju'|'busan'>('hq');
  const [newTeam, setNewTeam] = useState('');
  const [newDetails, setNewDetails] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/org');
      setData(res.data);
    } catch (e:any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const teams = useMemo(() => data?.teams?.[site] || [], [data, site]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState('');
  const [editDetails, setEditDetails] = useState('');

  const addTeam = async () => {
    try {
      const details = newDetails.split(',').map(s => s.trim()).filter(Boolean);
      await api.post('/api/org/team', { site, team: newTeam.trim(), details });
      setNewTeam(''); setNewDetails(''); await load();
    } catch (e:any) { Alert.alert('실패', e?.response?.data?.error || '오류'); }
  };
  const delTeam = async (id: string) => {
    try { await api.delete(`/api/org/team/${id}`); await load(); } catch(e:any){ Alert.alert('실패', e?.response?.data?.error || '오류'); }
  };
  const startEdit = (item: { id: string; team: string; details: string[] }) => {
    setEditId(item.id);
    setEditTeam(item.team);
    setEditDetails(item.details.join(', '));
  };
  const saveEdit = async () => {
    if (!editId) return;
    try {
      const details = editDetails.split(',').map(s => s.trim()).filter(Boolean);
      await api.patch(`/api/org/team/${editId}`, { team: editTeam.trim(), details });
      setEditId(null); setEditTeam(''); setEditDetails(''); await load();
    } catch(e:any){ Alert.alert('실패', e?.response?.data?.error || '오류'); }
  };

  if (user?.role !== 'admin') return <View style={{ padding: 16 }}><Text>권한이 없습니다.</Text></View>;
  if (loading || !data) return <Loading />;

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>조직 관리</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['hq','jeonju','busan'] as const).map(s => (
          <Pressable key={s} onPress={() => setSite(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: site===s?'#2d6cdf':'#ddd', backgroundColor: site===s?'#2d6cdf':'#f6f6f6', borderRadius: 14 }}>
            <Text style={{ color: site===s?'#fff':'#333' }}>{data.sites.find(x=>x.site===s)?.name || s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontWeight: '600' }}>팀 목록</Text>
      <FlatList
        data={teams}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Empty label="팀이 없습니다." />}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
            <Text>{item.team}</Text>
            <Text style={{ color: '#666' }}>세부담당: {item.details.length ? item.details.join(', ') : '-'}</Text>
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="수정" onPress={() => startEdit(item)} />
                <Button title="삭제" color="#cc3333" onPress={() => delTeam(item.id)} />
              </View>
            </View>
          </View>
        )}
      />

      <Text style={{ fontWeight: '600' }}>팀 추가</Text>
      <TextInput placeholder="팀 이름" value={newTeam} onChangeText={setNewTeam} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="세부담당(쉼표로 구분)" value={newDetails} onChangeText={setNewDetails} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="추가" onPress={addTeam} />

      {editId && (
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderColor: '#eee', gap: 8 }}>
          <Text style={{ fontWeight: '600' }}>팀 수정</Text>
          <TextInput placeholder="팀 이름" value={editTeam} onChangeText={setEditTeam} style={{ borderWidth: 1, padding: 8 }} />
          <TextInput placeholder="세부담당(쉼표로 구분)" value={editDetails} onChangeText={setEditDetails} style={{ borderWidth: 1, padding: 8 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="저장" onPress={saveEdit} />
            <Button title="취소" color="#888" onPress={() => { setEditId(null); setEditTeam(''); setEditDetails(''); }} />
          </View>
        </View>
      )}
    </View>
  );
}
