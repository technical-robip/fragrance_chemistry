import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import * as argon2 from 'argon2';
import {
  uniqueSlug,
  FEATURE_KEYS,
  IFRA_PRODUCT_CATEGORIES,
  PLAN_FEATURE_PRESETS,
  PLAN_QUOTA_PRESETS,
  QUOTA_KEYS,
} from '@fc/shared';
import {
  formulaLines,
  formulas,
  ifraCategories,
  ifraLimits,
  materials,
  perfumes,
  planFeatures,
  plans,
  planQuotas,
  subscriptions,
  suppliers,
  users,
} from './schema';
import { CatalogService } from '../modules/catalog/catalog.service';
import { loadSupplierDirectory } from '../lib/supplier-directory';

config({ path: path.resolve(process.cwd(), '../../.env') });

const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL_MIGRATOR or DATABASE_URL is required');
}

type CatalogRow = {
  name: string;
  casNumber?: string | null;
  category?: string;
  olfactoryFamily?: string;
  pyramidNote?: string;
  manufacturer?: string;
  costPerGram?: string;
  description?: string;
  searchText?: string;
  stockConcentrationPct?: string;
  solvent?: string;
  tenacityHours?: string;
  allergenProfile?: Record<string, number>;
};

async function main() {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);
  const demoPassword = await argon2.hash('DemoPass123!');

  await db.execute(
    sql`UPDATE catalog.materials SET pyramid_note = 'middle' WHERE pyramid_note = 'heart'`,
  );
  await db.execute(sql`ALTER TABLE catalog.materials ADD COLUMN IF NOT EXISTS manufacturer text`);

  await seedPlans(db);

  const demoUsers = [
    { email: 'alice@demo.local', displayName: 'Alice Perfumer', role: 'perfumer', plan: 'pro' },
    { email: 'bob@demo.local', displayName: 'Bob Enthusiast', role: 'enthusiast', plan: 'free' },
    { email: 'admin@demo.local', displayName: 'Lab Admin', role: 'admin', plan: 'enterprise' },
  ];

  const userIds: string[] = [];
  for (const u of demoUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing[0]) {
      userIds.push(existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(users)
      .values({
        email: u.email,
        displayName: u.displayName,
        passwordHash: demoPassword,
        role: u.role,
        plan: u.plan,
      })
      .returning({ id: users.id });
    if (row) userIds.push(row.id);
  }

  await ensureDemoSubscriptions(db);

  const catalogPath = path.resolve(process.cwd(), 'src/database/data/materials-catalog.json');
  const materialRows = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogRow[];
  const mediaRoot = path.resolve(process.cwd(), '../web/public/media/materials');

  let inserted = 0;
  const taken = new Set<string>();
  for (const m of materialRows) {
    const slug = uniqueSlug(m.name, taken, m.manufacturer);
    const photoPath = path.join(mediaRoot, 'photos', `${slug}.jpg`);
    const artPath = path.join(mediaRoot, 'art', `${slug}.svg`);
    const imageUrl = existsSync(photoPath)
      ? `/media/materials/photos/${slug}.jpg`
      : existsSync(artPath)
        ? `/media/materials/art/${slug}.svg`
        : CatalogService.imagePathForSlug(slug);

    const existing = await db.select().from(materials).where(eq(materials.name, m.name)).limit(8);
    const match = existing.find((row) => (row.manufacturer ?? null) === (m.manufacturer ?? null));
    if (match) {
      const resolvedSlug = match.slug ?? slug;
      await db
        .update(materials)
        .set({
          slug: resolvedSlug,
          imageUrl,
          searchText:
            match.searchText ??
            [m.name, m.casNumber, m.manufacturer, m.olfactoryFamily, m.pyramidNote, resolvedSlug]
              .filter(Boolean)
              .join(' ')
              .toLowerCase(),
        })
        .where(eq(materials.id, match.id));
      continue;
    }

    await db.insert(materials).values({
      name: m.name,
      casNumber: m.casNumber ?? null,
      category: m.category,
      olfactoryFamily: m.olfactoryFamily,
      pyramidNote: m.pyramidNote === 'heart' ? 'middle' : m.pyramidNote,
      manufacturer: m.manufacturer,
      costPerGram: m.costPerGram,
      description: m.description,
      searchText:
        m.searchText ??
        [m.name, m.casNumber, m.manufacturer, m.olfactoryFamily, m.pyramidNote, slug]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      stockConcentrationPct: m.stockConcentrationPct,
      solvent: m.solvent,
      tenacityHours: m.tenacityHours,
      allergenProfile: m.allergenProfile ?? {},
      slug,
      imageUrl,
    });
    inserted += 1;
  }
  console.log(`Materials: inserted ${inserted}, catalog size ${materialRows.length}`);

  const categories = IFRA_PRODUCT_CATEGORIES.map((c) => ({ code: c.code, label: c.label }));
  for (const c of categories) {
    const found = await db
      .select()
      .from(ifraCategories)
      .where(eq(ifraCategories.code, c.code))
      .limit(1);
    if (found[0]) continue;
    await db.insert(ifraCategories).values(c);
  }

  const [linalool] = await db
    .select()
    .from(materials)
    .where(eq(materials.name, 'Linalool'))
    .limit(1);
  const [cat4] = await db
    .select()
    .from(ifraCategories)
    .where(eq(ifraCategories.code, '4'))
    .limit(1);
  if (linalool && cat4) {
    const existing = await db.select().from(ifraLimits).limit(1);
    if (!existing[0]) {
      await db
        .insert(ifraLimits)
        .values([{ materialId: linalool.id, categoryId: cat4.id, maxPercent: '20.0000' }]);
    }
  }

  // Enrich key materials with tenacity + EU allergen profiles. Demo IFRA max_percent only.
  const enrichment: Array<{
    match: string;
    tenacityHours?: string;
    allergenProfile: Record<string, number>;
    maxIfra?: string;
    exact?: boolean;
  }> = [
    {
      match: 'Linalool',
      tenacityHours: '8',
      allergenProfile: { Linalool: 1 },
      maxIfra: '20',
      exact: true,
    },
    {
      match: 'Coumarin',
      tenacityHours: '48',
      allergenProfile: { Coumarin: 1 },
      maxIfra: '1.5',
      exact: true,
    },
    {
      match: 'Limonene',
      tenacityHours: '2',
      allergenProfile: { Limonene: 1 },
      maxIfra: '100',
      exact: true,
    },
    {
      match: 'Citral',
      tenacityHours: '3',
      allergenProfile: { Citral: 1 },
      maxIfra: '1',
      exact: true,
    },
    { match: 'Isoeugenol', allergenProfile: { Isoeugenol: 1 }, exact: true },
    { match: 'Eugenol', allergenProfile: { Eugenol: 1 }, exact: true },
    { match: 'Geraniol', allergenProfile: { Geraniol: 1 }, exact: true },
    { match: 'Citronellol', allergenProfile: { Citronellol: 1 }, exact: true },
    { match: 'Farnesol', allergenProfile: { Farnesol: 1 }, exact: true },
    { match: 'Benzyl Salicylate', allergenProfile: { 'Benzyl Salicylate': 1 }, exact: true },
    { match: 'Benzyl Benzoate', allergenProfile: { 'Benzyl Benzoate': 1 }, exact: true },
    { match: 'Benzyl Alcohol', allergenProfile: { 'Benzyl Alcohol': 1 }, exact: true },
    { match: 'Cinnamyl Alcohol', allergenProfile: { 'Cinnamyl Alcohol': 1 }, exact: true },
    { match: 'Cinnamic Aldehyde', allergenProfile: { Cinnamal: 1 }, exact: true },
    { match: 'Hydroxycitronellal', allergenProfile: { Hydroxycitronellal: 1 }, exact: true },
    { match: 'Hexyl Cinnamic Aldehyde', allergenProfile: { 'Hexyl Cinnamal': 1 }, exact: true },
    { match: 'Amyl Cinnamic Aldehyde', allergenProfile: { 'Amyl Cinnamal': 1 }, exact: true },
    {
      match: 'Methyl Heptine Carbonate',
      allergenProfile: { 'Methyl 2-Octynoate': 1 },
      exact: true,
    },
    {
      match: 'Oakmoss Absolute',
      tenacityHours: '72',
      allergenProfile: { 'Evernia Prunastri Extract': 1 },
      exact: true,
    },
    {
      match: 'Rose Absolute',
      allergenProfile: { Citronellol: 0.35, Geraniol: 0.2, Eugenol: 0.012, Farnesol: 0.01 },
      exact: true,
    },
    {
      match: 'Ylang Ylang EO',
      allergenProfile: {
        Linalool: 0.1,
        'Benzyl Benzoate': 0.05,
        Geraniol: 0.03,
        Farnesol: 0.02,
        'Benzyl Salicylate': 0.03,
        Isoeugenol: 0.005,
      },
      exact: true,
    },
    { match: 'Lemon EO', allergenProfile: { Limonene: 0.65, Citral: 0.03 }, exact: true },
    { match: 'Bergamot', tenacityHours: '3', allergenProfile: { Limonene: 0.35, Linalool: 0.12 } },
    { match: 'Lavender', tenacityHours: '10', allergenProfile: { Linalool: 0.35 } },
    { match: 'Ambroxan', tenacityHours: '96', allergenProfile: {}, exact: true },
    { match: 'Vanillin', tenacityHours: '36', allergenProfile: {}, exact: true },
    { match: 'Hedione', tenacityHours: '18', allergenProfile: {}, exact: true },
  ];

  for (const row of enrichment) {
    const found = row.exact
      ? await db.select().from(materials).where(eq(materials.name, row.match)).limit(1)
      : await db
          .select()
          .from(materials)
          .where(sql`${materials.name} ILIKE ${'%' + row.match + '%'}`)
          .limit(3);
    for (const mat of found) {
      await db
        .update(materials)
        .set({
          ...(row.tenacityHours ? { tenacityHours: mat.tenacityHours ?? row.tenacityHours } : {}),
          allergenProfile:
            mat.allergenProfile && Object.keys(mat.allergenProfile as object).length > 0
              ? mat.allergenProfile
              : row.allergenProfile,
        })
        .where(eq(materials.id, mat.id));
      if (row.maxIfra && cat4) {
        const limitExists = await db
          .select()
          .from(ifraLimits)
          .where(and(eq(ifraLimits.materialId, mat.id), eq(ifraLimits.categoryId, cat4.id)))
          .limit(1);
        if (!limitExists[0]) {
          await db.insert(ifraLimits).values({
            materialId: mat.id,
            categoryId: cat4.id,
            maxPercent: row.maxIfra,
          });
        }
      }
    }
  }

  const supplierDirectory = loadSupplierDirectory();
  // Pell Wall entered liquidation (June 2026) — remove from existing DBs.
  await db.execute(sql`DELETE FROM catalog.suppliers WHERE name = 'Pell Wall'`);
  for (const s of supplierDirectory) {
    const names = [s.name, ...(s.aliases ?? [])];
    const found = await db.select().from(suppliers).where(inArray(suppliers.name, names)).limit(1);
    const values = {
      name: s.name,
      region: s.region,
      country: s.country,
      website: s.website,
      notes: s.notes ?? null,
    };
    if (found[0]) {
      await db.update(suppliers).set(values).where(eq(suppliers.id, found[0].id));
    } else {
      await db.insert(suppliers).values(values);
    }
  }

  // Drop empty Untitled formula duplicates left by smoke / repeated lab-brief runs.
  await db.execute(sql`
    DELETE FROM lab.formulas f
    WHERE f.name LIKE 'Untitled formula %'
      AND NOT EXISTS (
        SELECT 1 FROM lab.formula_lines fl WHERE fl.formula_id = f.id
      )
  `);

  type PerfumeSeed = {
    name: string;
    house: string;
    perfumer: string;
    year: number;
    family: string;
    pyramid: { top: string[]; heart: string[]; base: string[] };
    attributes: Record<string, number>;
  };
  const perfumePath = path.resolve(process.cwd(), 'src/database/data/encyclopedia-perfumes.json');
  const perfumeRows = JSON.parse(readFileSync(perfumePath, 'utf8')) as PerfumeSeed[];
  let perfumeUpserts = 0;
  for (const perfume of perfumeRows) {
    const existing = await db
      .select()
      .from(perfumes)
      .where(eq(perfumes.name, perfume.name))
      .limit(1);
    if (existing[0]) {
      await db
        .update(perfumes)
        .set({
          house: perfume.house,
          perfumer: perfume.perfumer,
          year: perfume.year,
          family: perfume.family,
          pyramid: perfume.pyramid,
          attributes: perfume.attributes,
        })
        .where(eq(perfumes.id, existing[0].id));
    } else {
      await db.insert(perfumes).values(perfume);
    }
    perfumeUpserts += 1;
  }
  console.log(`Encyclopedia: upserted ${perfumeUpserts} perfume profiles`);

  if (userIds[0]) {
    const existingFormula = await db.select().from(formulas).limit(1);
    if (!existingFormula[0]) {
      await db.insert(formulas).values({
        ownerId: userIds[0],
        name: 'Fougère Sketch v1',
        description: 'Demo formula for workbench',
        batchTargetGrams: '10',
        concentrationPct: '20',
        status: 'draft',
      });
    }
    await seedLibraryAccords(db, userIds[0]);
  }

  await db.execute(sql`
    UPDATE catalog.materials
    SET description = trim(both from coalesce(description, '') || ' Placeholder SKU — not a recipe; use a library accord formula.')
    WHERE owner_id IS NULL
      AND name LIKE 'Accord % Lab Grade'
      AND coalesce(description, '') NOT LIKE '%Placeholder SKU%'
  `);

  await pool.end();
  console.log('Seed complete');
}

