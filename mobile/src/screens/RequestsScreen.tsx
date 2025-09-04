import { View, Text, Button, FlatList, Alert, TextInput, Pressable } from 'react-native';
import { Loading, Empty } from '../components/State';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

type RequestItem = {
  id: string;
  kind: 'mold_change'|'material_add'|'maintenance'|'other';
  details: string;
  state: 'pending' | 'approved' | 'rejected' | string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
};

export default function RequestsScreen() {
  const { user } = useAuth();
  const [kind, setKind] = useState<RequestItem['kind']>('material_add');
  const [details, setDetails] = useState('');
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<{ team: string; details: string[] }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedDetail, setSelectedDetail] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/requests', { params: { site: (user as any)?.site, team: selectedTeam !== 'all' ? selectedTeam : undefined } });
      const list = res.data as any[];
      const filtered = selectedDetail === 'all' ? list : list.filter(x => x.teamDetail === selectedDetail);
      setItems(filtered as any);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedTeam]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/org/teams', { params: { site: (user as any)?.site } });
        setTeams(r.data.map((x:any)=>({ team: x.team, details: x.details })));
      } catch {}
    })();
  }, []);
  const { clear } = useRealtime();
  useFocusEffect(React.useCallback(() => { clear('requests'); }, [clear]));

  const submit = async () => {
    try {
      await api.post('/api/requests', { kind, details, createdBy: user?.id || '00000000-0000-0000-0000-000000000000' });
      setDetails('');
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  const canReview = user?.role === 'manager' || user?.role === 'admin';

  const review = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.patch(`/api/requests/${id}/${action}`, { reviewerId: user?.id || '00000000-0000-0000-0000-000000000000' });
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>업무 요청</Text>
      {/* Kind segmented control */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[{
          key: 'mold_change', label: '금형교체'
        }, { key: 'material_add', label: '자재추가' }, { key: 'maintenance', label: '설비보전' }, { key: 'other', label: '기타' }]
          .map(({ key, label }) => (
            <Pressable key={key} onPress={() => setKind(key as RequestItem['kind'])}
              style={({ pressed }) => ({
                paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14,
                backgroundColor: kind === key ? '#2d6cdf' : (pressed ? '#eee' : '#f6f6f6'),
                borderWidth: 1, borderColor: kind === key ? '#2d6cdf' : '#ddd'
              })}
            >
              <Text style={{ color: kind === key ? '#fff' : '#333', fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
      </View>
      <TextInput placeholder="요청 내용" value={details} onChangeText={setDetails} style={{ borderWidth: 1, padding: 8 }} />
      <Button title="요청 제출" onPress={submit} />
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
        {(['all', ...teams.map(t=>t.team)] as string[]).map(t => (
          <Pressable key={t} onPress={()=>setSelectedTeam(t)} style={{ paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderColor: selectedTeam===t?'#2d6cdf':'#ddd', backgroundColor: selectedTeam===t?'#2d6cdf':'#f6f6f6', borderRadius:14 }}>
            <Text style={{ color:selectedTeam===t?'#fff':'#333' }}>{t==='all'?'전체팀':t}</Text>
          </Pressable>
        ))}
      </View>
      {!!teams.find(t=>t.team===selectedTeam)?.details.length && (
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
          {(['all', ...((teams.find(t=>t.team===selectedTeam)?.details)||[]) ] as string[]).map(d => (
            <Pressable key={d} onPress={()=>setSelectedDetail(d)} style={{ paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderColor: selectedDetail===d?'#2d6cdf':'#ddd', backgroundColor: selectedDetail===d?'#2d6cdf':'#f6f6f6', borderRadius:14 }}>
              <Text style={{ color:selectedDetail===d?'#fff':'#333' }}>{d==='all'?'전체담당':d}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Empty label="요청이 없습니다." />}
        renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text>{item.kind} - {item.state}</Text>
          <Text>{item.details}</Text>
          {!!(item as any)?.site && (
            <Text style={{ color: '#666' }}>{(item as any).site} / {(item as any).team || '-'} {(item as any).teamDetail ? `/ ${(item as any).teamDetail}` : ''}</Text>
          )}
          {item.state !== 'pending' && (
            <Text style={{ color: '#666', marginTop: 4 }}>
              검토자: {item.reviewerId || '-'} {item.reviewedAt ? `/ ${item.reviewedAt}` : ''}
            </Text>
          )}
          {canReview && item.state === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="승인" onPress={() => review(item.id, 'approve')} />
              <Button title="반려" color="#cc3333" onPress={() => review(item.id, 'reject')} />
            </View>
          )}
        </View>
      )}
      />
    </View>
  );
}
