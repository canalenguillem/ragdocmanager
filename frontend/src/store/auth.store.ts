import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('rag_token', data.token);
        set({ user: data.user, token: data.token });
      },
      register: async (email, password, name, phone) => {
        const { data } = await api.post('/auth/register', { email, password, name, phone });
        localStorage.setItem('rag_token', data.token);
        set({ user: data.user, token: data.token });
      },
      logout: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        localStorage.removeItem('rag_token');
        set({ user: null, token: null });
      }
    }),
    { name: 'rag_auth', partialize: (state) => ({ user: state.user, token: state.token }) }
  )
);
