import { beforeEach, describe, expect, it } from 'vitest';
import { readLineSort, readShowFamily, writeLineSort, writeShowFamily } from './line-list-prefs';

describe('line list prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to date-added ascending and family hidden', () => {
    expect(readLineSort()).toEqual({ key: 'dateAdded', direction: 'asc' });
    expect(readShowFamily()).toBe(false);
  });

  it('round-trips a sort and the family switch', () => {
    writeLineSort({ key: 'pyramid', direction: 'desc' });
    writeShowFamily(true);
    expect(readLineSort()).toEqual({ key: 'pyramid', direction: 'desc' });
    expect(readShowFamily()).toBe(true);
    writeShowFamily(false);
    expect(readShowFamily()).toBe(false);
  });

  it('falls back when stored sort is garbage', () => {
    localStorage.setItem('fc.lineList.sort', '{');
    expect(readLineSort()).toEqual({ key: 'dateAdded', direction: 'asc' });
    localStorage.setItem('fc.lineList.sort', JSON.stringify({ key: 'nope', direction: 'asc' }));
    expect(readLineSort()).toEqual({ key: 'dateAdded', direction: 'asc' });
  });
});
