import { config } from 'dotenv';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {
  IFRA_PRODUCT_CATEGORIES,
  collapseStandardLimits,
  planIfraAssociations,
  prohibitionProductLimits,
  uniqueSlug,
  type IfraAssociation,
  type IfraStandardDraft,
} from '@fc/shared';
import {
  ifraCategories,
  ifraLimits,
  ifraStandardCas,
  ifraStandardLimits,
  ifraStandards,
  materialIfraStandards,
  materials,
} from './schema';
import { parseIfraOverviewPdfFile } from '../lib/ifra-pdf';
import { parseIfraStandardWorkbook } from '../lib/ifra-import';
import { loadMaterialAliases } from '../lib/phq-coverage';

config({ path: path.resolve(process.cwd(), '../../.env') });

function resolveSourcePath(): string {
  const fromEnv = process.env.IFRA_IMPORT_PATH;
  if (fromEnv) return path.resolve(fromEnv);
  const candidates = [
    path.resolve(process.cwd(), '../../data/ifra/standards.pdf'),
    path.resolve(process.cwd(), '../../data/ifra/standards.xlsx'),
    path.resolve(process.cwd(), 'src/database/data/import/standards.xlsx'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      'IFRA overview not found. Place the 51st Amendment PDF or Excel at data/ifra/standards.pdf or set IFRA_IMPORT_PATH.',
    );
  }
  return found;
}

async function loadStandards(file: string): Promise<IfraStandardDraft[]> {
  if (file.toLowerCase().endsWith('.pdf')) return parseIfraOverviewPdfFile(file);
  return parseIfraStandardWorkbook(readFileSync(file));
}

