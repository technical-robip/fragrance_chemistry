import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth-storage';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    throw new Error('VITE_API_URL is not configured');
  }
  return url.replace(/\/$/, '');
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });

  if (!res.ok) {
    clearTokens();
    return false;
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

async function ensureRefreshed(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { body, auth = true, headers, ...rest } = options;
  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const buildInit = (token: string | null): RequestInit => ({
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let token = auth ? getAccessToken() : null;
  let res = await fetch(url, buildInit(token));

  if (res.status === 401 && auth) {
    const refreshed = await ensureRefreshed();
    if (refreshed) {
      token = getAccessToken();
      res = await fetch(url, buildInit(token));
    }
  }

  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    throw new ApiError(res.statusText || 'Request failed', res.status, payload);
  }

  return res;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiFetch(path, options);

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, '').trim());
    } catch {
      return star[1].replace(/"/g, '').trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

export async function apiRequestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename: string; mime: string }> {
  const res = await apiFetch(path, options);
  const mime = res.headers.get('Content-Type')?.split(';')[0]?.trim() || 'application/octet-stream';
  const filename = parseFilename(res.headers.get('Content-Disposition')) || 'download';
  return { blob: await res.blob(), filename, mime };
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  postBlob: (path: string, body?: unknown) => apiRequestBlob(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
