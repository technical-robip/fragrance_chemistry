import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'http://localhost:3000/api/v1');

import { useAuthStore, userHasFeature } from './auth-store';
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth-storage';

describe('auth-store', () => {
  beforeEach(() => {
    clearTokens();
    useAuthStore.setState({ user: null, hydrated: false });
    vi.restoreAllMocks();
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000/api/v1');
  });

  it('login stores user and tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              accessToken: 'a',
              refreshToken: 'r',
              user: { id: '1', email: 'a@b.co', displayName: 'A' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    await useAuthStore.getState().login('a@b.co', 'password1');
    expect(useAuthStore.getState().user?.email).toBe('a@b.co');
  });

  it('register stores user and tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              accessToken: 'a',
              refreshToken: 'r',
              user: { id: '2', email: 'n@b.co', displayName: 'New' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    await useAuthStore.getState().register('New', 'n@b.co', 'password1');
    expect(useAuthStore.getState().user?.displayName).toBe('New');
    expect(getAccessToken()).toBe('a');
  });

  it('hydrate loads /auth/me', async () => {
    setTokens('a', 'r');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: '1', email: 'a@b.co', displayName: 'A' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().hydrated).toBe(true);
    expect(useAuthStore.getState().user?.displayName).toBe('A');
  });

  it('hydrate without token sets hydrated', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().hydrated).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('hydrate clears tokens on 401', async () => {
    setTokens('a', 'r');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401, statusText: 'Unauthorized' })),
    );
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('logout clears session', async () => {
    setTokens('a', 'r');
    useAuthStore.setState({
      user: { id: '1', email: 'a@b.co', displayName: 'A' },
      hydrated: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('updateAccount patches profile', async () => {
    setTokens('a', 'r');
    useAuthStore.setState({
      user: { id: '1', email: 'a@b.co', displayName: 'A' },
      hydrated: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: '1',
              email: 'a@b.co',
              displayName: 'Ada',
              locale: 'en',
              theme: 'dark',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    const user = await useAuthStore.getState().updateAccount({ displayName: 'Ada' });
    expect(user.displayName).toBe('Ada');
    expect(useAuthStore.getState().user?.displayName).toBe('Ada');
  });

  it('hydrate keeps entitlements and userHasFeature respects them', async () => {
    setTokens('a', 'r');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: '1',
              email: 'a@b.co',
              displayName: 'A',
              entitlements: { features: ['dashboard', 'workbench'] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    await useAuthStore.getState().hydrate();
    const user = useAuthStore.getState().user;
    expect(userHasFeature(user, 'workbench')).toBe(true);
    expect(userHasFeature(user, 'weighing')).toBe(false);
  });
});
