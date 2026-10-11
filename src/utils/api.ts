import { useAuthStore } from '../store/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().user?.token;
  
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  // Ensure endpoint starts with slash if we are appending to a base URL
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  return fetch(url, { ...options, headers });
};
