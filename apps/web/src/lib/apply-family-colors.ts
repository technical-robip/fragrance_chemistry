import {
  DEFAULT_FAMILY_COLORS,
  FAMILY_COLOR_KEYS,
  familyColorVariable,
  type FamilyColors,
} from '@fc/shared';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Overlay the signed-in scheme. A missing key falls back to the stylesheet default. */
export function applyFamilyColors(custom: Partial<FamilyColors> | null | undefined) {
  const root = document.documentElement;
  for (const key of FAMILY_COLOR_KEYS) {
    const hex = custom?.[key];
    const variable = familyColorVariable(key);
    if (hex && HEX.test(hex)) root.style.setProperty(variable, hex);
    else root.style.removeProperty(variable);
  }
}

export function resolvedFamilyColors(
  custom: Partial<FamilyColors> | null | undefined,
): FamilyColors {
  return { ...DEFAULT_FAMILY_COLORS, ...(custom ?? {}) };
}
