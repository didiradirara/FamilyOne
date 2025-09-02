import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth/token';
const USER_KEY = 'auth/user';

export type StoredUser = { id: string; name: string; role: 'worker'|'manager'|'admin'; site?: 'hq'|'jeonju'|'busan'; team?: string; teamDetail?: string | null } | null;

export async function saveAuth(token: string, user: StoredUser) {
  await AsyncStorage.multiSet([[TOKEN_KEY, token], [USER_KEY, JSON.stringify(user)]]);
}

export async function loadAuth(): Promise<{ token: string | null; user: StoredUser }>{
  const [[, token], [, userJson]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  return { token, user: userJson ? JSON.parse(userJson) : null };
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

