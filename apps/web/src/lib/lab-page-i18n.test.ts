import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import ro from '../i18n/locales/ro.json';
import fr from '../i18n/locales/fr.json';
import de from '../i18n/locales/de.json';
import es from '../i18n/locales/es.json';
import itLocale from '../i18n/locales/it.json';

const locales = { en, ro, fr, de, es, it: itLocale };

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('lab page locale keys', () => {
  const required = leafKeys(en.costing, 'costing')
    .concat(leafKeys(en.inventory, 'inventory'))
    .concat(leafKeys(en.evaluation, 'evaluation'))
    .concat([
      'dashboard.sittingOpen',
      'dashboard.sittingOpenDay',
      'dashboard.sittingNext',
      'dashboard.sittingComplete',
      'dashboard.ifraVsEu',
      'dashboard.euLabelStatus',
      'dashboard.euAnnexTitle',
      'encyclopedia.libraryAccordsTitle',
      'encyclopedia.libraryAccordsBlurb',
    ]);

  it('keeps costing, inventory, evaluation, and sitting keys in every locale', () => {
    for (const lng of Object.keys(locales)) {
      const bundle = locales[lng as keyof typeof locales] as Record<string, unknown>;
      for (const key of required) {
        const parts = key.split('.');
        let cur: unknown = bundle;
        for (const part of parts) {
          cur = (cur as Record<string, unknown> | undefined)?.[part];
        }
        expect(cur, `${lng}:${key}`).toEqual(expect.any(String));
      }
    }
  });
});
