import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  username: string;
  role: 'ventas' | 'cxc' | 'facturacion' | 'gerencia' | 'master';
  estado?: string;
  sucursal?: string;
  token?: string;
  refreshToken?: string;
}

// Sesión persistente prolongada (30 días) para que nunca se cierre al actualizar o recargar
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Recuperación sincrónica inmediata de la sesión desde localStorage para evitar flashes a Login al recargar
function getStoredSession(): { user: User | null; expiresAt: number | null } {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem('codizulca-session');
      if (raw) {
        const parsed = JSON.parse(raw);
        const u = parsed.state?.user || parsed.user;
        const exp = parsed.state?.expiresAt || parsed.expiresAt;
        if (u && u.username && (!exp || Date.now() < exp)) {
          return { user: u, expiresAt: Date.now() + SESSION_TTL_MS };
        }
      }
    }
  } catch {}
  return { user: null, expiresAt: null };
}

const initialSession = getStoredSession();

interface AuthState {
  user: User | null;
  expiresAt: number | null;
  login: (user: User) => void;
  updateTokens: (token: string, refreshToken?: string) => void;
  touchSession: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: initialSession.user,
      expiresAt: initialSession.expiresAt,
      login: (user) => set({ user, expiresAt: Date.now() + SESSION_TTL_MS }),
      updateTokens: (token, refreshToken) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                token,
                refreshToken: refreshToken || state.user.refreshToken,
              }
            : null,
          expiresAt: Date.now() + SESSION_TTL_MS,
        })),
      touchSession: () => {
        if (get().user) {
          set({ expiresAt: Date.now() + SESSION_TTL_MS });
        }
      },
      logout: () => {
        try {
          localStorage.removeItem('codizulca-session');
        } catch {}
        set({ user: null, expiresAt: null });
      },
    }),
    {
      name: 'codizulca-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, expiresAt: state.expiresAt }),
      onRehydrateStorage: () => (state) => {
        if (state && state.user) {
          if (state.expiresAt && Date.now() > state.expiresAt) {
            state.logout();
          } else {
            state.touchSession();
          }
        }
      },
    }
  )
);
