import type { AllergenLimitsByCategory } from '@fc/formula-engine';
import type { FormulaLine, IfraCategory } from '@fc/formula-engine';

/**
 * A worked example the visitor can move. Materials, CAS numbers and cost per
 * gram are real rows from the shipped catalog seed; the allergen fractions and
 * category limits are illustrative, because IFRA standard data is not
 * redistributable and is imported by the lab operator instead.
 *
 * The example is built around the two mechanisms that are hard to claim and
 * easy to show: Linalool arriving from three separate sources, and a target
 * mass (0.0003 g of damascenone) that no bench scale can weigh.
 */

export const DEMO_BATCH_GRAMS = 10;
export const DEMO_CONCENTRATION_PCT = 20;
export const DEMO_IFRA_CATEGORY: IfraCategory = 4;

/** The mass a common 3-decimal bench scale can still resolve. */
export const SCALE_RESOLUTION_GRAMS = 0.001;

export const DEMO_CARRIER_ID = 'carrier';

export const DEMO_LINES: FormulaLine[] = [
  {
    id: 'bergamot',
    materialId: '8007-75-8',
    label: 'Bergamot EO',
    amountGrams: 0.62,
    concentrationKind: 'neat',
    pyramidNote: 'top',
    costPerGram: 0.12,
    allergens: [
      { name: 'Limonene', fraction: 0.38 },
      { name: 'Linalool', fraction: 0.12 },
    ],
  },
  {
    id: 'petitgrain',
    materialId: '8014-17-3',
    label: 'Petitgrain Bigarade EO',
    amountGrams: 0.28,
    concentrationKind: 'neat',
    pyramidNote: 'top',
    costPerGram: 0.14,
    allergens: [
      { name: 'Linalool', fraction: 0.22 },
      { name: 'Limonene', fraction: 0.05 },
    ],
  },
  {
    id: 'lemon',
    materialId: '8008-56-8',
    label: 'Lemon EO',
    amountGrams: 0.18,
    concentrationKind: 'neat',
    pyramidNote: 'top',
    costPerGram: 0.09,
    allergens: [
      { name: 'Limonene', fraction: 0.65 },
      { name: 'Citral', fraction: 0.03 },
    ],
  },
  {
    id: 'hedione',
    materialId: '24851-98-7',
    label: 'Hedione',
    amountGrams: 0.42,
    concentrationKind: 'neat',
    pyramidNote: 'middle',
    costPerGram: 0.09,
  },
  {
    id: 'linalool',
    materialId: '78-70-6',
    label: 'Linalool',
    amountGrams: 0.12,
    concentrationKind: 'neat',
    pyramidNote: 'middle',
    costPerGram: 0.045,
    allergens: [{ name: 'Linalool', fraction: 1 }],
  },
  {
    id: 'damascenone',
    materialId: '23696-85-7',
    label: 'Damascenone Alpha',
    amountGrams: 0.03,
    concentrationKind: 'dilution',
    activeFraction: 0.01,
    pyramidNote: 'middle',
    costPerGram: 0.125,
  },
  {
    id: 'isoe',
    materialId: '54464-57-2',
    label: 'Iso E Super',
    amountGrams: 0.22,
    concentrationKind: 'neat',
    pyramidNote: 'base',
    costPerGram: 0.07,
  },
  {
    id: 'ambroxan',
    materialId: '6790-58-5',
    label: 'Ambroxan',
    amountGrams: 0.09,
    concentrationKind: 'neat',
    pyramidNote: 'base',
    costPerGram: 1.85,
  },
  {
    id: 'musk',
    materialId: '105-95-3',
    label: 'Musk T',
    amountGrams: 0.04,
    concentrationKind: 'neat',
    pyramidNote: 'base',
    costPerGram: 0.11,
  },
  {
    id: DEMO_CARRIER_ID,
    materialId: 'carrier',
    label: "Perfumer's alcohol",
    amountGrams: 8,
    concentrationKind: 'dilution',
    activeFraction: 0,
    costPerGram: 0.012,
  },
];

/** Lines the visitor can move in the interactive division. */
export const DEMO_ADJUSTABLE_IDS = [
  'bergamot',
  'petitgrain',
  'linalool',
  'isoe',
  'ambroxan',
  'musk',
] as const;

/** Real catalog families, used only to drive the landing radar. */
export const DEMO_FAMILIES: Record<string, string> = {
  bergamot: 'Fresh',
  petitgrain: 'Green',
  lemon: 'Fresh',
  hedione: 'Floral',
  linalool: 'Floral',
  damascenone: 'Floral',
  isoe: 'Woody',
  ambroxan: 'Amber',
  musk: 'Animalic',
};

/**
 * Illustrative limits, not the IFRA standard. Real limits are loaded by the lab
 * operator through the importer.
 */
const ILLUSTRATIVE_CATEGORY_LIMITS = { Linalool: 2, Limonene: 3, Citral: 0.6 };

export const ILLUSTRATIVE_LIMITS: AllergenLimitsByCategory = {
  1: ILLUSTRATIVE_CATEGORY_LIMITS,
  2: ILLUSTRATIVE_CATEGORY_LIMITS,
  3: ILLUSTRATIVE_CATEGORY_LIMITS,
  4: ILLUSTRATIVE_CATEGORY_LIMITS,
  5: ILLUSTRATIVE_CATEGORY_LIMITS,
  6: ILLUSTRATIVE_CATEGORY_LIMITS,
  7: ILLUSTRATIVE_CATEGORY_LIMITS,
  8: ILLUSTRATIVE_CATEGORY_LIMITS,
  9: ILLUSTRATIVE_CATEGORY_LIMITS,
  10: ILLUSTRATIVE_CATEGORY_LIMITS,
  11: ILLUSTRATIVE_CATEGORY_LIMITS,
  12: ILLUSTRATIVE_CATEGORY_LIMITS,
};

/** How many distinct lines contribute a given allergen. */
export function allergenSourceCount(lines: FormulaLine[], allergen: string): number {
  return lines.filter((line) => line.allergens?.some((a) => a.name === allergen)).length;
}