function countActions(actions: IfraAssociation[]) {
  const count = (action: IfraAssociation['action']) =>
    actions.filter((row) => row.action === action).length;
  return {
    standards: 0,
    link: count('link'),
    create: count('create'),
    fillCas: count('fill-cas'),
    conflictCas: count('conflict-cas'),
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const file = resolveSourcePath();
  const standards = await loadStandards(file);
  const aliases = loadMaterialAliases();

  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR or DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);

  for (const category of IFRA_PRODUCT_CATEGORIES) {
    const [found] = await db
      .select()
      .from(ifraCategories)
      .where(eq(ifraCategories.code, category.code))
      .limit(1);
    if (!found && !dryRun) await db.insert(ifraCategories).values(category);
  }

  const materialRows = await db
    .select({
      id: materials.id,
      name: materials.name,
      casNumber: materials.casNumber,
      slug: materials.slug,
    })
    .from(materials);
  const actions = planIfraAssociations(standards, materialRows, aliases);
  const summary = { ...countActions(actions), standards: standards.length };
  console.log(summary);
  if (actions.some((row) => row.action === 'conflict-cas')) {
    for (const row of actions.filter((item) => item.action === 'conflict-cas')) {
      console.log(
        `conflict ${row.standardCode} ${row.materialName}: catalog ${row.existingCas} vs standard ${row.standardCas}`,
      );
    }
  }

  if (dryRun) {
    await pool.end();
    return;
  }

  const categoryRows = await db.select().from(ifraCategories);
  const categoryIds = new Map(categoryRows.map((row) => [row.code, row.id]));
  const standardIdByCode = new Map<string, string>();

  for (const draft of standards) {
    const values = {
      name: draft.name,
      amendment: draft.amendment,
      publicationYears: draft.publicationYears,
      lastPublicationYear: draft.lastPublicationYear,
      deadlineExisting: draft.deadlineExisting,
      deadlineNew: draft.deadlineNew,
      standardType: draft.standardType,
      riskDrivers: draft.riskDrivers,
      flavorNote: draft.flavorNote,
      phototoxicityNote: draft.phototoxicityNote,
      restrictionNote: draft.restrictionNote,
      specificationNote: draft.specificationNote,
      otherSources: draft.otherSources,
      otherSourcesNote: draft.otherSourcesNote,
      casComment: draft.casComment,
      synonyms: draft.synonyms,
    };
    const [existing] = await db
      .select({ id: ifraStandards.id })
      .from(ifraStandards)
      .where(eq(ifraStandards.code, draft.code))
      .limit(1);
    let standardId = existing?.id;
    if (!standardId) {
      const [inserted] = await db
        .insert(ifraStandards)
        .values({ code: draft.code, ...values })
        .returning({ id: ifraStandards.id });
      standardId = inserted?.id;
    } else {
      await db.update(ifraStandards).set(values).where(eq(ifraStandards.id, standardId));
    }
    if (!standardId) continue;
    standardIdByCode.set(draft.code, standardId);
    await db.delete(ifraStandardCas).where(eq(ifraStandardCas.standardId, standardId));
    await db.delete(ifraStandardLimits).where(eq(ifraStandardLimits.standardId, standardId));
    if (draft.casNumbers.length > 0) {
      await db.insert(ifraStandardCas).values(
        draft.casNumbers.map((casNumber, index) => ({
          standardId,
          casNumber,
          isPrimary: index === 0,
        })),
      );
    }
    if (draft.limits.length > 0) {
      await db.insert(ifraStandardLimits).values(
        draft.limits.map((limit) => ({
          standardId,
          categoryCode: limit.categoryCode,
          maxPercent: limit.maxPercent == null ? null : String(limit.maxPercent),
          unrestricted: limit.unrestricted,
        })),
      );
    }
  }

  const takenSlugs = new Set(
    materialRows.map((row) => row.slug).filter((slug): slug is string => !!slug),
  );
  const byName = new Map(materialRows.map((row) => [row.name.toLowerCase(), row]));

  for (const action of actions) {
    if (action.action !== 'create') continue;
    if (byName.has(action.name.toLowerCase())) continue;
    const slug = uniqueSlug(action.name, takenSlugs);
    const searchText = [action.name, action.casNumber, action.category, slug]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const [inserted] = await db
      .insert(materials)
      .values({
        name: action.name,
        casNumber: action.casNumber,
        category: action.category,
        slug,
        searchText,
        ownerId: null,
      })
      .returning({
        id: materials.id,
        name: materials.name,
        casNumber: materials.casNumber,
        slug: materials.slug,
      });
    if (!inserted) continue;
    byName.set(inserted.name.toLowerCase(), inserted);
    materialRows.push(inserted);
  }

  for (const action of actions) {
    if (action.action !== 'fill-cas') continue;
    const row = byName.get(action.materialName.toLowerCase());
    if (!row || row.casNumber) continue;
    await db.update(materials).set({ casNumber: action.casNumber }).where(eq(materials.id, row.id));
    row.casNumber = action.casNumber;
  }

  const standardIds = [...standardIdByCode.values()];
  if (standardIds.length > 0) {
    await db
      .delete(materialIfraStandards)
      .where(inArray(materialIfraStandards.standardId, standardIds));
  }

  const linkRows = actions.flatMap((action) => {
    if (action.action !== 'link' && action.action !== 'create') return [];
    const materialName = action.action === 'create' ? action.name : action.materialName;
    const material = byName.get(materialName.toLowerCase());
    const standardId = standardIdByCode.get(action.standardCode);
    if (!material || !standardId) return [];
    return [
      {
        materialId: material.id,
        standardId,
        matchKind: action.action === 'create' ? 'created' : action.matchKind,
      },
    ];
  });
  if (linkRows.length > 0) await db.insert(materialIfraStandards).values(linkRows);

  const touched = new Set(linkRows.map((row) => row.materialId));
  const draftById = new Map(
    [...standardIdByCode.entries()].flatMap(([code, id]) => {
      const draft = standards.find((item) => item.code === code);
      return draft ? [[id, draft] as const] : [];
    }),
  );
  const linksByMaterial = new Map<string, string[]>();
  for (const link of linkRows) {
    const list = linksByMaterial.get(link.materialId) ?? [];
    list.push(link.standardId);
    linksByMaterial.set(link.materialId, list);
  }

  for (const materialId of touched) {
    const linked = linksByMaterial.get(materialId) ?? [];
    const drafts = linked.flatMap((id) => {
      const draft = draftById.get(id);
      return draft ? [draft] : [];
    });
    const prohibited = drafts.some((draft) => draft.standardType === 'PROHIBITION');
    const collapsed = new Map<string, number>();
    if (prohibited) {
      for (const limit of prohibitionProductLimits()) collapsed.set(limit.categoryCode, 0);
    } else {
      for (const draft of drafts) {
        for (const limit of collapseStandardLimits(draft.limits)) {
          const current = collapsed.get(limit.categoryCode);
          if (current == null || limit.maxPercent < current)
            collapsed.set(limit.categoryCode, limit.maxPercent);
        }
      }
    }
    await db.delete(ifraLimits).where(eq(ifraLimits.materialId, materialId));
    const limitValues = [...collapsed.entries()].flatMap(([code, maxPercent]) => {
      const categoryId = categoryIds.get(code);
      if (!categoryId) return [];
      return [{ materialId, categoryId, maxPercent: String(maxPercent) }];
    });
    if (limitValues.length > 0) await db.insert(ifraLimits).values(limitValues);
  }

  await pool.end();
  console.log('IFRA import complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
