import { View, Text, TextInput, Button, FlatList, Alert, Platform } from 'react-native';
import { Loading, Empty } from '../components/State';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type LR = { id: string; userId: string; startDate: string; endDate: string; state: string };

export default function LeaveScreen() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<LR[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [DateTimePickerComp, setDateTimePickerComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}년${mm}월${dd}일`;
  };

  const diffDays = (s: string, e: string) =>
    Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1;

  const formatRange = (s: string, e: string) => `${formatDate(s)}~${formatDate(e)} ${diffDays(s, e)}일간`;

  const stateLabels: Record<string, string> = { pending: '대기', approved: '승인', rejected: '반려' };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/leave-requests');
      setItems(res.data);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
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
      await api.post('/api/leave-requests', {
        userId: user?.id || '00000000-0000-0000-0000-000000000000',
        startDate,
        endDate,
      });
      setStartDate(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      });
      setEndDate(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      });
      setError(null);
      await load();
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  const confirmSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    const msg = `(${formatRange(startDate, endDate)}) 신청하시겠습니까?`;
    Alert.alert('신청 확인', msg, [
      { text: '취소' },
      { text: '확인', onPress: submit },
    ]);
  };

  const openNativePicker = (which: 'start' | 'end') => {
    try {
      // Web fallback using HTML date input
      if (Platform.OS === 'web') {
        const current = which === 'start' ? startDate : endDate;
        const input = document.createElement('input');
        input.type = 'date';
        if (current) input.value = current;
        input.onchange = (e: any) => {
          const val = e.target.value;
          if (which === 'start') setStartDate(val); else setEndDate(val);
        };
        input.click();
        return;
      }
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

  if (loading) return <Loading />;

  return (
    <View style={{ padding: 16, gap: 12, flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>휴가 신청</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="시작=내일" onPress={() => { const d = new Date(); d.setDate(d.getDate()+1); setStartDate(d.toISOString().slice(0,10)); }} />
        <Button title="종료=내일" onPress={() => { const d = new Date(); d.setDate(d.getDate()+1); setEndDate(d.toISOString().slice(0,10)); }} />
      </View>
      <TextInput
        placeholder="시작일 YYYY-MM-DD"
        value={startDate}
        style={{ borderWidth: 1, padding: 8 }}
        editable={false}
        onPressIn={() => openNativePicker('start')}
      />
      <TextInput
        placeholder="종료일 YYYY-MM-DD"
        value={endDate}
        style={{ borderWidth: 1, padding: 8 }}
        editable={false}
        onPressIn={() => openNativePicker('end')}
      />
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
      <Button title="신청" onPress={confirmSubmit} />
      <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600' }}>내 신청 목록</Text>
      <FlatList
        data={items.filter((i) => i.userId === (user?.id || ''))}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Empty label="등록된 휴가가 없습니다." />}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderWidth: 1, marginVertical: 4 }}>
            <Text>({formatRange(item.startDate, item.endDate)}) / {stateLabels[item.state] || item.state}</Text>
          </View>
        )}
      />
    </View>
  );
}
