import { useAuthStore } from '../store/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const user = useAuthStore.getState().user;
  if (!user?.refreshToken) return null;

  try {
    const url = API_BASE_URL ? `${API_BASE_URL}/api/auth/refresh` : '/api/auth/refresh';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: user.refreshToken })
    });

    if (!res.ok) {
      useAuthStore.getState().logout();
      return null;
    }

    const data = await res.json();
    if (data.token) {
      useAuthStore.getState().updateTokens(data.token, data.refreshToken);
      return data.token;
    }
  } catch (err) {
    console.error('Failed to auto-refresh token:', err);
  }

  useAuthStore.getState().logout();
  return null;
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const token = useAuthStore.getState().user?.token;

  const buildHeaders = (authToken?: string) => ({
    ...options.headers,
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  });

  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  let res = await fetch(url, { ...options, headers: buildHeaders(token) });

  // If 401 and not an auth route, attempt token refresh once
  if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/refresh')) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      // Retry request with fresh token
      res = await fetch(url, { ...options, headers: buildHeaders(newToken) });
    } else {
      // Token cannot be refreshed, ensure logout
      useAuthStore.getState().logout();
    }
  }

  return res;
};

