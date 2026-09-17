import { create } from 'zustand';
import { api, apiRequest, ApiError } from '@/lib/api-client';
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth-storage';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  async login(email, password) {
    const data = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });

    setTokens(data.accessToken, data.refreshToken);
    set({ user: data.user });
  },

  logout() {
    clearTokens();
    set({ user: null });
  },

  async hydrate() {
    const token = getAccessToken();
    if (!token) {
      set({ hydrated: true, user: null });
      return;
    }
    try {
      const user = await api.get<AuthUser>('/auth/me');
      set({ user, hydrated: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearTokens();
      }
      set({ user: null, hydrated: true });
    }
  },
}));
