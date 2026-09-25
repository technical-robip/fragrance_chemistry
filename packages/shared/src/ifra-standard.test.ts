import { describe, expect, it } from 'vitest';
import { parseIfraLimitCell } from './ifra-categories';
import {
  collapseStandardLimits,
  limitsFromCategoryCells,
  parseIfraCategoryCell,
  planIfraAssociations,
  type IfraStandardDraft,
} from './ifra-standard';

const cells = [
  '0,00016',
  '0,13',
  '0,4',
  '2,4',
  '0,6',
  '0,52',
  '0,6',
  '0,17',
  '0,00016',
  '0,87',
  '0,87',
  '0,17',
  '2,2',
  '2,2',
  '4,4',
  '0,17',
  '0,17',
  'No Restriction',
];

function draft(
  partial: Partial<IfraStandardDraft> & Pick<IfraStandardDraft, 'code' | 'name'>,
): IfraStandardDraft {
  return {
    amendment: 51,
    publicationYears: null,
    lastPublicationYear: 2023,
    deadlineExisting: null,
    deadlineNew: null,
    standardType: 'RESTRICTION',
    riskDrivers: 'DERMAL SENSITIZATION',
    flavorNote: null,
    phototoxicityNote: null,
    restrictionNote: null,
    specificationNote: null,
    otherSources: null,
    otherSourcesNote: null,
    casComment: null,
    synonyms: [],
    casNumbers: [],
    limits: [],
    ...partial,
  };
}

describe('IFRA overview cells', () => {
  it('keeps European comma decimals', () => {
    expect(parseIfraLimitCell('0,00016')).toBe(0.00016);
    expect(parseIfraLimitCell('0.0050')).toBe(0.005);
    expect(parseIfraCategoryCell('No Restriction')).toEqual({
      maxPercent: null,
      unrestricted: true,
    });
    const limits = limitsFromCategoryCells(cells);
    expect(limits[0]).toEqual({ categoryCode: '1', maxPercent: 0.00016, unrestricted: false });
    expect(limits[17]).toEqual({ categoryCode: '12', maxPercent: null, unrestricted: true });
    const collapsed = collapseStandardLimits(limits);
    expect(collapsed.find((row) => row.categoryCode === '5')?.maxPercent).toBe(0.17);
    expect(collapsed.find((row) => row.categoryCode === '12')).toBeUndefined();
  });
});

describe('planIfraAssociations', () => {
  const catalog = [
    { name: 'Linalool', casNumber: '78-70-6' },
    { name: 'Linalool extra', casNumber: '78-70-6' },
    { name: 'Hedione', casNumber: null },
    { name: 'Mystery oil', casNumber: '8007-75-8' },
  ];

  it('links every CAS grade, fills a unique empty CAS, and creates prohibitions', () => {
    const actions = planIfraAssociations(
      [
        draft({
          code: 'IFRA_STD_010',
          name: 'Linalool',
          casNumbers: ['78-70-6'],
          synonyms: ['3,7-Dimethylocta-1,6-dien-3-ol'],
        }),
        draft({
          code: 'IFRA_STD_020',
          name: 'Methyl dihydrojasmonate',
          casNumbers: ['24851-98-7'],
          synonyms: ['Hedione (commercial name)'],
        }),
        draft({
          code: 'IFRA_STD_266',
          name: '3-Acetyl-2,5-dimethylfuran',
          casNumbers: ['10599-70-9'],
          standardType: 'PROHIBITION',
        }),
        draft({
          code: 'IFRA_STD_099',
          name: 'Not the oil',
          casNumbers: ['111-11-1'],
          synonyms: ['Unrelated ester'],
        }),
      ],
      catalog,
      [{ alias: 'Hedione', catalogName: 'Methyl dihydrojasmonate', casNumber: '24851-98-7' }],
    );

    expect(
      actions.filter((row) => row.action === 'link' && row.standardCode === 'IFRA_STD_010'),
    ).toHaveLength(2);
    expect(actions).toContainEqual({
      action: 'fill-cas',
      standardCode: 'IFRA_STD_020',
      materialName: 'Hedione',
      casNumber: '24851-98-7',
    });
    expect(actions).toContainEqual({
      action: 'create',
      standardCode: 'IFRA_STD_266',
      name: '3-Acetyl-2,5-dimethylfuran',
      casNumber: '10599-70-9',
      category: 'IFRA prohibition',
    });
    expect(
      actions.some((row) => row.action === 'create' && row.standardCode === 'IFRA_STD_099'),
    ).toBe(true);
    expect(actions.some((row) => row.action === 'link' && row.materialName === 'Mystery oil')).toBe(
      false,
    );
  });

  it('reports a CAS conflict without overwriting', () => {
    const actions = planIfraAssociations(
      [draft({ code: 'IFRA_STD_004', name: 'Hedione', casNumbers: ['24851-98-7'] })],
      [{ name: 'Hedione', casNumber: '111-11-1' }],
    );
    expect(actions).toContainEqual({
      action: 'conflict-cas',
      standardCode: 'IFRA_STD_004',
      materialName: 'Hedione',
      existingCas: '111-11-1',
      standardCas: '24851-98-7',
    });
    expect(actions.some((row) => row.action === 'create')).toBe(false);
  });
});
