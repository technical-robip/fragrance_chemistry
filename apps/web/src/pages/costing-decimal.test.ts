import { describe, expect, it } from 'vitest';
import {
  finalizeCostingDecimal,
  isIncompleteDecimalDraft,
  liveCostingDecimal,
} from './costing-decimal';

describe('costing decimal drafts', () => {
  it('treats empty text and a trailing separator as still being typed', () => {
    expect(isIncompleteDecimalDraft('')).toBe(true);
    expect(isIncompleteDecimalDraft('  ')).toBe(true);
    expect(isIncompleteDecimalDraft('1.')).toBe(true);
    expect(isIncompleteDecimalDraft('1,')).toBe(true);
    expect(isIncompleteDecimalDraft('1.2')).toBe(false);
    expect(isIncompleteDecimalDraft('1,2')).toBe(false);
  });

  it('accepts a period or a comma and clamps a finished draft', () => {
    expect(liveCostingDecimal('1.2', 0, 8)).toBe(1.2);
    expect(liveCostingDecimal('1,2', 0, 8)).toBe(1.2);
    expect(liveCostingDecimal('9', 0, 8)).toBe(8);
    expect(liveCostingDecimal('0', 0, 8)).toBe(0);
  });

  it('leaves an unfinished or garbage draft uncommitted', () => {
    expect(liveCostingDecimal('', 0, 8)).toBeNull();
    expect(liveCostingDecimal('1.', 0, 8)).toBeNull();
    expect(liveCostingDecimal('1,', 0, 8)).toBeNull();
    expect(liveCostingDecimal('abc', 0, 8)).toBeNull();
    expect(liveCostingDecimal('-1', 0, 8)).toBeNull();
  });

  it('finalizes a trailing separator and reverts empty or garbage text', () => {
    expect(finalizeCostingDecimal('1.', 0, 15)).toBe(1);
    expect(finalizeCostingDecimal('1,', 0, 15)).toBe(1);
    expect(finalizeCostingDecimal('0,5', 0, 15)).toBe(0.5);
    expect(finalizeCostingDecimal('20', 0, 15)).toBe(15);
    expect(finalizeCostingDecimal('', 10, 1000)).toBeNull();
    expect(finalizeCostingDecimal('abc', 10, 1000)).toBeNull();
  });
});
