import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';
export type AppLocale = 'en' | 'fr' | 'it' | 'es' | 'de' | 'ro';

const THEME_KEY = 'fc.theme';
const LOCALE_KEY = 'fc.locale';

const LOCALES: AppLocale[] = ['en', 'fr', 'it', 'es', 'de', 'ro'];

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function readLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LOCALE_KEY);
  if (stored && LOCALES.includes(stored as AppLocale)) return stored as AppLocale;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  if (LOCALES.includes(nav as AppLocale)) return nav as AppLocale;
  return 'en';
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function applyLocale(locale: AppLocale) {
  document.documentElement.lang = locale;
}

type UiState = {
  theme: ThemeMode;
  locale: AppLocale;
  navOpen: boolean;
  hydrateUi: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLocale: (locale: AppLocale) => void;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'dark',
  locale: 'en',
  navOpen: false,
  hydrateUi: () => {
    const theme = readTheme();
    const locale = readLocale();
    applyTheme(theme);
    applyLocale(locale);
    set({ theme, locale });
  },
  setTheme: (theme) => {
    window.localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
  setLocale: (locale) => {
    window.localStorage.setItem(LOCALE_KEY, locale);
    applyLocale(locale);
    set({ locale });
  },
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleNav: () => set({ navOpen: !get().navOpen }),
}));

export const APP_LOCALES = LOCALES;
