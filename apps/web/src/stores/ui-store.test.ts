import { beforeEach, describe, expect, it } from 'vitest';
import { applyLocale, applyTheme, useUiStore } from './ui-store';

describe('ui-store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = '';
    document.documentElement.lang = '';
    useUiStore.setState({ theme: 'dark', locale: 'en', navOpen: false });
  });

  it('hydrates and toggles theme', () => {
    localStorage.setItem('fc.theme', 'light');
    localStorage.setItem('fc.locale', 'fr');
    useUiStore.getState().hydrateUi();
    expect(useUiStore.getState().theme).toBe('light');
    expect(useUiStore.getState().locale).toBe('fr');
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('sets locale and nav', () => {
    useUiStore.getState().setLocale('de');
    expect(useUiStore.getState().locale).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    useUiStore.getState().setNavOpen(true);
    expect(useUiStore.getState().navOpen).toBe(true);
    useUiStore.getState().toggleNav();
    expect(useUiStore.getState().navOpen).toBe(false);
  });

  it('applies theme and locale helpers', () => {
    applyTheme('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    applyLocale('it');
    expect(document.documentElement.lang).toBe('it');
  });
});
