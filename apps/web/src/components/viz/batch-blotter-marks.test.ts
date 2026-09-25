import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('evaluation mark colours', () => {
  it('keeps Weak amber and Strong violet on distinct tokens', () => {
    const tokens = readFileSync(resolve(here, '../../styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--fc-mark-weak:\s*var\(--fc-warn\)/);
    expect(tokens).toMatch(/--fc-mark-strong:\s*var\(--fc-note-base\)/);
    expect(tokens).toMatch(/--fc-mark-ok:\s*var\(--fc-accent\)/);
    expect(tokens).toMatch(/--fc-mark-harsh:\s*var\(--fc-danger\)/);

    const blotter = readFileSync(resolve(here, 'BatchBlotter.module.css'), 'utf8');
    expect(blotter).toMatch(/\.cellWeak[\s\S]*--fc-mark-weak/);
    expect(blotter).toMatch(/\.cellStrong[\s\S]*--fc-mark-strong/);
    expect(blotter).not.toMatch(/--fc-note-heart/);

    const chips = readFileSync(resolve(here, '../../pages/EvaluationPage.module.css'), 'utf8');
    expect(chips).toMatch(/\.markStrong[\s\S]*--fc-mark-strong/);
    expect(chips).not.toMatch(/\.markStrong[\s\S]*--fc-note-heart/);
  });

  it('uses family radars over time instead of stacked mark bars', () => {
    const src = readFileSync(resolve(here, 'BatchBlotter.tsx'), 'utf8');
    expect(src).toMatch(/data-testid="batch-family-radar"/);
    expect(src).toMatch(/data-testid="batch-family-kpis"/);
    expect(src).toMatch(/data-testid="batch-hero-kpis"/);
    expect(src).toMatch(/familyPowerDeltas/);
    expect(src).not.toMatch(/MiniStarKpis/);
    expect(src).toMatch(/NotesRadar/);
    expect(src).toMatch(/columnFamilyPower/);
    expect(src).not.toMatch(/ComposedChart/);
    expect(src).not.toMatch(/harshCapLabel/);
    expect(src).not.toMatch(/juiceRow/);
  });
});
