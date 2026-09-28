import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FAMILY_COLORS } from '@fc/shared';
import { applyFamilyColors, resolvedFamilyColors } from './apply-family-colors';

describe('applyFamilyColors', () => {
  afterEach(() => {
    applyFamilyColors(null);
  });

  it('writes a valid override and leaves the other families on the stylesheet', () => {
    applyFamilyColors({ Floral: '#ff00aa' });
    expect(document.documentElement.style.getPropertyValue('--fc-family-floral')).toBe('#ff00aa');
    expect(document.documentElement.style.getPropertyValue('--fc-family-fresh')).toBe('');
  });

  it('ignores a bad hex and clears a previous override', () => {
    applyFamilyColors({ Floral: '#ff00aa' });
    applyFamilyColors({ Floral: 'pink' });
    expect(document.documentElement.style.getPropertyValue('--fc-family-floral')).toBe('');
  });

  it('clears every override when the scheme is empty', () => {
    applyFamilyColors({ Citrus: '#112233', Special: '#445566' });
    applyFamilyColors(null);
    expect(document.documentElement.style.getPropertyValue('--fc-family-citrus')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--fc-family-special')).toBe('');
  });
});

describe('resolvedFamilyColors', () => {
  it('fills missing keys from the default palette', () => {
    expect(resolvedFamilyColors(null).Floral).toBe(DEFAULT_FAMILY_COLORS.Floral);
    expect(resolvedFamilyColors({ Floral: '#abcdef' }).Floral).toBe('#abcdef');
    expect(resolvedFamilyColors({ Floral: '#abcdef' }).Fresh).toBe(DEFAULT_FAMILY_COLORS.Fresh);
  });
});
