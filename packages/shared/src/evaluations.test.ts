import { describe, expect, it } from 'vitest';
import {
  describeOpenSitting,
  evaluationLineMarkSchema,
  hoursForSlot,
  joinEvaluationNotes,
  splitEvaluationNotes,
  latestProbeMark,
  columnFamilyMarkProfile,
  columnFamilyPower,
  columnMarkCoverage,
  columnMarkMix,
  columnMarkMixPercent,
  EVALUATION_LINE_MARKS_MAX,
  FOCUS_LINE_CAP,
  familyPowerYMax,
  familyPowerStackKey,
  familyPowerToRadarAxes,
  familyPowerDeltas,
  formulaFamilyIds,
  juiceAtColumn,
  MARK_PRESENCE,
  mixYMax,
  overlayWorkingSitting,
  previousBatchColumn,
  visibleBlotterLines,
  markAtColumn,
  markForMaterial,
  nextEmptySlot,
  nextMacerationDay,
  ratingSparkline,
  resolveSittingId,
  sittingSlotCount,
  slotForHours,
  toggleLineMark,
} from './evaluations';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('evaluation sitting helpers', () => {
  it('maps playhead hours to a single organoleptic slot', () => {
    expect(slotForHours(0)).toBe('t0Notes');
    expect(slotForHours(0.4)).toBe('t30mNotes');
    expect(slotForHours(3)).toBe('t4hNotes');
    expect(slotForHours(20)).toBe('t24hNotes');
    expect(hoursForSlot('t30mNotes')).toBe(0.5);
  });

  it('resolves the newest sitting for a formula and day', () => {
    const rows = [
      { id: 'new', formulaId: 'f1', macerationDay: 1 },
      { id: 'old', formulaId: 'f1', macerationDay: 1 },
      { id: 'd7', formulaId: 'f1', macerationDay: 7 },
    ];
    expect(resolveSittingId(rows, 'f1', 1)).toBe('new');
    expect(resolveSittingId(rows, 'f1', 7)).toBe('d7');
    expect(resolveSittingId(rows, 'f2', 1)).toBeNull();
  });

  it('tracks empty slots and next maceration day', () => {
    expect(nextEmptySlot({ t0Notes: 'oil' })).toBe('t30mNotes');
    expect(
      nextEmptySlot({ t0Notes: 'a', t30mNotes: 'b', t4hNotes: 'c', t24hNotes: 'd' }),
    ).toBeNull();
    expect(nextEmptySlot({ t0Notes: 'oil' }, 7)).toBeNull();
    expect(sittingSlotCount({ t0Notes: 'a' })).toEqual({ filled: 1, total: 4 });
    expect(sittingSlotCount({ notes: 'settled' }, 7)).toEqual({ filled: 1, total: 1 });
    expect(sittingSlotCount({}, 14)).toEqual({ filled: 0, total: 1 });
    expect(nextMacerationDay(1)).toBe(7);
    expect(nextMacerationDay(30)).toBeNull();
  });

  it('describes an open sitting from the latest row', () => {
    const open = describeOpenSitting({
      id: 'e1',
      macerationDay: 1,
      t0Notes: 'lift',
      t30mNotes: null,
    });
    expect(open).toEqual({
      id: 'e1',
      macerationDay: 1,
      nextSlot: 't30mNotes',
      complete: false,
      nextDay: null,
    });
    expect(
      describeOpenSitting({
        id: 'e2',
        macerationDay: 1,
        t0Notes: 'a',
        t30mNotes: 'b',
        t4hNotes: 'c',
        t24hNotes: 'd',
      })?.nextDay,
    ).toBe(7);
  });

  it('joins timepoint notes and looks up line marks by material', () => {
    expect(joinEvaluationNotes({ t0Notes: 'a', t30mNotes: 'b' })).toBe('a\n---\nb');
    expect(splitEvaluationNotes('a\n---\nb')).toEqual({ t0Notes: 'a', t30mNotes: 'b' });
    expect(joinEvaluationNotes({ notes: 'macerated', t0Notes: 'old' }, 7)).toBe('macerated');
    expect(
      markForMaterial(
        [
          { materialId: uuid, mark: 'weak' },
          { lineId: '22222222-2222-4222-8222-222222222222', materialId: uuid, mark: 'harsh' },
        ],
        uuid,
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toBe('harsh');
  });

  it('scopes marks to a timepoint and treats unscoped rows as T+0 on day 1', () => {
    const parsed = evaluationLineMarkSchema.parse({
      materialId: uuid,
      mark: 'strong',
      timepoint: 't30mNotes',
    });
    expect(parsed.timepoint).toBe('t30mNotes');
    const marks = [
      { materialId: uuid, mark: 'weak' as const },
      { materialId: uuid, mark: 'strong' as const, timepoint: 't30mNotes' as const },
    ];
    expect(markForMaterial(marks, uuid, undefined, 't0Notes', 1)).toBe('weak');
    expect(markForMaterial(marks, uuid, undefined, 't30mNotes', 1)).toBe('strong');
    expect(markForMaterial(marks, uuid, undefined, 't4hNotes', 1)).toBeNull();
    expect(markForMaterial([{ materialId: uuid, mark: 'ok' }], uuid, undefined, null, 7)).toBe(
      'ok',
    );
  });

  it('toggles a slot mark without clobbering another interval', () => {
    const first = toggleLineMark([], { materialId: uuid }, 'weak', 1, 't0Notes');
    const both = toggleLineMark(first, { materialId: uuid }, 'strong', 1, 't30mNotes');
    expect(markForMaterial(both, uuid, undefined, 't0Notes', 1)).toBe('weak');
    expect(markForMaterial(both, uuid, undefined, 't30mNotes', 1)).toBe('strong');
    const cleared = toggleLineMark(both, { materialId: uuid }, 'weak', 1, 't0Notes');
    expect(markForMaterial(cleared, uuid, undefined, 't0Notes', 1)).toBeNull();
    expect(markForMaterial(cleared, uuid, undefined, 't30mNotes', 1)).toBe('strong');
  });

  it('builds heatmap cells and a rating sparkline from sittings', () => {
    const sittings = [
      {
        id: 'd1',
        formulaId: 'f1',
        macerationDay: 1,
        rating: 3,
        lineMarks: [
          { materialId: uuid, mark: 'weak' as const, timepoint: 't0Notes' as const },
          { materialId: uuid, mark: 'strong' as const, timepoint: 't30mNotes' as const },
        ],
      },
      {
        id: 'd7',
        formulaId: 'f1',
        macerationDay: 7,
        rating: 4,
        lineMarks: [{ materialId: uuid, mark: 'ok' as const }],
      },
    ];
    expect(markAtColumn(sittings, 'f1', uuid, 't0Notes')).toBe('weak');
    expect(markAtColumn(sittings, 'f1', uuid, 't30mNotes')).toBe('strong');
    expect(markAtColumn(sittings, 'f1', uuid, 'day7')).toBe('ok');
    expect(markAtColumn(sittings, 'f1', uuid, 'day14')).toBeNull();
    expect(ratingSparkline(sittings, 'f1')).toEqual([
      { columnId: 't24hNotes', rating: 3, sittingId: 'd1' },
      { columnId: 'day7', rating: 4, sittingId: 'd7' },
    ]);
    expect(columnMarkCoverage(sittings, 'f1', [{ materialId: uuid }], 't0Notes')).toEqual({
      marked: 1,
      total: 1,
    });
    expect(columnMarkCoverage(sittings, 'f1', [{ materialId: uuid }], 't4hNotes')).toEqual({
      marked: 0,
      total: 1,
    });
    expect(columnMarkMix(sittings, 'f1', [{ materialId: uuid }], 't0Notes')).toEqual({
      ok: 0,
      weak: 1,
      strong: 0,
      harsh: 0,
      marked: 1,
      total: 1,
    });
    expect(previousBatchColumn('t30mNotes')).toBe('t0Notes');
    expect(previousBatchColumn('t0Notes')).toBeNull();
    expect(mixYMax(6, 6)).toBe(6);
    expect(mixYMax(300, 12)).toBe(12);
  });

  it('caps attention rows on a large formula and ranks harsh first', () => {
    expect(EVALUATION_LINE_MARKS_MAX).toBeGreaterThanOrEqual(300 * 4);
    const many = Array.from({ length: 80 }, (_, i) => ({
      materialId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
      lineId: `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`,
      materialName: `Line ${i}`,
      pyramidNote: i === 0 ? 'top' : 'base',
    }));
    const sittings = [
      {
        id: 'd1',
        formulaId: 'f1',
        macerationDay: 1,
        rating: 3,
        lineMarks: [
          {
            materialId: many[0]!.materialId,
            lineId: many[0]!.lineId,
            mark: 'harsh' as const,
            timepoint: 't0Notes' as const,
          },
          {
            materialId: many[1]!.materialId,
            lineId: many[1]!.lineId,
            mark: 'strong' as const,
            timepoint: 't0Notes' as const,
          },
        ],
      },
    ];
    const focused = visibleBlotterLines(many, sittings, 'f1', 't0Notes');
    expect(focused.matched).toBe(80);
    expect(focused.visible).toHaveLength(FOCUS_LINE_CAP);
    expect(focused.visible[0]?.lineId).toBe(many[0]!.lineId);
    const unmarked = visibleBlotterLines(many, sittings, 'f1', 't0Notes', {
      mode: 'unmarked',
      cap: null,
    });
    expect(unmarked.matched).toBe(78);
    const searched = visibleBlotterLines(many, sittings, 'f1', 't0Notes', {
      query: 'Line 0',
      mode: 'all',
      cap: null,
    });
    expect(searched.matched).toBe(1);
    const pyramid = visibleBlotterLines(many, sittings, 'f1', 't0Notes', {
      pyramidNote: 'top',
      mode: 'all',
      cap: null,
    });
    expect(pyramid.matched).toBe(1);
  });

  it('reads live marks before a stale saved sitting for the same day', () => {
    const saved = {
      id: 'saved',
      formulaId: 'f1',
      macerationDay: 1,
      rating: 3,
      lineMarks: [] as { materialId: string; mark: 'ok' }[],
    };
    const live = {
      id: 'saved',
      formulaId: 'f1',
      macerationDay: 1,
      rating: 3,
      lineMarks: [{ materialId: uuid, mark: 'ok' as const, timepoint: 't0Notes' as const }],
    };
    const overlay = overlayWorkingSitting([saved], live);
    expect(columnMarkCoverage(overlay, 'f1', [{ materialId: uuid }], 't0Notes')).toEqual({
      marked: 1,
      total: 1,
    });
    expect(columnMarkCoverage(overlay, 'f1', [{ materialId: uuid }], 't30mNotes')).toEqual({
      marked: 0,
      total: 1,
    });
  });

  it('keeps a saved timepoint when the live sitting is empty after hydrate', () => {
    const saved = {
      id: 'saved',
      formulaId: 'f1',
      macerationDay: 1,
      rating: 3,
      lineMarks: [{ materialId: uuid, mark: 'weak' as const, timepoint: 't0Notes' as const }],
    };
    const live = {
      id: 'draft',
      formulaId: 'f1',
      macerationDay: 1,
      rating: 3,
      lineMarks: [] as { materialId: string; mark: 'ok' }[],
    };
    const overlay = overlayWorkingSitting([saved], live);
    expect(markAtColumn(overlay, 'f1', uuid, 't0Notes')).toBe('weak');
  });

  it('reads the latest saved probe for a workbench line', () => {
    expect(
      latestProbeMark(
        [
          {
            id: 'd1',
            macerationDay: 1,
            lineMarks: [
              { materialId: uuid, mark: 'weak', timepoint: 't0Notes' },
              { materialId: uuid, mark: 'strong', timepoint: 't30mNotes' },
            ],
          },
        ],
        uuid,
      ),
    ).toBe('strong');
    expect(
      latestProbeMark(
        [
          {
            id: 'd1',
            macerationDay: 1,
            lineMarks: [{ materialId: uuid, mark: 'weak', timepoint: 't0Notes' }],
          },
          { id: 'd7', macerationDay: 7, lineMarks: [{ materialId: uuid, mark: 'ok' }] },
        ],
        uuid,
        undefined,
        'd7',
      ),
    ).toBe('ok');
  });

  it('weights character by formula percent, not by line count', () => {
    const lemon = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const vanilla = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const orange = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const lines = [
      { materialId: lemon, percent: 11, olfactoryFamily: 'Citrus' },
      { materialId: vanilla, percent: 22, olfactoryFamily: 'Gourmand' },
      { materialId: orange, percent: 67, olfactoryFamily: 'Citrus' },
    ];
    const sittings = [
      {
        id: 'd1',
        formulaId: 'f1',
        macerationDay: 1,
        rating: 3,
        clarity: 'haze',
        opalescence: 'slight',
        solubility: 'complete',
        lineMarks: [
          { materialId: lemon, mark: 'ok' as const, timepoint: 't0Notes' as const },
          { materialId: vanilla, mark: 'harsh' as const, timepoint: 't0Notes' as const },
        ],
      },
    ];
    const mix = columnMarkMixPercent(sittings, 'f1', lines, 't0Notes');
    expect(mix.ok).toBeCloseTo(11);
    expect(mix.harsh).toBeCloseTo(22);
    expect(mix.unmarked).toBeCloseTo(67);
    expect(mix.marked).toBeCloseTo(33);
    expect(columnMarkMix(sittings, 'f1', lines, 't0Notes')).toEqual({
      ok: 1,
      weak: 0,
      strong: 0,
      harsh: 1,
      marked: 2,
      total: 3,
    });
    const citrus = columnMarkMixPercent(sittings, 'f1', lines, 't0Notes', { family: 'Citrus' });
    expect(citrus.ok).toBeCloseTo((11 / 78) * 100);
    expect(citrus.unmarked).toBeCloseTo((67 / 78) * 100);
    const profile = columnFamilyMarkProfile(sittings, 'f1', lines, 't0Notes');
    expect(formulaFamilyIds(lines)).toEqual(['Citrus', 'Gourmand']);
    expect(profile.find((row) => row.family === 'Gourmand')?.harsh).toBeCloseTo(22);
    expect(profile.find((row) => row.family === 'Citrus')?.ok).toBeCloseTo(11);
    expect(juiceAtColumn(sittings, 'f1', 't0Notes')).toBeNull();
    expect(juiceAtColumn(sittings, 'f1', 't24hNotes')).toMatchObject({
      rating: 3,
      clarity: 'haze',
      sittingId: 'd1',
    });
    const familyRows = visibleBlotterLines(
      lines.map((line) => ({ ...line, materialName: line.olfactoryFamily ?? '' })),
      sittings,
      'f1',
      't0Notes',
      { family: 'Gourmand', mode: 'all', cap: null },
    );
    expect(familyRows.matched).toBe(1);
    expect(familyRows.visible[0]?.materialId).toBe(vanilla);
  });

  it('shrinks weak citrus and inflates harsh gourmand vs recipe percent', () => {
    const lemon = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const vanilla = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const orange = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const lines = [
      { materialId: lemon, percent: 11, olfactoryFamily: 'Citrus' },
      { materialId: vanilla, percent: 22, olfactoryFamily: 'Gourmand' },
      { materialId: orange, percent: 67, olfactoryFamily: 'Citrus' },
    ];
    const sittings = [
      {
        id: 'd1',
        formulaId: 'f1',
        macerationDay: 1,
        rating: 3,
        lineMarks: [
          { materialId: lemon, mark: 'weak' as const, timepoint: 't0Notes' as const },
          { materialId: vanilla, mark: 'harsh' as const, timepoint: 't0Notes' as const },
        ],
      },
    ];
    const power = columnFamilyPower(sittings, 'f1', lines, 't0Notes');
    const citrus = power.find((row) => row.family === 'Citrus');
    const gourmand = power.find((row) => row.family === 'Gourmand');
    expect(citrus?.recipePct).toBeCloseTo(78);
    expect(citrus?.power).toBeCloseTo(11 * MARK_PRESENCE.weak);
    expect(citrus?.power ?? 0).toBeLessThan(citrus?.recipePct ?? 0);
    expect(gourmand?.recipePct).toBeCloseTo(22);
    expect(gourmand?.powerHarsh).toBeCloseTo(22 * MARK_PRESENCE.harsh);
    expect(gourmand?.power ?? 0).toBeGreaterThan(gourmand?.recipePct ?? 0);
    const allOk = columnFamilyPower(
      [
        {
          ...sittings[0]!,
          lineMarks: [
            { materialId: lemon, mark: 'ok' as const, timepoint: 't0Notes' as const },
            { materialId: vanilla, mark: 'ok' as const, timepoint: 't0Notes' as const },
            { materialId: orange, mark: 'ok' as const, timepoint: 't0Notes' as const },
          ],
        },
      ],
      'f1',
      lines,
      't0Notes',
    );
    expect(allOk.reduce((sum, row) => sum + row.power, 0)).toBeCloseTo(100);
    expect(familyPowerYMax([34, 100, 120])).toBe(120);
    expect(familyPowerStackKey('Gourmand', true)).toBe('Gourmand__harsh');
    const judged = familyPowerToRadarAxes(power, 'judged');
    const recipe = familyPowerToRadarAxes(power, 'recipe');
    expect(judged.map((axis) => axis.id)).toEqual(['Citrus', 'Gourmand']);
    expect(judged.some((axis) => /harsh/i.test(axis.id) || /harsh/i.test(axis.label))).toBe(false);
    expect(judged.find((axis) => axis.id === 'Citrus')?.value).toBeCloseTo(11 * MARK_PRESENCE.weak);
    expect(recipe.find((axis) => axis.id === 'Citrus')?.value).toBeCloseTo(78);
    expect(judged.find((axis) => axis.id === 'Gourmand')?.value).toBeGreaterThan(
      recipe.find((axis) => axis.id === 'Gourmand')?.value ?? 0,
    );

    const t0Ok = allOk;
    const t30WeakCitrus = columnFamilyPower(
      [
        {
          id: 'd1',
          formulaId: 'f1',
          macerationDay: 1,
          rating: 3,
          lineMarks: [
            { materialId: lemon, mark: 'weak' as const, timepoint: 't30mNotes' as const },
            { materialId: vanilla, mark: 'ok' as const, timepoint: 't30mNotes' as const },
            { materialId: orange, mark: 'ok' as const, timepoint: 't30mNotes' as const },
          ],
        },
      ],
      'f1',
      lines,
      't30mNotes',
    );
    const t24HarshGourmand = columnFamilyPower(
      [
        {
          id: 'd1',
          formulaId: 'f1',
          macerationDay: 1,
          rating: 3,
          lineMarks: [
            { materialId: lemon, mark: 'ok' as const, timepoint: 't24hNotes' as const },
            { materialId: vanilla, mark: 'harsh' as const, timepoint: 't24hNotes' as const },
            { materialId: orange, mark: 'ok' as const, timepoint: 't24hNotes' as const },
          ],
        },
      ],
      'f1',
      lines,
      't24hNotes',
    );
    const start = familyPowerDeltas(t0Ok, null);
    expect(start.map((row) => row.family)).toEqual(['Citrus', 'Gourmand']);
    expect(
      start.every((row) => row.delta === null && row.previous === null && row.deltaPct === null),
    ).toBe(true);
    expect(start.some((row) => /harsh/i.test(row.family))).toBe(false);

    const citrusDrop = familyPowerDeltas(t30WeakCitrus, t0Ok).find(
      (row) => row.family === 'Citrus',
    );
    expect(citrusDrop?.delta ?? 0).toBeLessThan(0);
    expect(citrusDrop?.deltaPct ?? 0).toBeLessThan(0);
    expect(citrusDrop?.now ?? 0).toBeLessThan(citrusDrop?.previous ?? 0);

    const gourmandLift = familyPowerDeltas(t24HarshGourmand, t0Ok).find(
      (row) => row.family === 'Gourmand',
    );
    expect(gourmandLift?.delta ?? 0).toBeGreaterThan(0);
    expect(gourmandLift?.deltaPct ?? 0).toBeGreaterThan(0);
    expect(familyPowerDeltas(t24HarshGourmand, t0Ok).some((row) => /harsh/i.test(row.family))).toBe(
      false,
    );
  });

  it('treats a late-day sitting as one note, not four T+ slots', () => {
    expect(
      describeOpenSitting({
        id: 'e7',
        macerationDay: 7,
        notes: null,
        t0Notes: null,
      }),
    ).toEqual({
      id: 'e7',
      macerationDay: 7,
      nextSlot: null,
      complete: false,
      nextDay: null,
    });
    expect(
      describeOpenSitting({
        id: 'e7b',
        macerationDay: 7,
        notes: 'rounded',
      })?.complete,
    ).toBe(true);
  });
});
