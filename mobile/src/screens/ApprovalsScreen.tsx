import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Button, Alert, TextInput, Pressable, Platform } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty } from '../components/State';

type Req = { id: string; kind: string; details: string; state: 'pending'|'approved'|'rejected'; createdAt?: string };
type LR = { id: string; userId: string; startDate: string; endDate: string; state: 'pending'|'approved'|'rejected' };

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [leaves, setLeaves] = useState<LR[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all'|'requests'|'leaves'>('all');
  const [pendingOnly, setPendingOnly] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [order, setOrder] = useState<'desc'|'asc'>('desc');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [DateTimePickerComp, setDateTimePickerComp] = useState<any>(null);

  const load = async () => {
    const [r1, r2] = await Promise.all([
      api.get('/api/requests'),
      api.get('/api/leave-requests'),
    ]);
    setReqs(r1.data);
    setLeaves(r2.data);
  };

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, []);

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
      Alert.alert('미설치', '네이티브 DatePicker 패키지가 설치되지 않았습니다. 설치 후 다시 시도하세요.');
    }
  };

  const reviewReq = async (id: string, action: 'approve'|'reject') => {
    try { await api.patch(`/api/requests/${id}/${action}`, { reviewerId: user?.id }); await load(); }
    catch (e:any) { Alert.alert('실패', e?.response?.data?.error || '오류'); }
  };
  const reviewLeave = async (id: string, action: 'approve'|'reject') => {
    try { await api.patch(`/api/leave-requests/${id}/${action}`, { reviewerId: user?.id }); await load(); }
    catch (e:any) { Alert.alert('실패', e?.response?.data?.error || '오류'); }
  };

  const filteredReqs = useMemo(() => {
    const base = pendingOnly ? reqs.filter(r => r.state === 'pending') : reqs;
    if (!q) return base;
    const lc = q.toLowerCase();
    let arr = base.filter(r => (r.kind + ' ' + r.details).toLowerCase().includes(lc));
    // date range by createdAt
    if (from) arr = arr.filter(r => r.createdAt ? new Date(r.createdAt) >= new Date(from) : true);
    if (to) arr = arr.filter(r => r.createdAt ? new Date(r.createdAt) <= new Date(to + 'T23:59:59') : true);
    return arr.sort((a,b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return order === 'desc' ? db - da : da - db;
    });
  }, [reqs, q, pendingOnly, from, to, order]);
  const filteredLeaves = useMemo(() => {
    const base = pendingOnly ? leaves.filter(l => l.state === 'pending') : leaves;
    if (!q) return base;
    const lc = q.toLowerCase();
    let arr = base.filter(l => (l.userId + ' ' + l.startDate + ' ' + l.endDate).toLowerCase().includes(lc));
    // date range by startDate
    if (from) arr = arr.filter(l => new Date(l.startDate) >= new Date(from));
    if (to) arr = arr.filter(l => new Date(l.startDate) <= new Date(to + 'T23:59:59'));
    return arr.sort((a,b) => {
      const da = new Date(a.startDate).getTime();
      const db = new Date(b.startDate).getTime();
      return order === 'desc' ? db - da : da - db;
    });
  }, [leaves, q, pendingOnly, from, to, order]);

  if (!(user?.role === 'manager' || user?.role === 'admin')) {
    return (
      <View style={{ padding: 16 }}>
        <Text>권한이 없습니다.</Text>
      </View>
    );
  }

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, gap: 16, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>승인 대시보드</Text>

      {/* 검색/필터 */}
      <TextInput placeholder="검색(요청 내용, 사용자)" value={q} onChangeText={setQ} style={{ borderWidth: 1, padding: 8 }} />
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
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all','requests','leaves'] as const).map(v => (
          <Pressable key={v} onPress={() => setView(v)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: view===v?'#2d6cdf':'#ddd', backgroundColor: view===v?'#2d6cdf':'#f6f6f6', borderRadius: 14 }}>
            <Text style={{ color: view===v?'#fff':'#333' }}>{v==='all'?'모두':v==='requests'?'요청':'휴가'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setPendingOnly(p => !p)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: pendingOnly?'#2d6cdf':'#ddd', backgroundColor: pendingOnly?'#2d6cdf':'#f6f6f6', borderRadius: 14 }}>
          <Text style={{ color: pendingOnly?'#fff':'#333' }}>대기만</Text>
        </Pressable>
        <Pressable onPress={() => setOrder(o => o==='desc'?'asc':'desc')} style={{ paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f6f6f6', borderRadius: 14 }}>
          <Text style={{ color: '#333' }}>{order==='desc'?'최근':'오래된'}</Text>
        </Pressable>
      </View>

      {(view === 'all' || view === 'requests') && (
        <>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>요청 ({filteredReqs.length})</Text>
          <FlatList
            data={filteredReqs}
            keyExtractor={i => i.id}
            ListEmptyComponent={<Empty label="요청 항목이 없습니다." />}
            renderItem={({ item }) => (
              <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
                <Text>{item.kind}</Text>
                <Text>{item.details}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button title="승인" onPress={() => reviewReq(item.id, 'approve')} />
                  <Button title="반려" color="#cc3333" onPress={() => reviewReq(item.id, 'reject')} />
                </View>
              </View>
            )}
          />
        </>
      )}

      {(view === 'all' || view === 'leaves') && (
        <>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>휴가 ({filteredLeaves.length})</Text>
          <FlatList
            data={filteredLeaves}
            keyExtractor={i => i.id}
            ListEmptyComponent={<Empty label="휴가 항목이 없습니다." />}
            renderItem={({ item }) => (
              <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
                <Text>{item.userId} / {item.startDate}~{item.endDate}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button title="승인" onPress={() => reviewLeave(item.id, 'approve')} />
                  <Button title="반려" color="#cc3333" onPress={() => reviewLeave(item.id, 'reject')} />
                </View>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}
