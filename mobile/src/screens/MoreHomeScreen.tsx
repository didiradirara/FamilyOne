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
      </View>
      <Row label="보고 작성" onPress={() => navigation.navigate('Report')} />
      <Row label="체크리스트" onPress={() => navigation.navigate('Checklist')} />
      <Row label="제안함" onPress={() => navigation.navigate('Suggestions')} />
      <Row label="휴가 신청" onPress={() => navigation.navigate('Leave')} />
      <Row label="일정" onPress={() => navigation.navigate('Schedule')} />
      <Row label="로그아웃" onPress={logout} />
    </View>
  );
}

