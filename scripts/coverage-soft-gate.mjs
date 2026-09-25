#!/usr/bin/env node
/**
 * Soft gate: warn on files with line coverage < 60%.
 * Always exits 0 (warnings only). Hard gate is Vitest thresholds at 80%.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOFT = 60;

const candidates = [
  'packages/formula-engine/coverage/coverage-summary.json',
  'packages/shared/coverage/coverage-summary.json',
  'packages/scale-bridge/coverage/coverage-summary.json',
  'apps/api/coverage/coverage-summary.json',
  'apps/web/coverage/coverage-summary.json',
];

let warnings = 0;

for (const rel of candidates) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) {
    console.log(`[soft-gate] skip missing ${rel}`);
    continue;
  }
  const summary = JSON.parse(readFileSync(full, 'utf8'));
  console.log(`\n[soft-gate] ${rel}`);
  for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') continue;
    const lines = metrics?.lines?.pct;
    if (typeof lines === 'number' && lines < SOFT) {
      warnings += 1;
      console.warn(`  WARN ${lines.toFixed(1)}% < ${SOFT}%  ${file}`);
    }
  }
}

console.log(`\n[soft-gate] done — ${warnings} file(s) under ${SOFT}% (warnings only)`);
process.exit(0);
