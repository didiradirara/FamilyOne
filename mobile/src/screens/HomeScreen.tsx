import { View, Text, Button, ScrollView, Alert, Pressable, Modal, TextInput } from 'react-native';
import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const { user } = useAuth();
  const { connected, counters } = useRealtime();
  const navigation: any = useNavigation();
  const [showMemo, setShowMemo] = useState(false);
  const [selectedType, setSelectedType] = useState<'machine_fault'|'material_shortage'|'defect'|'other'>('machine_fault');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pickedAssets, setPickedAssets] = useState<any[]>([]);

  const openMemo = (type: typeof selectedType) => {
    setSelectedType(type);
    const defaults: Record<string,string> = {
      machine_fault: '긴급: 설비 이상 감지',
      material_shortage: '자재 부족 발생',
      defect: '불량 발생 보고',
      other: '기타 이슈 보고'
    };
    setMessage(defaults[type]);
    setShowMemo(true);
  };

  const uploadAssetsStreaming = async (assets: any[]) => {
    const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
    const urls: string[] = [];
    for (const a of assets) {
      try {
        // Prefer expo-file-system RAW upload on native
        if (Platform.OS !== 'web') {
          const FileSystem = require('expo-file-system');
          const contentType = a.mimeType || a.type || 'image/jpeg';
          const filename = (a.fileName || a.filename || `report_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9_.-]/g, '');
          const endpoint = `${base}/api/uploads/stream?filename=${encodeURIComponent(filename)}`;
          const res = await FileSystem.uploadAsync(endpoint, a.uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.RAW,
            headers: { 'Content-Type': contentType, 'x-filename': filename },
          });
          if (res.status >= 200 && res.status < 300) {
            const body = JSON.parse(res.body || '{}');
            if (body?.url) urls.push(body.url);
            continue;
          }
        } else {
          // Web: fetch data URI to blob then POST
          const resp = await fetch(a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri);
          const blob = await resp.blob();
          const endpoint = `${base}/api/uploads/stream?filename=${encodeURIComponent(a.fileName || a.filename || 'report.jpg')}`;
          const up = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
          if (up.ok) { const j = await up.json(); if (j?.url) urls.push(j.url); continue; }
        }
      } catch {}
      // Fallback to base64 JSON upload
      try {
        const dataUrl = a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri;
        const r = await api.post('/api/uploads/base64', { data: dataUrl });
        if (r.data?.url) urls.push(r.data.url);
      } catch {}
    }
    return urls;
  };

  const submitReport = async () => {
    try {
      let imagesToSend: string[] | undefined = undefined;
      if (pickedAssets.length) {
        const uploaded = await uploadAssetsStreaming(pickedAssets);
        imagesToSend = uploaded;
      }
      const res = await api.post('/api/reports', {
        type: selectedType,
        message: message || '보고',
        createdBy: user?.id || '00000000-0000-0000-0000-000000000000',
        images: imagesToSend,
      });
      setShowMemo(false);
      setMessage('');
      setImages([]);
      setPickedAssets([]);
      Alert.alert('보고 완료', `ID: ${res.data.id}`);
    } catch (e: any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  const pickImages = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({ base64: true, allowsMultipleSelection: true, quality: 0.7 });
      if (!result.canceled) {
        const assets: any[] = (result as any).assets || [];
        const previews = assets.map(a => (a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri)).filter(Boolean) as string[];
        setImages(prev => [...prev, ...previews]);
        setPickedAssets(prev => [...prev, ...assets]);
      }
    } catch {
      Alert.alert('미설치', 'expo-image-picker가 설치되지 않았습니다.\n설치 후 다시 시도하세요.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>FamilyOne</Text>
      <Text style={{ color: '#555' }}>{user ? `안녕하세요, ${user.name}님` : '로그인 필요'}</Text>
      <Text style={{ color: connected ? 'green' : 'red' }}>Realtime: {connected ? '연결됨' : '미연결'}</Text>
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>원클릭 보고</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([
            { key:'machine_fault', label:'설비 고장' },
            { key:'material_shortage', label:'자재 부족' },
            { key:'defect', label:'불량' },
            { key:'other', label:'기타' },
          ] as const).map(b => (
            <Pressable key={b.key} onPress={() => openMemo(b.key)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2d6cdf', backgroundColor: '#eaf1ff', borderRadius: 6 }}>
              <Text>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {counters.reports > 0 && (
        <Text style={{ color: '#d32f2f' }}>신규 보고 {counters.reports}건</Text>
      )}
      <Button title="보고 목록 열기" onPress={() => navigation.navigate('More', { screen: 'ReportsList' })} />
      <Modal visible={showMemo} transparent animationType="fade" onRequestClose={() => setShowMemo(false)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' }} onPress={() => setShowMemo(false)}>
          <Pressable style={{ backgroundColor:'#fff', padding:16, borderRadius:8, width:'85%' }} onPress={(e)=>e.stopPropagation()}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:8 }}>보고 메모</Text>
          <TextInput placeholder="메시지" value={message} onChangeText={setMessage} style={{ borderWidth:1, padding:8, marginBottom:12 }} />
          {images.length > 0 && (
            <ScrollView horizontal style={{ marginBottom: 12 }}>
              {images.map((src, idx) => (
                <View key={idx} style={{ marginRight: 8 }}>
                  <View style={{ width: 80, height: 80, borderWidth: 1, backgroundColor: '#fafafa' }}>
                    {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                    {/* @ts-ignore */}
                    <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
            <Button title="사진 첨부(앨범)" onPress={pickImages} />
            <Button title="카메라" onPress={async () => {
              try {
                const ImagePicker = require('expo-image-picker');
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (perm.status !== 'granted') { Alert.alert('권한 필요', '카메라 권한이 필요합니다.'); return; }
                const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
                if (!result.canceled) {
                  const assets: any[] = (result as any).assets || [];
                  const previews = assets.map(a => (a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri)).filter(Boolean) as string[];
                  setImages(prev => [...prev, ...previews]);
                  setPickedAssets(prev => [...prev, ...assets]);
                }
              } catch { Alert.alert('미설치', 'expo-image-picker가 설치되지 않았습니다.'); }
            }} />
            {images.length > 0 && <Button title="초기화" color="#888" onPress={() => { setImages([]); setPickedAssets([]); }} />}
          </View>
          <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:8 }}>
            <Button title="취소" onPress={()=>setShowMemo(false)} />
            <Button title="보내기" onPress={submitReport} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
      <Text>하단 탭에서 기능을 탐색하세요.</Text>
    </ScrollView>
  );
}