type LibraryAccordSeed = {
  slug: string;
  name: string;
  description: string;
  lines: Array<{ materialName: string; percent: number; pyramidNote?: string }>;
};

async function seedLibraryAccords(db: ReturnType<typeof drizzle>, ownerId: string) {
  const file = path.resolve(process.cwd(), 'src/database/data/library-accords.json');
  const accords = JSON.parse(readFileSync(file, 'utf8')) as LibraryAccordSeed[];
  let upserts = 0;
  for (const accord of accords) {
    const [existing] = await db
      .select()
      .from(formulas)
      .where(and(eq(formulas.ownerId, ownerId), eq(formulas.slug, accord.slug)))
      .limit(1);
    let formulaId = existing?.id;
    if (!formulaId) {
      const [row] = await db
        .insert(formulas)
        .values({
          ownerId,
          name: accord.name,
          slug: accord.slug,
          description: accord.description,
          batchTargetGrams: '10',
          concentrationPct: '100',
          status: 'ready',
          isLibraryAccord: true,
        })
        .returning({ id: formulas.id });
      formulaId = row?.id;
    } else {
      await db
        .update(formulas)
        .set({
          name: accord.name,
          description: accord.description,
          isLibraryAccord: true,
          status: 'ready',
        })
        .where(eq(formulas.id, formulaId));
    }
    if (!formulaId) continue;
    const existingLines = await db
      .select()
      .from(formulaLines)
      .where(eq(formulaLines.formulaId, formulaId));
    if (existingLines.length === 0) {
      let sortOrder = 0;
      for (const line of accord.lines) {
        const [mat] = await db
          .select()
          .from(materials)
          .where(eq(materials.name, line.materialName))
          .limit(1);
        if (!mat) {
          console.warn(`Library accord ${accord.slug}: missing material ${line.materialName}`);
          continue;
        }
        await db.insert(formulaLines).values({
          formulaId,
          ownerId,
          materialId: mat.id,
          percent: String(line.percent),
          pyramidNote: line.pyramidNote,
          sortOrder,
        });
        sortOrder += 1;
      }
    }
    upserts += 1;
  }
  console.log(`Library accords: upserted ${upserts}`);
}

