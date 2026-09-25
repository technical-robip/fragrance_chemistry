import { describe, expect, it } from 'vitest';
import { parseNonNegativeDecimal } from './DecimalCell';

describe('parseNonNegativeDecimal', () => {
  it('accepts zero and comma decimals', () => {
    expect(parseNonNegativeDecimal('0')).toBe(0);
    expect(parseNonNegativeDecimal('0,025')).toBe(0.025);
    expect(parseNonNegativeDecimal('1.125')).toBe(1.125);
  });

  it('rejects empty and negative', () => {
    expect(parseNonNegativeDecimal('')).toBeNull();
    expect(parseNonNegativeDecimal('  ')).toBeNull();
    expect(parseNonNegativeDecimal('-1')).toBeNull();
    expect(parseNonNegativeDecimal('abc')).toBeNull();
  });
});
