import type { DilutionSpec, FormulaLine } from './types';

const DEFAULT_TINY_DOSE_THRESHOLD_GRAMS = 0.001;

export interface TinyDoseConversion {
  original: FormulaLine;
  converted: FormulaLine;
  applied: boolean;
  reason?: string;
}

export interface AutoConvertTinyDosesOptions {
  /** Grams below which a neat line is converted to a dilution stock. */
  thresholdGrams?: number;
  dilution?: DilutionSpec;
  /** Suffix appended to label for dilution stock lines. */
  dilutionLabelSuffix?: string;
}

/**
 * Converts sub-threshold neat doses to weighable dilution stock (e.g. 0.0003 g Damascenone → 0.03 g of 1% in DPG).
 */
export function autoConvertTinyDoses(
  line: FormulaLine,
  options: AutoConvertTinyDosesOptions = {},
): TinyDoseConversion {
  const thresholdGrams = options.thresholdGrams ?? DEFAULT_TINY_DOSE_THRESHOLD_GRAMS;
  const dilution = options.dilution ?? { activeFraction: 0.01, carrierLabel: 'DPG' };
  const suffix =
    options.dilutionLabelSuffix ??
    ` (${dilution.activeFraction * 100}% in ${dilution.carrierLabel})`;

  if (line.concentrationKind !== 'neat') {
    return {
      original: line,
      converted: line,
      applied: false,
      reason: 'Line is already a dilution',
    };
  }

  if (line.amountGrams >= thresholdGrams) {
    return {
      original: line,
      converted: line,
      applied: false,
      reason: 'Amount is above threshold',
    };
  }

  if (dilution.activeFraction <= 0 || dilution.activeFraction > 1) {
    throw new Error('dilution.activeFraction must be in (0, 1]');
  }

  const activeGrams = line.amountGrams;
  const stockGrams = activeGrams / dilution.activeFraction;

  const converted: FormulaLine = {
    ...line,
    label: `${line.label}${suffix}`,
    amountGrams: roundGrams(stockGrams),
    concentrationKind: 'dilution',
    activeFraction: dilution.activeFraction,
  };

  return { original: line, converted, applied: true };
}

export function convertLinesTinyDoses(
  lines: FormulaLine[],
  options?: AutoConvertTinyDosesOptions,
): FormulaLine[] {
  return lines.map((line) => autoConvertTinyDoses(line, options).converted);
}

export function neatAmountFromDilution(stockGrams: number, activeFraction: number): number {
  return stockGrams * activeFraction;
}

export function dilutionStockForNeatTarget(neatGrams: number, activeFraction: number): number {
  if (activeFraction <= 0) throw new Error('activeFraction must be positive');
  return neatGrams / activeFraction;
}

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