async function seedPlans(db: ReturnType<typeof drizzle>) {
  const defs = [
    {
      slug: 'free' as const,
      name: 'Free',
      description: 'Three formulas and the core lab notebook.',
      sortOrder: 10,
    },
    {
      slug: 'pro' as const,
      name: 'Pro',
      description: 'Unlimited formulas, weighing, costing, and evaluation.',
      sortOrder: 20,
    },
    {
      slug: 'enterprise' as const,
      name: 'Enterprise',
      description: 'Everything in Pro plus sponsored supplier listings.',
      sortOrder: 30,
    },
  ];

  for (const def of defs) {
    const [existing] = await db.select().from(plans).where(eq(plans.slug, def.slug)).limit(1);
    const planId = existing
      ? existing.id
      : (
          await db
            .insert(plans)
            .values({
              slug: def.slug,
              name: def.name,
              description: def.description,
              isActive: true,
              sortOrder: def.sortOrder,
            })
            .returning({ id: plans.id })
        )[0]!.id;

    const featureRows = await db.select().from(planFeatures).where(eq(planFeatures.planId, planId));
    if (featureRows.length === 0) {
      const enabled = new Set(PLAN_FEATURE_PRESETS[def.slug]);
      await db.insert(planFeatures).values(
        FEATURE_KEYS.map((featureKey) => ({
          planId,
          featureKey,
          enabled: enabled.has(featureKey),
        })),
      );
    }

    const quotaRows = await db.select().from(planQuotas).where(eq(planQuotas.planId, planId));
    if (quotaRows.length === 0) {
      const preset = PLAN_QUOTA_PRESETS[def.slug];
      await db.insert(planQuotas).values(
        QUOTA_KEYS.map((quotaKey) => ({
          planId,
          quotaKey,
          limitValue: preset[quotaKey] ?? null,
        })),
      );
    }
  }
}

async function ensureDemoSubscriptions(db: ReturnType<typeof drizzle>) {
  const demo = [
    { email: 'alice@demo.local', plan: 'pro' },
    { email: 'bob@demo.local', plan: 'free' },
    { email: 'admin@demo.local', plan: 'enterprise' },
  ];
  for (const row of demo) {
    const [user] = await db.select().from(users).where(eq(users.email, row.email)).limit(1);
    const [plan] = await db.select().from(plans).where(eq(plans.slug, row.plan)).limit(1);
    if (!user || !plan) continue;
    const [active] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')))
      .limit(1);
    if (!active) {
      await db.insert(subscriptions).values({
        userId: user.id,
        planId: plan.id,
        status: 'active',
      });
    }
    if (user.plan !== row.plan) {
      await db
        .update(users)
        .set({ plan: row.plan, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
