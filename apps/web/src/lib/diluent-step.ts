import { diluentGrams } from '@fc/shared';

const PRESETS = ['alcohol', 'oil'] as const;

export type DiluentPreset = (typeof PRESETS)[number];

export type DiluentStep = {
  open: boolean;
  /** Canonical stored value: null means the alcohol preset. */
  stored: string | null;
  name: string;
  percent: number;
  grams: number;
};

export function diluentStoredLabel(preset: DiluentPreset, custom: string): string | null {
  const typed = custom.trim();
  if (typed) return typed;
  return preset === 'oil' ? 'oil' : null;
}

export function diluentEditorState(label: string | null | undefined): {
  preset: DiluentPreset;
  custom: string;
} {
  const trimmed = label?.trim() ?? '';
  if (!trimmed || trimmed.toLowerCase() === 'alcohol') return { preset: 'alcohol', custom: '' };
  if (trimmed.toLowerCase() === 'oil') return { preset: 'oil', custom: '' };
  return { preset: 'alcohol', custom: trimmed };
}

/** Name, complement percent, and grams for the weighing diluent step. */
export function diluentStep(input: {
  label?: string | null;
  concentrationPct: number;
  batchGrams: number;
  alcoholName: string;
  oilName: string;
}): DiluentStep {
  const stored = diluentStoredLabel(
    diluentEditorState(input.label).preset,
    diluentEditorState(input.label).custom,
  );
  const trimmed = input.label?.trim() ?? '';
  const name =
    !trimmed || trimmed.toLowerCase() === 'alcohol'
      ? input.alcoholName
      : trimmed.toLowerCase() === 'oil'
        ? input.oilName
        : trimmed;
  const percent = Math.max(0, Math.min(100, 100 - input.concentrationPct));
  const grams =
    input.concentrationPct > 0 && input.concentrationPct < 100
      ? diluentGrams(input.batchGrams, input.concentrationPct)
      : 0;
  return {
    open: grams > 0.0005,
    stored,
    name,
    percent,
    grams,
  };
}
