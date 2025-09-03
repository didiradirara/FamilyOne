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

// Interceptors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try { onUnauthorized?.(); } catch {}
    }
    return Promise.reject(err);
  }
);
