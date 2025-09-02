import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, FlatList, Button, Alert, TextInput, ScrollView, Platform, Modal, Pressable, Animated } from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportsParamList } from '../navigation/ReportsStack';
import { Loading, Empty } from '../components/State';
import ReactNative from 'react-native';

type Props = NativeStackScreenProps<ReportsParamList, 'ReportDetail'>;

type Report = {
  id: string;
  type: 'machine_fault'|'material_shortage'|'defect'|'other';
  message: string;
  createdAt: string;
  createdBy: string;
  status: 'new'|'ack'|'resolved';
  images?: string[];
};

export default function ReportDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { user } = useAuth();
  const canReview = user?.role === 'manager' || user?.role === 'admin';

  const [item, setItem] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const isOwner = !!user && !!(item as any)?.createdBy && user.id === (item as any).createdBy;

  const confirmAsync = async (title: string, message: string) => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      return Promise.resolve(window.confirm(`${title}\n${message}`));
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '확인', onPress: () => resolve(true) },
      ]);
    });
  };

  const toUri = (src: string) => {
    if (!src) return src;
    const s = String(src);
    if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s;
    // Relative uploads path
    const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
    if (s.startsWith('/')) return `${base}${s}`;
    if (s.startsWith('uploads/')) return `${base}/${s}`;
    // Fallback assume base64 payload
    return `data:image/jpeg;base64,${s}`;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/reports');
      const found = (res.data as Report[]).find(r => r.id === id) || null;
      setItem(found);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const addImages = async (images: string[]) => {
    try {
      await api.patch(`/api/reports/${id}`, { addImages: images });
      await load();
    } catch (e:any) {
      Alert.alert('실패', e?.response?.data?.error || '오류');
    }
  };

  const uploadAssetsStreaming = async (assets: any[]) => {
    const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
    const urls: string[] = [];
    for (const a of assets) {
      try {
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
          const resp = await fetch(a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri);
          const blob = await resp.blob();
          const endpoint = `${base}/api/uploads/stream?filename=${encodeURIComponent(a.fileName || a.filename || 'report.jpg')}`;
          const up = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
          if (up.ok) { const j = await up.json(); if (j?.url) urls.push(j.url); continue; }
        }
      } catch {}
      try {
        const dataUrl = a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri;
        const r = await api.post('/api/uploads/base64', { data: dataUrl });
        if (r.data?.url) urls.push(r.data.url);
      } catch {}
    }
    return urls;
  };

  const addImageUrl = async () => {
    if (!imgUrl.trim()) return;
    await addImages([imgUrl.trim()]);
    setImgUrl('');
  };

  const pickFromLibrary = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
      if (!result.canceled) {
        const assets: any[] = (result as any).assets || [];
        const urls = await uploadAssetsStreaming(assets);
        if (urls.length) await addImages(urls);
      }
    } catch {
      Alert.alert('미설치', 'expo-image-picker가 설치되지 않았습니다.\n설치 후 다시 시도하세요.');
    }
  };

  const takePhoto = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('권한 필요', '카메라 권한이 필요합니다.'); return; }
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
      if (!result.canceled) {
        const assets: any[] = (result as any).assets || [];
        const urls = await uploadAssetsStreaming(assets);
        if (urls.length) await addImages(urls);
      }
    } catch {
      Alert.alert('미설치', 'expo-image-picker가 설치되지 않았습니다.\n설치 후 다시 시도하세요.');
    }
  };

  if (loading || !item) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>보고 상세</Text>
      <Text>종류: {item.type}</Text>
      <Text style={{ fontWeight: '600' }}>메시지</Text>
      <EditableMessage id={id} message={item.message} ownerId={item.createdBy} images={item.images || []} onSaved={load} onEditingChange={setIsEditing} toUri={toUri} />
      <Text>상태: {item.status}</Text>
      <Text style={{ color: '#666' }}>{item.createdAt} / {item.createdBy}</Text>

      <Text style={{ marginTop: 8, fontWeight: '600' }}>사진</Text>
      {!isEditing && (
      <FlatList
        data={item.images || []}
        keyExtractor={(u, idx) => `${idx}`}
        horizontal
        ListEmptyComponent={<Empty label="첨부된 사진이 없습니다." />}
        renderItem={({ item: src }) => (
          <View style={{ marginRight: 8 }}>
            <Pressable onPress={() => setPreview(src)}>
              <Image source={{ uri: toUri(src) }} style={{ width: 120, height: 120, borderWidth: 1 }} />
            </Pressable>
            {(isOwner || canReview) && (
              <Button title="삭제" color="#cc3333" onPress={async () => {
                const ok = await confirmAsync('삭제 확인', '이 이미지를 삭제하시겠습니까?');
                if (!ok) return;
                try { await api.patch(`/api/reports/${id}/self`, { removeImages: [src] }); await load(); }
                catch(e:any){
                  try { await api.patch(`/api/reports/${id}`, { removeImages: [src] }); await load(); }
                  catch(e2:any){ Alert.alert('실패', e2?.response?.data?.error || '오류'); }
                }
              }} />
            )}
          </View>
        )}
      />)}

      {/* 하단 개별 업로드/URL 추가 UI는 제거되었습니다. 편집 모드에서
          사진 첨부 및 제거를 처리합니다. */}

      <Modal visible={!!preview} transparent onRequestClose={() => setPreview(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setPreview(null)}>
          {preview && (
            <ZoomableImage uri={toUri(preview)} />
          )}
        </Pressable>
      </Modal>

      {(canReview || isOwner) && !isEditing && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {canReview && <Button title="접수" onPress={() => api.patch(`/api/reports/${id}`, { status: 'ack' }).then(load).catch((e:any)=>Alert.alert('실패', e?.response?.data?.error||'오류'))} />}
          {canReview && <Button title="해결" onPress={() => api.patch(`/api/reports/${id}`, { status: 'resolved' }).then(load).catch((e:any)=>Alert.alert('실패', e?.response?.data?.error||'오류'))} />}
          {isOwner && (
            <Button title="삭제" color="#cc3333" onPress={async () => {
              const ok = await confirmAsync('삭제 확인', '정말 삭제하시겠습니까?');
              if (!ok) return;
              try { await api.delete(`/api/reports/${id}`); }
              catch(e:any){ Alert.alert('실패', e?.response?.data?.error || '오류'); return; }
              if (navigation && (navigation as any).goBack) {
                (navigation as any).goBack();
              } else if (Platform.OS === 'web') {
                // eslint-disable-next-line no-restricted-globals
                history.back();
              }
            }} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], { useNativeDriver: true });
  const onPinchStateChange = (e: any) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current *= e.nativeEvent.scale;
      // Clamp scale
      const next = Math.max(1, Math.min(lastScale.current, 4));
      lastScale.current = next;
      scale.setValue(next);
    } else if (e.nativeEvent.state === State.END) {
      if (lastScale.current < 1.01) {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start(() => { lastScale.current = 1; });
      }
    }
  };

  return (
    <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
      <Animated.Image
        source={{ uri }}
        style={{ width: '90%', height: '70%', resizeMode: 'contain', transform: [{ scale }] }}
      />
    </PinchGestureHandler>
  );
}

