import { create } from 'zustand';
import type { EntitlementsDto, FeatureKey } from '@fc/shared';
import { api, apiRequest, ApiError } from '@/lib/api-client';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/auth-storage';
import i18n from '@/i18n';
import { useUiStore, type AppLocale, type ThemeMode } from '@/stores/ui-store';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role?: string;
  plan?: string;
  status?: string;
  locale?: string;
  theme?: string;
  defaultBatchTargetGrams?: number;
  defaultConcentrationPct?: number;
  defaultIfraCategory?: number;
  createdAt?: string;
  entitlements?: EntitlementsDto;
};

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  updateAccount: (body: Record<string, unknown>) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logoutAll: () => Promise<void>;
};

function applyUserPreferences(user: AuthUser) {
  if (user.theme === 'dark' || user.theme === 'light') {
    useUiStore.getState().setTheme(user.theme as ThemeMode);
  }
  if (user.locale) {
    useUiStore.getState().setLocale(user.locale as AppLocale);
    void i18n.changeLanguage(user.locale);
  }
}

export function userHasFeature(user: AuthUser | null | undefined, feature: FeatureKey) {
  const features = user?.entitlements?.features;
  if (!features) return true;
  return features.includes(feature);
}

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
    applyUserPreferences(data.user);
    set({ user: data.user });
  },

  async register(displayName, email, password) {
    const data = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/auth/register', {
      method: 'POST',
      body: { displayName, email, password },
      auth: false,
    });

    setTokens(data.accessToken, data.refreshToken);
    applyUserPreferences(data.user);
    set({ user: data.user });
  },

  async logout() {
    const refreshToken = getRefreshToken();
    try {
      if (getAccessToken()) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      /* ignore network errors on logout */
    }
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
      applyUserPreferences(user);
      set({ user, hydrated: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        clearTokens();
      }
      set({ user: null, hydrated: true });
    }
  },

  async updateAccount(body) {
    const user = await api.patch<AuthUser>('/account', body);
    applyUserPreferences(user);
    set({ user });
    return user;
  },

  async changePassword(currentPassword, newPassword) {
    await api.post('/account/password', { currentPassword, newPassword });
    clearTokens();
    set({ user: null, hydrated: true });
  },

  async logoutAll() {
    await api.post('/account/logout-all');
    clearTokens();
    set({ user: null, hydrated: true });
  },
}));
