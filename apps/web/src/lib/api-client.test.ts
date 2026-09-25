import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'http://localhost:3000/api/v1');

import { apiRequest, ApiError } from './api-client';
import { clearTokens, setTokens } from './auth-storage';

describe('api-client', () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000/api/v1');
  });

  it('returns json on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const data = await apiRequest<{ ok: boolean }>('/health', { auth: false });
    expect(data.ok).toBe(true);
  });

  it('returns undefined on 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const data = await apiRequest('/x', { auth: false });
    expect(data).toBeUndefined();
  });

  it('throws when VITE_API_URL missing', async () => {
    vi.stubEnv('VITE_API_URL', '');
    await expect(apiRequest('/x', { auth: false })).rejects.toThrow(/VITE_API_URL/);
  });

  it('exposes api helpers', async () => {
    const { api } = await import('./api-client');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    expect(await api.get<{ ok: number }>('/health')).toEqual({ ok: 1 });
  });

  it('downloads blobs with filename from Content-Disposition', async () => {
    const { api } = await import('./api-client');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': 'attachment; filename="rose-oud.xlsx"',
            },
          }),
      ),
    );
    const file = await api.postBlob('/formulas/export', { all: true });
    expect(file.filename).toBe('rose-oud.xlsx');
    expect(file.mime).toContain('spreadsheetml');
    expect(file.blob.size).toBe(3);
  });

  it('throws ApiError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'nope' }), {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await expect(apiRequest('/x', { auth: false })).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes on 401 and retries', async () => {
    setTokens('old', 'refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401, statusText: 'Unauthorized' }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'new', refreshToken: 'refresh2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ me: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const data = await apiRequest<{ me: boolean }>('/auth/me');
    expect(data.me).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears tokens when refresh fails', async () => {
    setTokens('old', 'refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401, statusText: 'Unauthorized' }))
      .mockResolvedValueOnce(new Response('{}', { status: 401, statusText: 'Unauthorized' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
  });
});
