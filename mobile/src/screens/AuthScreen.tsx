import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

export default function AuthScreen() {
  const { login, register, registering, loggingIn } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'worker'|'manager'|'admin'>('worker');
  const [site, setSite] = useState<'hq'|'jeonju'|'busan'>('hq');
  const [teams, setTeams] = useState<{ team: string; details: string[] }[]>([]);
  const [team, setTeam] = useState<string>('');
  const [teamDetail, setTeamDetail] = useState<string | null>(null);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showDetailPicker, setShowDetailPicker] = useState(false);

  const fallbackBySite: Record<typeof site, { team: string; details: string[] }[]> = {
    hq: [{ team: '본사', details: [] }],
    jeonju: [
      { team: '전주공장장', details: [] },
      { team: '생산지원팀', details: [] },
      { team: '생산팀', details: ['생산 1담당','생산 2담당'] },
      { team: '공무팀', details: [] },
      { team: '개발팀', details: [] },
    ],
    busan: [
      { team: '부산공장장', details: [] },
      { team: '생산지원팀', details: [] },
      { team: '품질개선팀', details: [] },
      { team: '공무팀', details: [] },
      { team: '생산팀', details: [] },
    ],
  };

  const loadTeams = async (s: typeof site) => {
    try {
      const res = await api.get('/api/org/teams', { params: { site: s } });
      const arr = (res.data as any[]).map(x => ({ team: x.team, details: x.details || [] }));
      if (arr.length === 0) throw new Error('empty');
      setTeams(arr);
      setTeam(arr[0]?.team || '');
      setTeamDetail(null);
    } catch (e:any) {
      // Fallback to built-in lists when unauthenticated or server unavailable
      const arr = fallbackBySite[s];
      setTeams(arr);
      setTeam(arr[0]?.team || '');
      setTeamDetail(null);
    }
  };
  useEffect(() => { loadTeams(site); }, [site]);

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
      if (!team) return Alert.alert('팀을 선택하세요');
      await register(name.trim(), role, site, team, team === '생산팀' && site === 'jeonju' ? teamDetail ?? undefined : undefined);
    } catch (e: any) {
      Alert.alert('회원가입 실패', e?.response?.data?.error || '오류');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FamilyOne 로그인</Text>
      <TextInput
        placeholder="이름"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <View style={styles.row}>
        <Text>역할:</Text>
        {(['worker', 'manager', 'admin'] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: role === r ? '#333' : '#ccc',
              borderRadius: 6,
            }}
          >
            <Text>{r}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text>사업장:</Text>
        <View style={styles.row}>
          {(['hq', 'jeonju', 'busan'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSite(s)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: site === s ? '#333' : '#ccc',
                borderRadius: 6,
              }}
            >
              <Text>
                {s === 'hq' ? '본사' : s === 'jeonju' ? '전주공장' : '부산공장'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text>팀 선택:</Text>
        <View style={styles.row}>
          <Text>{team || '-'}</Text>
          <Button title="선택" onPress={() => setShowTeamPicker(true)} />
        </View>
        {!!teams.find((t) => t.team === team)?.details.length && (
          <View style={[styles.row, { marginTop: 8 }]}>
            <Text>{teamDetail || '-'}</Text>
            <Button title="세부담당 선택" onPress={() => setShowDetailPicker(true)} />
          </View>
        )}
      </View>

      {/* Team picker modal */}
      <Modal visible={showTeamPicker} transparent animationType="fade" onRequestClose={() => setShowTeamPicker(false)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' }} onPress={() => setShowTeamPicker(false)}>
          <View style={{ backgroundColor:'#fff', padding:16, borderRadius:8, width:'80%', maxHeight:'60%' }}>
            <Text style={{ fontWeight:'600', marginBottom:8 }}>팀 선택</Text>
            <FlatList data={teams} keyExtractor={(i)=>i.team} renderItem={({item})=> (
              <Pressable onPress={()=>{ setTeam(item.team); setTeamDetail(null); setShowTeamPicker(false); }} style={{ paddingVertical:10 }}>
                <Text>{item.team}</Text>
              </Pressable>
            )} />
          </View>
        </Pressable>
      </Modal>

      {/* Detail picker modal */}
      <Modal visible={showDetailPicker} transparent animationType="fade" onRequestClose={() => setShowDetailPicker(false)}>
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' }} onPress={() => setShowDetailPicker(false)}>
          <View style={{ backgroundColor:'#fff', padding:16, borderRadius:8, width:'80%', maxHeight:'60%' }}>
            <Text style={{ fontWeight:'600', marginBottom:8 }}>세부담당 선택</Text>
            <FlatList data={teams.find(t=>t.team===team)?.details || []} keyExtractor={(i)=>i} renderItem={({item})=> (
              <Pressable onPress={()=>{ setTeamDetail(item); setShowDetailPicker(false); }} style={{ paddingVertical:10 }}>
                <Text>{item}</Text>
              </Pressable>
            )} />
          </View>
        </Pressable>
      </Modal>
      <Button title={registering ? '가입 중...' : '회원가입'} onPress={onRegister} disabled={registering || loggingIn} />
      <Button title={loggingIn ? '로그인 중...' : '이미 계정 있음: 로그인'} onPress={onLogin} disabled={loggingIn || registering} />
      <Text style={styles.footer}>관리자/매니저 권한이 필요한 화면이 있습니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  section: {
    gap: 8,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  footer: {
    color: '#666',
    textAlign: 'center',
  },
});

