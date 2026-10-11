import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  username: string;
  role: 'ventas' | 'cxc' | 'facturacion' | 'gerencia' | 'master';
  estado?: string;
  sucursal?: string;
  token?: string;
}

// La sesión se conserva al refrescar la página y expira a las 12 horas.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface AuthState {
  user: User | null;
  expiresAt: number | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      expiresAt: null,
      login: (user) => set({ user, expiresAt: Date.now() + SESSION_TTL_MS }),
      logout: () => set({ user: null, expiresAt: null }),
    }),
    {
      name: 'codizulca-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, expiresAt: state.expiresAt }),
      // Al restaurar la sesión, descartarla si ya venció
      onRehydrateStorage: () => (state) => {
        if (state && state.expiresAt && Date.now() > state.expiresAt) {
          state.logout();
        }
      },
    }
  )
);
