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

    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        useAuthStore.getState().updateTokens(data.token, data.refreshToken);
        return data.token;
      }
    } else if (res.status === 401) {
      // Solo cerrar sesión si el servidor confirma explícitamente que la sesión expiró de forma definitiva
      console.warn('Sesión expirada en servidor de autenticación');
      useAuthStore.getState().logout();
      return null;
    }
  } catch (err) {
    // Error de red o servidor reiniciando: NO cerrar sesión, permitir reintento
    console.warn('No se pudo refrescar token por falla de red/servidor reiniciando:', err);
    return null;
  }

  return null;
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const token = useAuthStore.getState().user?.token;

  const buildHeaders = (authToken?: string) => ({
    ...options.headers,
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  });

  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers: buildHeaders(token) });
  } catch (err) {
    // Error de red: propagar sin cerrar sesión
    console.warn(`apiFetch error de red en ${endpoint}:`, err);
    throw err;
  }

  // If 401 and not an auth route, attempt token refresh once
  if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/refresh')) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      res = await fetch(url, { ...options, headers: buildHeaders(newToken) });
    }
  }

  return res;
};

