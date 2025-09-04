import Constants from 'expo-constants';
import axios from 'axios';

// Determine which API endpoint to hit.
// 1) Use API_BASE_URL from app config if provided.
// 2) In dev, fall back to the Metro host so the emulator talks to the local API.
// 3) Finally, use the production host.
const defaultBaseURL = 'http://34.47.82.64';
const extra = (Constants.expoConfig?.extra as any) || {};
const debuggerHost = Constants.expoGoConfig?.debuggerHost?.split(':')?.[0];
const devBaseURL = __DEV__ && debuggerHost ? `http://${debuggerHost}` : undefined;

export const api = axios.create({
  baseURL: extra.API_BASE_URL || devBaseURL || defaultBaseURL,
});

// Allow API_BASE_URL values that already include the "/api" prefix. If the
// baseURL ends with "/api" and callers also prefix paths with "/api", strip
// the duplicate segment so requests resolve correctly.
api.interceptors.request.use((config) => {
  const base = config.baseURL || '';
  if (base.endsWith('/api') && config.url?.startsWith('/api/')) {
    console.log("Running application API ininin");
    config.url = config.url.slice(4);
  }
  return config;
});

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function getAuthToken() {
  return authToken;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export function getErrorMessage(e: unknown) {
  const err = e as any;
  if (!err) return '알 수 없는 오류';
  return (
    err?.response?.data?.error ||
    (err?.message === 'Network Error'
      ? '네트워크 오류: 서버에 연결할 수 없습니다.'
      : err?.message || '알 수 없는 오류')
  );
}

// Interceptors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try { onUnauthorized?.(); } catch {}
    }
    if (err?.message === 'Network Error' && !err?.response) {
      err.response = { data: { error: '네트워크 오류: 서버에 연결할 수 없습니다.' } } as any;
    }
    return Promise.reject(err);
  }
);
