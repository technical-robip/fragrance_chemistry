import { describe, expect, it } from 'vitest';
import { standardsFromPositionedText, type PositionedText } from './ifra-pdf';

function item(str: string, x: number, y: number): PositionedText {
  return { str, x, y };
}

describe('standardsFromPositionedText', () => {
  it('reads a restriction grid and a prohibition without percents', () => {
    const items: PositionedText[] = [
      item('IFRA_STD_001', 50, 528),
      item('51', 67, 528),
      item('2020', 92, 528),
      item('Acetic acid anhydride', 144, 528),
      item('144020-22-4', 174, 528),
      item('28371-99-5', 174, 526),
      item('Trimofix (commercial name)', 230, 528),
      item('RESTRICTION', 265, 528),
      item('DERMAL SENSITIZATION', 277, 528),
      item('None to consider', 484, 528),
      item('0,00016', 514, 528),
      item('2,4', 554, 528),
      item('No Restriction', 738, 528),
      item('IFRA_STD_266', 50, 400),
      item('3-Acetyl-2,5-dimethylfuran', 144, 400),
      item('10599-70-9', 174, 400),
      item('PROHIBITION', 265, 400),
      item('GENOTOXICITY', 277, 400),
    ];

    const drafts = standardsFromPositionedText(items);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      code: 'IFRA_STD_001',
      name: 'Acetic acid anhydride',
      amendment: 51,
      standardType: 'RESTRICTION',
      casNumbers: ['144020-22-4', '28371-99-5'],
    });
    expect(drafts[0]?.limits.find((row) => row.categoryCode === '1')?.maxPercent).toBe(0.00016);
    expect(drafts[0]?.limits.find((row) => row.categoryCode === '4')?.maxPercent).toBe(2.4);
    expect(drafts[0]?.limits.find((row) => row.categoryCode === '12')?.unrestricted).toBe(true);
    expect(drafts[1]).toMatchObject({
      code: 'IFRA_STD_266',
      standardType: 'PROHIBITION',
      limits: [],
    });
  });

  it('rejoins a specification type split across lines', () => {
    const drafts = standardsFromPositionedText([
      item('IFRA_STD_003', 50, 100),
      item('Allyl phenoxyacetate', 144, 100),
      item('7493-74-5', 174, 100),
      item('RESTRICTION_SP', 265, 100),
      item('ECIFICATION', 265, 98),
    ]);
    expect(drafts[0]?.standardType).toBe('RESTRICTION_SPECIFICATION');
  });
});
