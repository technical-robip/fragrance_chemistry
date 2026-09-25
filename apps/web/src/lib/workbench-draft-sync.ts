import type { JuiceClass } from '@fc/shared';

/** Preset concentrate % for workbench juice-class chips (EDT / EDP / Extrait). */
export const JUICE_CLASS_PRESET: Record<JuiceClass, number> = {
  edt: 10,
  edp: 17,
  extrait: 25,
};

/**
 * While a workbench draft is dirty, keep the local concentration so a stale
 * formula refetch (or autosave invalidate) cannot snap the EDT/EDP/EXTRAIT
 * chips back to the previous server value.
 */
export function concentrationAfterServerSync(args: {
  serverPct: number;
  localPct: number;
  dirty: boolean;
  formulaSwitched: boolean;
}): number {
  if (args.formulaSwitched) return args.serverPct;
  if (args.dirty) return args.localPct;
  return args.serverPct;
}

/** Same race as concentration: do not clobber in-progress line edits from a refetch. */
export function shouldApplyServerLines(args: {
  dirty: boolean;
  formulaSwitched: boolean;
}): boolean {
  return args.formulaSwitched || !args.dirty;
}

/**
 * Only clear the dirty flag when no newer local edits landed during the in-flight save.
 * Otherwise a completing autosave would unlock server sync and wipe the newer selection.
 */
export function shouldClearDirtyAfterSave(args: {
  editGenerationAtMutateStart: number;
  currentEditGeneration: number;
}): boolean {
  return args.editGenerationAtMutateStart === args.currentEditGeneration;
}

export function juiceClassPresetPct(currentClass: JuiceClass, next: JuiceClass): number | null {
  if (currentClass === next) return null;
  return JUICE_CLASS_PRESET[next];
}
