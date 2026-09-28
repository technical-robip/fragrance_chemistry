import { describe, expect, it } from 'vitest';
import { parseNonNegativeDecimal } from './DecimalCell';

describe('parseNonNegativeDecimal', () => {
  it('accepts zero and both period and comma decimals', () => {
    expect(parseNonNegativeDecimal('0')).toBe(0);
    expect(parseNonNegativeDecimal('0,025')).toBe(0.025);
    expect(parseNonNegativeDecimal('1.125')).toBe(1.125);
    expect(parseNonNegativeDecimal('12,5')).toBe(12.5);
    expect(parseNonNegativeDecimal('12.5')).toBe(12.5);
  });

  it('accepts a trailing separator from numpad entry', () => {
    expect(parseNonNegativeDecimal('1,')).toBe(1);
    expect(parseNonNegativeDecimal('1.')).toBe(1);
    expect(parseNonNegativeDecimal('0,')).toBe(0);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseNonNegativeDecimal('  1,25  ')).toBe(1.25);
    expect(parseNonNegativeDecimal('1 . 5')).toBe(1.5);
  });

  it('treats the last separator as the decimal when mixed', () => {
    expect(parseNonNegativeDecimal('1.234,5')).toBe(1234.5);
    expect(parseNonNegativeDecimal('1,234.5')).toBe(1234.5);
  });

  it('rejects empty and negative', () => {
    expect(parseNonNegativeDecimal('')).toBeNull();
    expect(parseNonNegativeDecimal('  ')).toBeNull();
    expect(parseNonNegativeDecimal(',')).toBeNull();
    expect(parseNonNegativeDecimal('.')).toBeNull();
    expect(parseNonNegativeDecimal('-1')).toBeNull();
    expect(parseNonNegativeDecimal('abc')).toBeNull();
  });
});
