import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildPhqCoverage } from '../lib/phq-coverage';
import { duplicateCasReport } from '@fc/shared';
import { loadCatalogIdentities } from '../lib/phq-coverage';

function main() {
  const report = buildPhqCoverage();
  const dups = duplicateCasReport(loadCatalogIdentities());
  const payload = {
    generatedAt: new Date().toISOString(),
    totals: {
      total: report.total,
      cas: report.cas,
      alias: report.alias,
      name: report.name,
      miss: report.miss,
    },
    duplicateCas: dups,
    misses: report.matches.filter((m) => m.kind === 'miss').map((m) => m.query),
    prohibited: report.matches.filter((m) => m.prohibited).map((m) => m.query),
  };
  console.log(JSON.stringify(payload.totals, null, 2));
  console.log(`misses: ${payload.misses.length}`);
  const outDir = path.resolve(process.cwd(), 'src/database/data/import');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'phq-coverage-report.json');
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${outFile} (gitignored)`);
}

main();