function EditableMessage({ id, message, ownerId, images, onSaved, onEditingChange, toUri }: { id: string; message: string; ownerId: string; images: string[]; onSaved: () => void; onEditingChange: (v:boolean)=>void; toUri: (s:string)=>string }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message);
  const [removeMap, setRemoveMap] = useState<Record<string, boolean>>({});
  const [pendingAdd, setPendingAdd] = useState<string[]>([]);
  const canEdit = user?.id === ownerId;
  useEffect(() => { setText(message); }, [message]);
  useEffect(() => { setRemoveMap({}); }, [editing, images?.length]);
  useEffect(() => { onEditingChange?.(editing); }, [editing]);
  if (!canEdit) return <Text>{message}</Text>;
  return (
    <View style={{ gap: 8 }}>
      {editing ? (
        <>
          <TextInput value={text} onChangeText={setText} placeholder="메시지" style={{ borderWidth: 1, padding: 8 }} />
          {/* 현재 첨부 이미지 미리보기 + 제거 토글 */}
          {images && images.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#666' }}>현재 첨부 이미지 (탭하여 제거/복원)</Text>
              <ScrollView horizontal>
                {images.map((src, idx) => {
                  const selected = !!removeMap[src];
                  return (
                    <Pressable key={idx} onPress={() => setRemoveMap(m => ({ ...m, [src]: !m[src] }))} style={{ marginRight: 8 }}>
                      <Image source={{ uri: toUri(src) }} style={{ width: 80, height: 80, borderWidth: 2, borderColor: selected ? '#d32f2f' : '#ddd' }} />
                      <Text style={{ textAlign: 'center', color: selected ? '#d32f2f' : '#666', fontSize: 12 }}>{selected ? '제거' : '유지'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {/* 추가 예정 이미지 미리보기 */}
          {pendingAdd.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#666' }}>추가 예정 이미지</Text>
              <ScrollView horizontal>
                {pendingAdd.map((src, idx) => (
                  <View key={idx} style={{ marginRight: 8 }}>
                    <Image source={{ uri: toUri(src) }} style={{ width: 80, height: 80, borderWidth: 1, borderColor: '#2d6cdf' }} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="사진 첨부" onPress={async () => {
              try {
                const ImagePicker = require('expo-image-picker');
                const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsMultipleSelection: true });
                if (!result.canceled) {
                  const assets: any[] = (result as any).assets || [];
                  // 업로드는 선행하되 보고에 즉시 반영하지 않고 Save에서 일괄 반영
                  const base = (api.defaults.baseURL || '').replace(/\/+$/, '');
                  const urls: string[] = [];
                  for (const a of assets) {
                    try {
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
                        if (res.status >= 200 && res.status < 300) { const body = JSON.parse(res.body || '{}'); if (body?.url) urls.push(body.url); }
                      } else {
                        const resp = await fetch(a.base64 ? `data:${a.type || 'image/jpeg'};base64,${a.base64}` : a.uri);
                        const blob = await resp.blob();
                        const endpoint = `${base}/api/uploads/stream?filename=${encodeURIComponent(a.fileName || a.filename || 'report.jpg')}`;
                        const up = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
                        if (up.ok) { const j = await up.json(); if (j?.url) urls.push(j.url); }
                      }
                    } catch {}
                    if (urls.length === 0 && a?.base64) {
                      try { const r = await api.post('/api/uploads/base64', { data: `data:${a.type || 'image/jpeg'};base64,${a.base64}` }); if (r.data?.url) urls.push(r.data.url); } catch {}
                    }
                  }
                  if (urls.length) setPendingAdd(prev => [...prev, ...urls]);
                }
              } catch { Alert.alert('미설치', 'expo-image-picker가 설치되지 않았습니다.'); }
            }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="취소" onPress={() => { setEditing(false); setText(message); setRemoveMap({}); }} />
            <Button title="저장" onPress={async () => {
              try {
                // 1) 메시지 저장
                if (text !== message) await api.patch(`/api/reports/${id}/self`, { message: text });
                // 2) 제거 선택 반영
                const toRemove = Object.entries(removeMap).filter(([,v]) => v).map(([k]) => k);
                if (toRemove.length) await api.patch(`/api/reports/${id}/self`, { removeImages: toRemove });
                // 3) 추가 예정 반영
                if (pendingAdd.length) await api.patch(`/api/reports/${id}/self`, { addImages: pendingAdd });
                setEditing(false); setRemoveMap({}); onSaved();
              } catch(e:any){ Alert.alert('실패', e?.response?.data?.error || '오류'); }
            }} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>{message}</Text>
          <Button title="수정" onPress={() => setEditing(true)} />
        </View>
      )}
    </View>
  );
}
