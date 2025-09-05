import Constants from 'expo-constants';
import axios from 'axios';

// Determine which API endpoint to hit.
// 1) Use API_BASE_URL from app config if provided.
// 2) In dev, fall back to the Metro host so the emulator talks to the local API.
// 3) Finally, use the production host.
//const defaultBaseURL = 'http://34.47.82.64';
//const defaultBaseURL = 'http://34.64.238.255';
const defaultBaseURL = 'http://localhost:4000';
const extra = (Constants.expoConfig?.extra as any) || {};
const debuggerHost = Constants.expoGoConfig?.debuggerHost?.split(':')?.[0];
// In development, Expo's debugger host resolves to the machine running the Metro
// bundler. The API server listens on port 4000, so append it here to talk to the
// local backend when available.
const devBaseURL = __DEV__ && debuggerHost ? `http://${debuggerHost}:4000` : undefined;

function normalizeBase(url: string | undefined) {
  return (url || '').replace(/\/+$/, '');
}

export const api = axios.create({
  baseURL: normalizeBase(extra.API_BASE_URL || devBaseURL || defaultBaseURL),
});

// Allow API_BASE_URL values that already include the "/api" prefix. When the
// base URL itself ends with "/api" and callers also prefix paths with "/api",
// remove the duplicate segment so requests still resolve under the "/api"
// namespace. Axios treats absolute paths (starting with "/") as root-relative,
// so ensure the base URL retains the trailing slash and trim the extra prefix
// from the request path.
api.interceptors.request.use((config) => {
  const base = normalizeBase(config.baseURL);
  if (base.endsWith('/api') && config.url?.startsWith('/api/')) {
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
