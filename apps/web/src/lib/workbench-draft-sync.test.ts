import { describe, expect, it } from 'vitest';
import { juiceClassFromConcentration } from '@fc/shared';
import {
  JUICE_CLASS_PRESET,
  concentrationAfterServerSync,
  juiceClassPresetPct,
  shouldApplyServerLines,
  shouldClearDirtyAfterSave,
} from './workbench-draft-sync';

describe('workbench-draft-sync', () => {
  describe('concentrationAfterServerSync', () => {
    it('keeps local juice-class selection while dirty even if server still has the previous pct', () => {
      const localPct = JUICE_CLASS_PRESET.extrait;
      const serverPct = JUICE_CLASS_PRESET.edp;

      const next = concentrationAfterServerSync({
        serverPct,
        localPct,
        dirty: true,
        formulaSwitched: false,
      });

      expect(next).toBe(25);
      expect(juiceClassFromConcentration(next)).toBe('extrait');
    });

    it('applies server concentration once the draft is clean', () => {
      expect(
        concentrationAfterServerSync({
          serverPct: JUICE_CLASS_PRESET.edt,
          localPct: JUICE_CLASS_PRESET.extrait,
          dirty: false,
          formulaSwitched: false,
        }),
      ).toBe(10);
    });

    it('always takes server concentration when switching formulas', () => {
      expect(
        concentrationAfterServerSync({
          serverPct: JUICE_CLASS_PRESET.edp,
          localPct: JUICE_CLASS_PRESET.extrait,
          dirty: true,
          formulaSwitched: true,
        }),
      ).toBe(17);
    });
  });

  describe('autosave race with juice-class chips', () => {
    it('does not visually reset EXTRAIT → previous class when a stale refetch lands mid-debounce', () => {
      // User had EDP saved on server, then clicked EXTRAIT (autosave still pending).
      let localPct = JUICE_CLASS_PRESET.edp;
      let dirty = false;

      const selectExtrait = () => {
        const pct = juiceClassPresetPct(juiceClassFromConcentration(localPct), 'extrait');
        expect(pct).toBe(25);
        localPct = pct!;
        dirty = true;
      };
      selectExtrait();

      // Stale formula query still reports EDP — same sabotage path as Workbench sync effect.
      localPct = concentrationAfterServerSync({
        serverPct: JUICE_CLASS_PRESET.edp,
        localPct,
        dirty,
        formulaSwitched: false,
      });

      expect(localPct).toBe(25);
      expect(juiceClassFromConcentration(localPct)).toBe('extrait');
      expect(shouldApplyServerLines({ dirty, formulaSwitched: false })).toBe(false);
    });

    it('does not clear dirty when a newer chip click landed during an in-flight save', () => {
      let editGeneration = 0;
      let dirty = false;
      let localPct = JUICE_CLASS_PRESET.edp;

      // First click: EXTRAIT → schedule save (generation 1)
      editGeneration += 1;
      dirty = true;
      localPct = juiceClassPresetPct(juiceClassFromConcentration(localPct), 'extrait')!;
      const mutateStartGen = editGeneration;

      // During PATCH, user clicks EDT (generation 2)
      editGeneration += 1;
      dirty = true;
      localPct = juiceClassPresetPct(juiceClassFromConcentration(localPct), 'edt')!;

      const clearDirty = shouldClearDirtyAfterSave({
        editGenerationAtMutateStart: mutateStartGen,
        currentEditGeneration: editGeneration,
      });
      expect(clearDirty).toBe(false);

      // Completing save must not unlock a stale server snap-back.
      if (clearDirty) dirty = false;
      localPct = concentrationAfterServerSync({
        serverPct: JUICE_CLASS_PRESET.extrait, // what the completed save wrote
        localPct,
        dirty,
        formulaSwitched: false,
      });

      expect(dirty).toBe(true);
      expect(localPct).toBe(10);
      expect(juiceClassFromConcentration(localPct)).toBe('edt');
    });

    it('treats an older in-flight save as stale so cache must not snap chips back', () => {
      const mutateStartGen = 1;
      const currentEditGeneration = 2; // user clicked another class while saving
      expect(
        shouldClearDirtyAfterSave({
          editGenerationAtMutateStart: mutateStartGen,
          currentEditGeneration,
        }),
      ).toBe(false);

      // Local draft stays on the newer chip; stale server payload must be ignored.
      const localPct = concentrationAfterServerSync({
        serverPct: JUICE_CLASS_PRESET.extrait,
        localPct: JUICE_CLASS_PRESET.edt,
        dirty: true,
        formulaSwitched: false,
      });
      expect(juiceClassFromConcentration(localPct)).toBe('edt');
    });

    it('clears dirty only when no edits occurred during save', () => {
      expect(
        shouldClearDirtyAfterSave({
          editGenerationAtMutateStart: 3,
          currentEditGeneration: 3,
        }),
      ).toBe(true);
    });
  });

  describe('juiceClassPresetPct', () => {
    it('returns null when the chip is already selected', () => {
      expect(juiceClassPresetPct('edp', 'edp')).toBeNull();
    });

    it('maps each chip to its preset percent', () => {
      expect(juiceClassPresetPct('edt', 'edp')).toBe(17);
      expect(juiceClassPresetPct('edp', 'extrait')).toBe(25);
      expect(juiceClassPresetPct('extrait', 'edt')).toBe(10);
    });
  });
});
