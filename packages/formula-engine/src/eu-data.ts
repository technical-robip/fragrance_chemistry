export type EuProductStay = 'leave_on' | 'rinse_off';

export type EuLabelAllergenDef = {
  inci: string;
  cas: string;
  aliases: string[];
  note?: string;
};

export type EuAnnexRestriction = 'ban' | 'max_percent' | 'note';

export type EuAnnexRule = {
  name: string;
  inci: string;
  cas: string;
  casAliases: string[];
  restriction: EuAnnexRestriction;
  maxPercent?: number;
  note: string;
};

/** Leave-on (fine fragrance) vs rinse-off declaration thresholds, Reg. 1223/2009 practice. */
export const EU_LABEL_THRESHOLD_PERCENT: Record<EuProductStay, number> = {
  leave_on: 0.001,
  rinse_off: 0.01,
};

/**
 * Original Annex III fragrance allergens used for cosmetic label declaration.
 * Curated subset — not the full 2023/1545 expansion.
 */
export const EU_LABEL_ALLERGENS: EuLabelAllergenDef[] = [
  {
    inci: 'Amyl Cinnamal',
    cas: '122-40-7',
    aliases: ['Amyl Cinnamic Aldehyde', 'Alpha-Amylcinnamaldehyde'],
  },
  { inci: 'Amylcinnamyl Alcohol', cas: '101-85-9', aliases: ['Amylcinnamic Alcohol'] },
  { inci: 'Anise Alcohol', cas: '105-13-5', aliases: ['Anisyl Alcohol'] },
  { inci: 'Benzyl Alcohol', cas: '100-51-6', aliases: [] },
  { inci: 'Benzyl Benzoate', cas: '120-51-4', aliases: [] },
  { inci: 'Benzyl Cinnamate', cas: '103-41-3', aliases: [] },
  { inci: 'Benzyl Salicylate', cas: '118-58-1', aliases: [] },
  { inci: 'Cinnamal', cas: '104-55-2', aliases: ['Cinnamic Aldehyde', 'Cinnamaldehyde'] },
  { inci: 'Cinnamyl Alcohol', cas: '104-54-1', aliases: [] },
  { inci: 'Citral', cas: '5392-40-5', aliases: [] },
  { inci: 'Citronellol', cas: '106-22-9', aliases: [] },
  { inci: 'Coumarin', cas: '91-64-5', aliases: [] },
  { inci: 'Eugenol', cas: '97-53-0', aliases: [] },
  { inci: 'Farnesol', cas: '4602-84-0', aliases: [] },
  { inci: 'Geraniol', cas: '106-24-1', aliases: [] },
  {
    inci: 'Hexyl Cinnamal',
    cas: '101-86-0',
    aliases: ['Hexyl Cinnamic Aldehyde', 'Alpha-Hexylcinnamaldehyde'],
  },
  { inci: 'Hydroxycitronellal', cas: '107-75-5', aliases: [] },
  { inci: 'Isoeugenol', cas: '97-54-1', aliases: [] },
  {
    inci: 'Alpha-Isomethyl Ionone',
    cas: '127-51-5',
    aliases: ['alpha-Isomethyl Ionone', 'Isomethyl Ionone'],
  },
  { inci: 'Limonene', cas: '5989-27-5', aliases: ['d-Limonene'] },
  { inci: 'Linalool', cas: '78-70-6', aliases: [] },
  { inci: 'Methyl 2-Octynoate', cas: '111-12-6', aliases: ['Methyl Heptine Carbonate'] },
  {
    inci: 'Evernia Prunastri Extract',
    cas: '90028-68-5',
    aliases: ['Oakmoss', 'Oakmoss Absolute', 'Evernia Prunastri'],
  },
  { inci: 'Evernia Furfuracea Extract', cas: '90028-67-4', aliases: ['Treemoss', 'Tree Moss'] },
  {
    inci: 'Butylphenyl Methylpropional',
    cas: '80-54-6',
    aliases: ['Lilial', 'BMHCA'],
    note: 'Prohibited in cosmetics (Reg. (EU) 2021/1905); retained for declaration of legacy stock.',
  },
  {
    inci: 'Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde',
    cas: '31906-04-4',
    aliases: ['Lyral', 'HICC'],
    note: 'Prohibited in cosmetics; retained for declaration of legacy stock.',
  },
];

/** High-impact fragrance Annex III entries. Not a complete annex. */
export const EU_ANNEX_III_FRAGRANCE: EuAnnexRule[] = [
  {
    name: 'Butylphenyl Methylpropional',
    inci: 'Butylphenyl Methylpropional',
    cas: '80-54-6',
    casAliases: [],
    restriction: 'ban',
    note: 'Lilial / BMHCA — prohibited in cosmetic products (Commission Regulation (EU) 2021/1905).',
  },
  {
    name: 'Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde',
    inci: 'Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde',
    cas: '31906-04-4',
    casAliases: [],
    restriction: 'ban',
    note: 'Lyral / HICC — prohibited in cosmetic products.',
  },
  {
    name: 'Atranol',
    inci: 'Atranol',
    cas: '526-37-4',
    casAliases: [],
    restriction: 'ban',
    note: 'Prohibited as such; historically present in oakmoss/treemoss extracts.',
  },
  {
    name: 'Chloroatranol',
    inci: 'Chloroatranol',
    cas: '57074-21-2',
    casAliases: [],
    restriction: 'ban',
    note: 'Prohibited as such; historically present in oakmoss/treemoss extracts.',
  },
  {
    name: 'Safrole',
    inci: 'Safrole',
    cas: '94-59-7',
    casAliases: [],
    restriction: 'max_percent',
    maxPercent: 0.01,
    note: 'Annex III — max 0.01% in the finished product except natural presence in essential oils.',
  },
  {
    name: 'Methyl Eugenol',
    inci: 'Methyl Eugenol',
    cas: '93-15-2',
    casAliases: [],
    restriction: 'max_percent',
    maxPercent: 0.01,
    note: 'Annex III fragrance-relevant restriction; finished-product limits vary by product type — this curated row uses 0.01% as a conservative fine-fragrance flag, not a full annex dump.',
  },
  {
    name: 'Musk Xylene',
    inci: 'Musk Xylene',
    cas: '81-15-2',
    casAliases: [],
    restriction: 'ban',
    note: 'Prohibited in cosmetic products.',
  },
  {
    name: 'Musk Ambrette',
    inci: 'Musk Ambrette',
    cas: '83-66-9',
    casAliases: [],
    restriction: 'ban',
    note: 'Prohibited in cosmetic products.',
  },
];

export function normalizeCas(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
