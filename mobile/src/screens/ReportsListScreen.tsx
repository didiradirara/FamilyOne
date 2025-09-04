import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Button, Alert, Pressable, TextInput, Platform } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty } from '../components/State';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportsParamList } from '../navigation/ReportsStack';
import { useRealtime } from '../realtime/RealtimeContext';

type Report = {
  id: string;
  type: 'machine_fault'|'material_shortage'|'defect'|'other';
  message: string;
  createdAt: string;
  createdBy: string;
  status: 'new'|'ack'|'resolved';
};

type Props = NativeStackScreenProps<ReportsParamList, 'ReportsList'>;

export default function ReportsListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { clear } = useRealtime();
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<Report['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Report['status'] | 'all'>('all');
  const [order, setOrder] = useState<'desc'|'asc'>('desc');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [DateTimePickerComp, setDateTimePickerComp] = useState<any>(null);
  const [teams, setTeams] = useState<{ team: string; details: string[] }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedDetail, setSelectedDetail] = useState<string>('all');
  const canReview = user?.role === 'manager' || user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports', { params: { site: (user as any)?.site, team: selectedTeam !== 'all' ? selectedTeam : undefined } });
      setItems(res.data);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedTeam]);
  // Clear realtime counter and refresh when visiting list
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { clear('reports'); load(); });
    return unsub;
  }, [navigation, clear, selectedTeam]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/org/teams', { params: { site: (user as any)?.site } });
        setTeams(r.data.map((x:any)=>({ team:x.team, details:x.details })));
      } catch {}
    })();
  }, []);

  const filtered = useMemo(() => {
    let arr = items.filter(r => (r.message + ' ' + r.type + ' ' + r.status).toLowerCase().includes(q.toLowerCase()));
    if (typeFilter !== 'all') arr = arr.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') arr = arr.filter(r => r.status === statusFilter);
    if (from) arr = arr.filter(r => new Date(r.createdAt) >= new Date(from));
    if (to) arr = arr.filter(r => new Date(r.createdAt) <= new Date(to + 'T23:59:59'));
    if (selectedDetail !== 'all') arr = arr.filter((r:any) => (r as any)?.teamDetail === selectedDetail);
    arr.sort((a,b) => (order==='desc' ? new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()));
    return arr;
  }, [items, q, typeFilter, statusFilter, order, from, to]);

  const openNativePicker = (which: 'from'|'to') => {
    try {
      if (Platform.OS === 'android') {
        const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
        const current = (which === 'from' ? from : to) || new Date().toISOString().slice(0,10);
        const [y,m,d] = current.split('-').map(Number);
        const init = new Date(y || new Date().getFullYear(), (m||1)-1, d||1);
        DateTimePickerAndroid.open({
          value: init,
          mode: 'date',
          onChange: (_e: any, date?: Date) => {
            if (date) {
              const iso = date.toISOString().slice(0,10);
              if (which === 'from') setFrom(iso); else setTo(iso);
            }
          }
        });
        return;
      }
      if (Platform.OS === 'ios') {
        const mod = require('@react-native-community/datetimepicker');
        const Comp = mod?.default || mod?.DateTimePicker;
        if (!Comp) throw new Error('DateTimePicker not found');
        setDateTimePickerComp(Comp);
        if (which === 'from') setShowFromPicker(true); else setShowToPicker(true);
        return;
      }
      Alert.alert('안내', '네이티브 날짜 선택기는 모바일 환경에서만 지원됩니다.');
    } catch {
      Alert.alert('미설치', '네이티브 DatePicker가 설치되지 않았습니다.');
    }
  };

  const setStatus = async (id: string, status: Report['status']) => {
    try { await api.patch(`/api/reports/${id}`, { status }); await load(); }
    catch (e:any) { Alert.alert('실패', e?.response?.data?.error || '오류'); }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, flex: 1, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>보고 목록</Text>
      <TextInput placeholder="검색(메시지/종류/상태)" value={q} onChangeText={setQ} style={{ borderWidth: 1, padding: 8 }} />
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput placeholder="시작일 YYYY-MM-DD" value={from} onChangeText={setFrom} style={{ borderWidth: 1, padding: 8, flex: 1 }} />
          <Button title="시작일 선택" onPress={() => openNativePicker('from')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput placeholder="종료일 YYYY-MM-DD" value={to} onChangeText={setTo} style={{ borderWidth: 1, padding: 8, flex: 1 }} />
          <Button title="종료일 선택" onPress={() => openNativePicker('to')} />
        </View>
        {Platform.OS === 'ios' && DateTimePickerComp && showFromPicker && (
          <DateTimePickerComp
            value={from ? new Date(from) : new Date()}
            mode="date"
            onChange={(_e: any, date?: Date) => { if (date) setFrom(date.toISOString().slice(0,10)); setShowFromPicker(false); }}
          />
        )}
        {Platform.OS === 'ios' && DateTimePickerComp && showToPicker && (
          <DateTimePickerComp
            value={to ? new Date(to) : new Date()}
            mode="date"
            onChange={(_e: any, date?: Date) => { if (date) setTo(date.toISOString().slice(0,10)); setShowToPicker(false); }}
          />
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['all','machine_fault','material_shortage','defect','other'] as const).map(t => (
          <Pressable key={t} onPress={() => setTypeFilter(t as any)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: typeFilter===t?'#2d6cdf':'#ddd', backgroundColor: typeFilter===t?'#2d6cdf':'#f6f6f6' }}>
            <Text style={{ color: typeFilter===t?'#fff':'#333' }}>{t==='all'?'전체':t}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['all', ...teams.map(t=>t.team)] as string[]).map(t => (
          <Pressable key={t} onPress={() => setSelectedTeam(t)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: selectedTeam===t?'#2d6cdf':'#ddd', backgroundColor: selectedTeam===t?'#2d6cdf':'#f6f6f6' }}>
            <Text style={{ color: selectedTeam===t?'#fff':'#333' }}>{t==='all'?'전체팀':t}</Text>
          </Pressable>
        ))}
      </View>
      {!!teams.find(t=>t.team===selectedTeam)?.details.length && (
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
          {(['all', ...((teams.find(t=>t.team===selectedTeam)?.details)||[]) ] as string[]).map(d => (
            <Pressable key={d} onPress={()=>setSelectedDetail(d)} style={{ paddingVertical:6, paddingHorizontal:10, borderRadius:14, borderWidth:1, borderColor: selectedDetail===d?'#2d6cdf':'#ddd', backgroundColor: selectedDetail===d?'#2d6cdf':'#f6f6f6' }}>
              <Text style={{ color:selectedDetail===d?'#fff':'#333' }}>{d==='all'?'전체담당':d}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['all','new','ack','resolved'] as const).map(s => (
          <Pressable key={s} onPress={() => setStatusFilter(s as any)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: statusFilter===s?'#2d6cdf':'#ddd', backgroundColor: statusFilter===s?'#2d6cdf':'#f6f6f6' }}>
            <Text style={{ color: statusFilter===s?'#fff':'#333' }}>{s==='all'?'전체':s}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setOrder(o => o==='desc'?'asc':'desc')} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f6f6f6' }}>
          <Text style={{ color: '#333' }}>{order==='desc'?'최근':'오래된'}</Text>
        </Pressable>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Empty label="보고가 없습니다." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ReportDetail', { id: item.id })}>
            <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
              <Text style={{ fontWeight: '600' }}>{item.type} / {item.status}</Text>
              <Text>{item.message}</Text>
              <Text style={{ color: '#666' }}>{item.createdAt} / {item.createdBy}</Text>
              {!!(item as any)?.site && (
                <Text style={{ color: '#666' }}>{(item as any).site} / {(item as any).team || '-'} {(item as any).teamDetail ? `/ ${(item as any).teamDetail}` : ''}</Text>
              )}
              {canReview && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button title="접수" onPress={() => setStatus(item.id, 'ack')} />
                  <Button title="해결" onPress={() => setStatus(item.id, 'resolved')} />
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
