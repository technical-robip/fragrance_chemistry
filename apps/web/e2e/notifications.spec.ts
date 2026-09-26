import { expect, test } from '@playwright/test';

const DEMO_EMAIL = 'alice@demo.local';
const DEMO_PASSWORD = 'DemoPass123!';
const API = process.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

async function loginAlice(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /enter lab/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
    timeout: 15_000,
  });
}

async function authHeaders(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('fc.accessToken'));
  if (!token) throw new Error('Missing access token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test('evaluation reminder appears, opens the slot, and mute removes it', async ({ page }) => {
  await loginAlice(page);
  const headers = await authHeaders(page);
  const catalogRes = await page.request.get(`${API}/catalog/materials?q=Hedione&limit=20`, {
    headers,
  });
  expect(catalogRes.ok()).toBeTruthy();
  const catalog = (await catalogRes.json()) as Array<{ id: string; name: string }>;
  const hedione = catalog.find((row) => /^hedione$/i.test(row.name)) ?? catalog[0];
  expect(hedione).toBeTruthy();

  const createdRes = await page.request.post(`${API}/formulas`, {
    headers,
    data: {
      name: `__smoke notif ${Date.now()}`,
      status: 'draft',
      concentrationPct: 20,
      batchTargetGrams: 10,
      lines: [{ materialId: hedione!.id, percent: 100, pyramidNote: 'middle' }],
    },
  });
  expect(createdRes.ok()).toBeTruthy();
  const formula = (await createdRes.json()) as { id: string; name: string };

  try {
    const evalRes = await page.request.post(`${API}/evaluations`, {
      headers,
      data: { formulaId: formula.id, rating: 3, macerationDay: 1, t0Notes: 'opened' },
    });
    expect(evalRes.ok()).toBeTruthy();

    const simulated = await page.request.post(`${API}/notifications/dev/simulate`, {
      headers,
      data: { formulaId: formula.id, atCheckpoint: 't30m' },
    });
    expect(simulated.ok()).toBeTruthy();
    const inbox = (await simulated.json()) as {
      items: Array<{ formulaId: string; checkpointKey: string }>;
    };
    expect(inbox.items.some((item) => item.checkpointKey === 't30m')).toBe(true);

    await page.goto('/');
    await page.locator('[data-testid="notification-bell"]:visible').click();
    const panel = page.getByTestId('notification-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(formula.name)).toBeVisible();

    await page.getByTestId('notification-link-t30m').click();
    await expect(page).toHaveURL(/day=1/);
    await expect(page).toHaveURL(/slot=t30mNotes/);
    await expect(page.getByRole('heading', { name: /evaluation/i })).toBeVisible();

    await page.locator('[data-testid="notification-bell"]:visible').click();
    await page.getByTestId('notification-mute-t30m').click();
    await expect(panel.getByText(formula.name)).toHaveCount(0);

    const after = await page.request.get(`${API}/notifications`, { headers });
    expect(after.ok()).toBeTruthy();
    const cleared = (await after.json()) as { items: Array<{ formulaId: string }> };
    expect(cleared.items.some((item) => item.formulaId === formula.id)).toBe(false);
  } finally {
    await page.request.delete(`${API}/formulas/${formula.id}`, { headers }).catch(() => undefined);
  }
});
