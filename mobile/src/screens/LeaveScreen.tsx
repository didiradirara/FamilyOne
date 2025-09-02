import { View, Text, TextInput, Button, FlatList, Alert, Platform } from 'react-native';
import { Loading, Empty } from '../components/State';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type LR = { id: string; userId: string; startDate: string; endDate: string; state: string };

export default function LeaveScreen() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [items, setItems] = useState<LR[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [DateTimePickerComp, setDateTimePickerComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/leave-requests');
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const validate = () => {
    if (!validDate(startDate) || !validDate(endDate)) return '날짜 형식은 YYYY-MM-DD 입니다.';
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) return '종료일은 시작일 이후여야 합니다.';
    return null;
  };

  const submit = async () => {
    try {
      const err = validate();
      if (err) { setError(err); return; }
      await api.post('/api/leave-requests', { userId: user?.id || '00000000-0000-0000-0000-000000000000', startDate, endDate });
      setStartDate(''); setEndDate('');
      setError(null);
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  const openNativePicker = (which: 'start'|'end') => {
    try {
      // Android dialog API
      if (Platform.OS === 'android') {
        const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
        const current = which === 'start' ? (startDate || new Date().toISOString().slice(0,10)) : (endDate || new Date().toISOString().slice(0,10));
        const parts = current.split('-');
        const init = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        DateTimePickerAndroid.open({
          value: init,
          mode: 'date',
          onChange: (_e: any, date?: Date) => {
            if (date) {
              const iso = date.toISOString().slice(0,10);
              if (which === 'start') setStartDate(iso); else setEndDate(iso);
            }
          }
        });
        return;
      }
      // iOS inline component
      if (Platform.OS === 'ios') {
        const mod = require('@react-native-community/datetimepicker');
        const Comp = mod?.default || mod?.DateTimePicker;
        if (!Comp) throw new Error('DateTimePicker not found');
        setDateTimePickerComp(Comp);
        if (which === 'start') setShowStartPicker(true); else setShowEndPicker(true);
        return;
      }
      Alert.alert('안내', '네이티브 날짜 선택기는 모바일 환경에서만 지원됩니다.');
    } catch {
      Alert.alert('미설치', '네이티브 DatePicker 패키지가 설치되지 않았습니다. 설치 후 다시 시도하세요.');
    }
  };

  const canReview = user?.role === 'manager' || user?.role === 'admin';
  const review = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.patch(`/api/leave-requests/${id}/${action}`, { reviewerId: user?.id || '00000000-0000-0000-0000-000000000000' });
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>휴가 신청</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="시작=오늘" onPress={() => setStartDate(new Date().toISOString().slice(0,10))} />
        <Button title="종료=내일" onPress={() => { const d = new Date(); d.setDate(d.getDate()+1); setEndDate(d.toISOString().slice(0,10)); }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="시작일 선택(네이티브)" onPress={() => openNativePicker('start')} />
        <Button title="종료일 선택(네이티브)" onPress={() => openNativePicker('end')} />
      </View>
      <TextInput placeholder="시작일 YYYY-MM-DD" value={startDate} onChangeText={setStartDate} style={{ borderWidth: 1, padding: 8 }} />
      <TextInput placeholder="종료일 YYYY-MM-DD" value={endDate} onChangeText={setEndDate} style={{ borderWidth: 1, padding: 8 }} />
      {/* iOS inline picker rendering when available */}
      {Platform.OS === 'ios' && DateTimePickerComp && showStartPicker && (
        <DateTimePickerComp
          value={startDate ? new Date(startDate) : new Date()}
          mode="date"
          onChange={(_e: any, date?: Date) => { if (date) setStartDate(date.toISOString().slice(0,10)); setShowStartPicker(false); }}
        />
      )}
      {Platform.OS === 'ios' && DateTimePickerComp && showEndPicker && (
        <DateTimePickerComp
          value={endDate ? new Date(endDate) : new Date()}
          mode="date"
          onChange={(_e: any, date?: Date) => { if (date) setEndDate(date.toISOString().slice(0,10)); setShowEndPicker(false); }}
        />
      )}
      {error && <Text style={{ color: '#cc3333' }}>{error}</Text>}
      <Button title="신청" onPress={submit} />
      <FlatList data={items} keyExtractor={(i) => i.id} ListEmptyComponent={<Empty label="등록된 휴가가 없습니다." />} renderItem={({ item }) => (
        <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
          <Text>{item.userId} / {item.startDate}~{item.endDate} / {item.state}</Text>
          {canReview && item.state === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="승인" onPress={() => review(item.id, 'approve')} />
              <Button title="반려" color="#cc3333" onPress={() => review(item.id, 'reject')} />
            </View>
          )}
        </View>
      )} />
    </View>
  );
}
