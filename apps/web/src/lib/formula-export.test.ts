import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { downloadBinary, exportFormulaCsv, exportFormulaXls } from './formula-export';

describe('formula-export', () => {
  const clicks: Array<{ download: string; href: string }> = [];

  beforeEach(() => {
    clicks.length = 0;
    vi.stubGlobal(
      'URL',
      class {
        static createObjectURL() {
          return 'blob:test';
        }
        static revokeObjectURL() {}
      },
    );
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = () => {
          clicks.push({ download: el.download, href: el.href });
        };
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const payload = {
    name: 'Rose Oud',
    concentrationPct: 20,
    batchGrams: 10,
    totalPercent: 100,
    rows: [
      { materialName: 'Hedione', percent: 40, amount: 4, unit: 'g' },
      { materialName: 'Iso E Super', percent: 60, amount: 6, unit: 'g' },
    ],
  };

  it('downloads csv', () => {
    exportFormulaCsv(payload);
    expect(clicks[0]?.download).toMatch(/rose-oud\.csv$/);
  });

  it('downloads xls', () => {
    exportFormulaXls(payload);
    expect(clicks[0]?.download).toMatch(/rose-oud\.xls$/);
  });

  it('downloads binary blobs', () => {
    downloadBinary(
      'rose-oud.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      new Blob(['xlsx']),
    );
    expect(clicks[0]?.download).toBe('rose-oud.xlsx');
  });
});
