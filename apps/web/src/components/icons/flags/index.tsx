import type { AppLocale } from '@/stores/ui-store';
import { FlagDe } from './FlagDe';
import { FlagEn } from './FlagEn';
import { FlagEs } from './FlagEs';
import { FlagFr } from './FlagFr';
import { FlagIt } from './FlagIt';
import { FlagRo } from './FlagRo';

const MAP = {
  en: FlagEn,
  fr: FlagFr,
  it: FlagIt,
  es: FlagEs,
  de: FlagDe,
  ro: FlagRo,
} as const;

export function LocaleFlag({ locale }: { locale: AppLocale }) {
  const Comp = MAP[locale];
  return <Comp />;
}
