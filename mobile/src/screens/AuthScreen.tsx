import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function AuthScreen() {
  const { login, register, registering } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'worker'|'manager'|'admin'>('worker');

  const onLogin = async () => {
    try {
      if (!name.trim()) return Alert.alert('이름을 입력하세요');
      await login(name.trim());
    } catch (e: any) {
      Alert.alert('로그인 실패', e?.response?.data?.error || '오류');
    }
  };

  const onRegister = async () => {
    try {
      if (!name.trim()) return Alert.alert('이름을 입력하세요');
      await register(name.trim(), role);
    } catch (e: any) {
      Alert.alert('회원가입 실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>FamilyOne 로그인</Text>
      <TextInput placeholder="이름" value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8 }} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text>역할:</Text>
        {(['worker','manager','admin'] as const).map(r => (
          <Text key={r}
            onPress={() => setRole(r)}
            style={{ paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: role===r?'#333':'#ccc', borderRadius: 6 }}>
            {r}
          </Text>
        ))}
      </View>
      <Button title={registering ? '가입 중...' : '회원가입'} onPress={onRegister} disabled={registering} />
      <Button title="이미 계정 있음: 로그인" onPress={onLogin} />
      <Text style={{ color: '#666', textAlign: 'center' }}>관리자/매니저 권한이 필요한 화면이 있습니다.</Text>
    </View>
  );
}

