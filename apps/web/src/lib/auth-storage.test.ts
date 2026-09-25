import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth-storage';

describe('auth-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and clears tokens', () => {
    expect(getAccessToken()).toBeNull();
    setTokens('a', 'r');
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
