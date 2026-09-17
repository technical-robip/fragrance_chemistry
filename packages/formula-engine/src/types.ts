/** How a line's amount is expressed (neat material vs dilution in carrier). */
export type ConcentrationKind = 'neat' | 'dilution';

/** Olfactory pyramid placement for a material or line. */
export type PyramidNote = 'top' | 'middle' | 'base' | 'modifier';

/** IFRA product category (1–12); limits vary by category. */
export type IfraCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Traffic-light compliance vs a regulatory or internal limit. */
export type ComplianceStatus = 'green' | 'yellow' | 'red';

export interface AllergenContribution {
  /** Canonical allergen name (e.g. Linalool). */
  name: string;
  /** Fraction of the neat material that is this allergen (0–1). */
  fraction: number;
}

export interface FormulaLine {
  id: string;
  materialId: string;
  label: string;
  /** Grams added to the batch (dilution stock or neat). */
  amountGrams: number;
  concentrationKind: ConcentrationKind;
  /**
   * Active (neat) fraction in the line: 1 for neat, e.g. 0.01 for 1% dilution.
   * Defaults to 1 when omitted for neat lines.
   */
  activeFraction?: number;
  pyramidNote?: PyramidNote;
  /** Cost per gram of the stock line (dilution or neat as weighed). */
  costPerGram?: number;
  allergens?: AllergenContribution[];
}

export interface Formula {
  id: string;
  name: string;
  lines: FormulaLine[];
  /** Target batch size in grams; when set, line percents are derived from amounts. */
  batchSizeGrams?: number;
}

export interface DilutionSpec {
  /** Active material fraction in carrier (0–1), e.g. 0.01 for 1%. */
  activeFraction: number;
  carrierLabel: string;
}

export interface ScaledFormula extends Formula {
  scaleFactor: number;
  totalGrams: number;
}

export interface PyramidBreakdown {
  top: number;
  middle: number;
  base: number;
  modifier: number;
  unassigned: number;
  totalActiveGrams: number;
}

export interface LineCost {
  lineId: string;
  amountGrams: number;
  costPerGram: number;
  lineCost: number;
}

export interface FormulaCostSummary {
  lines: LineCost[];
  totalCost: number;
  costPerGramBatch: number;
  batchSizeGrams: number;
}

export interface LineDeviation {
  lineId: string;
  label: string;
  actualPercent: number;
  targetPercent: number;
  deltaPercent: number;
}

export interface DeviationReport {
  lines: LineDeviation[];
  totalActualPercent: number;
  totalTargetPercent: number;
}

export interface AllergenAggregate {
  name: string;
  /** Allergen mass in finished batch (grams). */
  gramsInBatch: number;
  /** Allergen as % of total batch mass. */
  percentOfBatch: number;
  limitPercent?: number;
  status: ComplianceStatus;
}

export interface IfraComplianceReport {
  category: IfraCategory;
  allergens: AllergenAggregate[];
  overallStatus: ComplianceStatus;
}

export interface IngredientForecastLine {
  materialId: string;
  label: string;
  totalGrams: number;
  totalActiveGrams: number;
}

export interface UsageForecast {
  batches: number;
  batchSizeGrams: number;
  ingredients: IngredientForecastLine[];
}
