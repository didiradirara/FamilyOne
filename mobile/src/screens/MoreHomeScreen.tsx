import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreParamList } from '../navigation/MoreStack';
import { useAuth } from '../auth/AuthContext';

type Props = NativeStackScreenProps<MoreParamList, 'MoreHome'>;

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? '#f3f3f3' : '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' })}>
      <Text style={{ fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export default function MoreHomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{user ? `${user.name} (${user.role})` : '로그인 필요'}</Text>
        {!!user && (
          <Text style={{ color: '#666' }}>{(user as any).site || '-'} / {(user as any).team || '-'} {(user as any).teamDetail ? `/ ${(user as any).teamDetail}` : ''}</Text>
        )}
      </View>
      {/* 보고 목록은 전용 탭으로 이동 */}
      <Row label="보고(탭으로 이동)" onPress={() => (navigation as any).navigate('Reports')} />
      <Row label="체크리스트" onPress={() => navigation.navigate('Checklist')} />
      <Row label="제안함" onPress={() => navigation.navigate('Suggestions')} />
      <Row label="휴가 신청" onPress={() => navigation.navigate('Leave')} />
      <Row label="일정" onPress={() => navigation.navigate('Schedule')} />
      {user?.role === 'admin' && <Row label="조직 관리" onPress={() => navigation.navigate('OrgAdmin')} />}
      <Row label="로그아웃" onPress={logout} />
    </View>
  );
}

