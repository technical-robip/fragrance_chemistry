import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import ro from '../i18n/locales/ro.json';
import fr from '../i18n/locales/fr.json';
import de from '../i18n/locales/de.json';
import es from '../i18n/locales/es.json';
import itLocale from '../i18n/locales/it.json';

const locales = { en, ro, fr, de, es, it: itLocale };

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('landing locale keys', () => {
  const required = leafKeys(en.landing, 'landing').filter((key) => !key.includes('.items'));

  it('keeps landing keys in every locale', () => {
    for (const lng of Object.keys(locales)) {
      const bundle = locales[lng as keyof typeof locales] as Record<string, unknown>;
      for (const key of required) {
        const parts = key.split('.');
        let cur: unknown = bundle;
        for (const part of parts) {
          cur = (cur as Record<string, unknown> | undefined)?.[part];
        }
        expect(cur, `${lng}:${key}`).toBeDefined();
      }
    }
  });

  it('ships eight FAQ questions in every locale', () => {
    for (const [lng, bundle] of Object.entries(locales)) {
      const items = (bundle as { landing: { faq: { items: unknown[] } } }).landing.faq.items;
      expect(items, lng).toHaveLength(8);
    }
  });
});
