import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import pg from 'pg';
import * as argon2 from 'argon2';
import {
  formulas,
  ifraCategories,
  ifraLimits,
  materials,
  perfumes,
  suppliers,
  users,
} from './schema';

config({ path: path.resolve(process.cwd(), '../../.env') });

const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL_MIGRATOR or DATABASE_URL is required');
}

async function main() {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);
  const demoPassword = await argon2.hash('DemoPass123!');

  const demoUsers = [
    { email: 'alice@demo.local', displayName: 'Alice Perfumer', role: 'perfumer', plan: 'pro' },
    { email: 'bob@demo.local', displayName: 'Bob Enthusiast', role: 'enthusiast', plan: 'free' },
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

  const materialRows = [
    {
      name: 'Bergamot EO',
      casNumber: '8007-75-8',
      category: 'Essential Oil',
      olfactoryFamily: 'Citrus',
      pyramidNote: 'top',
      description: 'Bright Italian bergamot',
      costPerGram: '0.120000',
      allergenProfile: { limonene: 38, linalool: 12 },
      searchText: 'bergamot citrus top',
    },
    {
      name: 'Lemon EO',
      casNumber: '8008-56-8',
      category: 'Essential Oil',
      olfactoryFamily: 'Citrus',
      pyramidNote: 'top',
      description: 'Fresh lemon peel',
      costPerGram: '0.090000',
      allergenProfile: { limonene: 65, linalool: 0.2 },
      searchText: 'lemon citrus top',
    },
    {
      name: 'Linalool',
      casNumber: '78-70-6',
      category: 'Isolate',
      olfactoryFamily: 'Floral',
      pyramidNote: 'heart',
      description: 'Fresh floral',
      costPerGram: '0.045000',
      allergenProfile: { linalool: 100 },
      searchText: 'linalool floral heart',
    },
    {
      name: 'Ambroxan 10% DPG',
      casNumber: '6790-58-5',
      category: 'Dilution',
      stockConcentrationPct: '10',
      solvent: 'DPG',
      olfactoryFamily: 'Woody',
      pyramidNote: 'base',
      tenacityHours: '48',
      costPerGram: '0.220000',
      searchText: 'ambroxan woody base dpg',
    },
    {
      name: 'Damascenone Alpha',
      casNumber: '23696-85-7',
      category: 'Ketone',
      olfactoryFamily: 'Fruity',
      pyramidNote: 'heart',
      description: 'Powerful rose-fruity — use diluted',
      costPerGram: '12.500000',
      searchText: 'damascenone rose fruity',
    },
    {
      name: 'Ethanol',
      casNumber: '64-17-5',
      category: 'Solvent',
      description: 'Perfumer alcohol',
      costPerGram: '0.003000',
      searchText: 'ethanol solvent',
    },
    {
      name: 'DPG',
      casNumber: '25265-71-8',
      category: 'Solvent',
      description: 'Dipropylene glycol',
      costPerGram: '0.008000',
      searchText: 'dpg solvent',
    },
  ];

  for (const m of materialRows) {
    const found = await db.select().from(materials).where(eq(materials.name, m.name)).limit(1);
    if (found[0]) continue;
    await db.insert(materials).values(m);
  }

  const categories = [
    { code: '1', label: 'Lip products' },
    { code: '4', label: 'Fine fragrance' },
    { code: '10A', label: 'Household care (air care)' },
    { code: '12', label: 'Candles' },
  ];
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

  const supplierRows = [
    {
      name: "Perfumer's Apprentice",
      region: 'US',
      country: 'USA',
      website: 'https://shop.perfumersapprentice.com',
    },
    { name: 'Pell Wall', region: 'UK-EU', country: 'UK', website: 'https://pellwall.com' },
    {
      name: 'DirectPCW',
      region: 'UK-EU',
      country: 'NL',
      website: 'https://www.creatingperfume.com',
    },
    {
      name: 'PerfumersWorld',
      region: 'ASIA',
      country: 'TH',
      website: 'https://www.perfumersworld.com',
    },
  ];
  for (const s of supplierRows) {
    const found = await db.select().from(suppliers).where(eq(suppliers.name, s.name)).limit(1);
    if (found[0]) continue;
    await db.insert(suppliers).values(s);
  }

  const perfumeFound = await db.select().from(perfumes).limit(1);
  if (!perfumeFound[0]) {
    await db.insert(perfumes).values({
      name: 'Demo Fougère',
      house: 'Fragrance Chemistry Atelier',
      perfumer: 'Alice Demo',
      year: 2026,
      family: 'Fougère',
      pyramid: {
        top: ['Bergamot', 'Lemon'],
        heart: ['Lavender', 'Linalool'],
        base: ['Ambroxan', 'Coumarin'],
      },
      attributes: { sweet: 0.3, woody: 0.5, fresh: 0.7 },
    });
  }

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
  }

  await pool.end();
  console.log('Seed complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
