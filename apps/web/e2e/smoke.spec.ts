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

/** Disposable formula so sitting smokes never rename or overwrite Alice's library. */
async function provisionSmokeFormula(page: import('@playwright/test').Page) {
  const headers = await authHeaders(page);
  const catalogRes = await page.request.get(`${API}/catalog/materials?q=Hedione&limit=20`, {
    headers,
  });
  expect(catalogRes.ok()).toBeTruthy();
  const catalog = (await catalogRes.json()) as Array<{ id: string; name: string }>;
  const hedione = catalog.find((row) => /^hedione$/i.test(row.name)) ?? catalog[0];
  expect(hedione, 'Hedione (or any catalog material) for smoke formula').toBeTruthy();

  const createdRes = await page.request.post(`${API}/formulas`, {
    headers,
    data: {
      name: `__smoke sitting ${Date.now()}`,
      status: 'draft',
      concentrationPct: 20,
      batchTargetGrams: 10,
      lines: [{ materialId: hedione!.id, percent: 100, pyramidNote: 'middle' }],
    },
  });
  expect(createdRes.ok()).toBeTruthy();
  return (await createdRes.json()) as { id: string; slug?: string | null };
}

async function deleteSmokeFormula(page: import('@playwright/test').Page, id: string) {
  const headers = await authHeaders(page);
  await page.request.delete(`${API}/formulas/${id}`, { headers }).catch(() => undefined);
}

test.describe('Fragrance Chemistry smoke', () => {
  test('unauthenticated home shows the landing page', async ({ page }) => {
    const protectedRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (
        /\/api\/v1\/(formulas|catalog|inventory|evaluations|billing|encyclopedia)(?:\/|\?|$)/.test(
          url,
        )
      ) {
        protectedRequests.push(url);
      }
    });

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /every number in your formula, computed/i }),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: /three plans/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /three moves, one engine/i })).toBeVisible();

    const start = page.getByRole('link', { name: /start free/i }).first();
    await expect(start).toHaveAttribute('href', '/auth?mode=register');
    await start.click();
    await expect(page).toHaveURL(/\/auth\?mode=register/);
    await expect(page.getByRole('tab', { name: /register/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(protectedRequests).toEqual([]);
  });

  test('unauthenticated workbench redirects to auth', async ({ page }) => {
    await page.goto('/workbench');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('reject bad login', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email').fill('nobody@demo.local');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /enter lab/i }).click();
    await expect(page.getByText(/invalid credentials|could not reach/i)).toBeVisible();
  });

  test('register new user and land on dashboard', async ({ page }) => {
    const stamp = Date.now();
    await page.goto('/auth');
    await page.getByRole('tab', { name: /register/i }).click();
    await page.getByLabel('Display name').fill(`Tester ${stamp}`);
    await page.getByLabel('Email').fill(`tester.${stamp}@example.com`);
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: /create account|join lab|register|sign up/i }).click();
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('login alice, hydrate after reload, navigate routes', async ({ page }) => {
    await loginAlice(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15_000,
    });

    const routes: Array<{ path: string; heading: RegExp }> = [
      { path: '/catalog', heading: /catalog/i },
      { path: '/workbench', heading: /workbench|formula/i },
      { path: '/weighing', heading: /weigh/i },
      { path: '/costing', heading: /cost/i },
      { path: '/inventory', heading: /inventory/i },
      { path: '/evaluation', heading: /evaluation/i },
      { path: '/encyclopedia', heading: /encyclopedia/i },
      { path: '/suppliers', heading: /suppliers/i },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('catalog galaxolide-synarome IFRA and Stock tabs do not 500', async ({ page }) => {
    await loginAlice(page);
    const failures: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (
        res.status() >= 500 &&
        (url.includes('/ifra/materials/') || url.includes('/catalog/materials/'))
      ) {
        failures.push(`${res.status()} ${url}`);
      }
    });
    await page.goto('/catalog/galaxolide-synarome');
    await expect(page.getByRole('heading', { name: /galaxolide/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('tab', { name: /^ifra$/i }).click();
    await expect(page.getByText(/no ifra limits|fine fragrance|category/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('tab', { name: /^stock$/i }).click();
    await expect(page.getByText(/min stock|inventory/i).first()).toBeVisible();
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('alice opens account and updates display name', async ({ page }) => {
    await loginAlice(page);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /account|cont/i })).toBeVisible({
      timeout: 15_000,
    });
    const name = page.getByLabel(/display name|nume afișat/i).first();
    await name.fill('Alice Perfumer');
    await page.getByRole('button', { name: /save profile|salvează profilul/i }).click();
    await expect(page.getByText(/saved|salvat/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('alice is redirected away from admin', async ({ page }) => {
    await loginAlice(page);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: /dashboard|panou/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('admin can open users and plans', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email').fill('admin@demo.local');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /enter lab/i }).click();
    await expect(page.getByRole('heading', { name: /dashboard|panou/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /administration|administrare/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.goto('/admin/users');
    await expect(page.getByRole('link', { name: /alice/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.goto('/admin/plans');
    await expect(page.getByRole('link', { name: /free|pro|enterprise/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('dashboard cards navigate', async ({ page }) => {
    await loginAlice(page);
    await page.getByRole('link', { name: /active formulas/i }).click();
    await expect(page).toHaveURL(/\/workbench/);
    await page.goto('/');
    await page.getByRole('link', { name: /low stock/i }).click();
    await expect(page).toHaveURL(/\/inventory/);
  });

  test('workbench create formula and persist after reload', async ({ page }) => {
    await loginAlice(page);
    await page.goto('/workbench');
    await page.getByRole('button', { name: /\+ new/i }).click();
    await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 10_000 });
    const addBtn = page.getByRole('button', { name: /add material/i });
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      const search = page.getByPlaceholder(/search/i).first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill('a');
        const option = page.getByRole('button').filter({ hasText: /.+/ }).nth(1);
        await option.click({ timeout: 5_000 }).catch(() => undefined);
      }
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    const save = page.getByRole('button', { name: /save/i });
    if (await save.isEnabled().catch(() => false)) {
      await save.click();
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: /workbench|formula/i }).first()).toBeVisible();
    const del = page.getByRole('button', { name: /^delete$/i });
    if (await del.isVisible().catch(() => false)) {
      page.once('dialog', (d) => d.accept());
      await del.click();
    }
  });

  test('workbench picker stays open after adding a material', async ({ page }) => {
    await loginAlice(page);
    await page.goto('/workbench');
    await page.getByRole('button', { name: /\+ new/i }).click();
    const addBtn = page.getByRole('button', { name: /add material|adaugă material/i });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const search = page.getByPlaceholder(/search|caut/i).first();
    await search.fill('a');
    const option = dialog
      .locator('button')
      .filter({ has: page.locator('strong') })
      .first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /done|gata/i })).toBeVisible();
    await dialog.getByRole('button', { name: /done|gata/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('workbench pyramid shows layer contents instead of a percent legend', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAlice(page);
    await page.goto('/workbench');
    await page.getByRole('button', { name: /\+ new/i }).click();
    await expect(
      page.getByRole('heading', { name: /pyramid balance|echilibru piramid/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('pyramid-layer-empty')).toBeVisible();
    await expect(page.getByTestId('pyramid-layer-summary')).toHaveCount(0);

    const addBtn = page.getByRole('button', { name: /add material|adaugă material/i });
    await addBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    async function pick(query: string) {
      const search = page.getByPlaceholder(/search|caut/i).first();
      await search.fill(query);
      const option = dialog
        .locator('button')
        .filter({ has: page.locator('strong') })
        .filter({ hasText: new RegExp(query, 'i') })
        .first();
      await expect(option).toBeVisible({ timeout: 10_000 });
      await option.click();
    }

    await pick('Hedione');
    await pick('Linalool');
    await dialog.getByRole('button', { name: /done|gata/i }).click();
    await expect(dialog).toBeHidden();

    const summary = page.getByTestId('pyramid-layer-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/hedione|linalool/i);
    await expect(page.getByTestId('pyramid-layer-empty')).toHaveCount(0);

    const heartRow = summary.getByRole('button', { name: /heart/i });
    await heartRow.click();
    await expect(heartRow).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pyramid-layer-expanded')).toBeVisible();
    await expect(page.getByTestId('pyramid-layer-expanded')).toContainText(/hedione|linalool/i);
    await heartRow.click();
    await expect(heartRow).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('pyramid-layer-expanded')).toHaveCount(0);
    await page.getByRole('heading', { name: /pyramid balance|echilibru piramid/i }).hover();
    await expect(
      page
        .locator('.fc-card')
        .filter({ hasText: /family distribution/i })
        .locator('[data-highlighted="true"]'),
    ).toHaveCount(0);
    await heartRow.click();
    await expect(
      page
        .locator('.fc-card')
        .filter({ hasText: /family distribution/i })
        .locator('[data-highlighted="true"]'),
    ).not.toHaveCount(0);
    await heartRow.click();
    await expect(heartRow).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('heading', { name: /pyramid balance|echilibru piramid/i }).hover();

    const pct = page.getByRole('textbox', { name: /abs%/i }).first();
    await pct.fill('20');
    await pct.press('Enter');
    const slice = page.locator('svg[aria-label="Olfactory pyramid"] polygon').first();
    await expect(slice).toBeVisible({ timeout: 10_000 });
    await slice.click({ force: true });
    await expect(heartRow).toHaveAttribute('aria-pressed', 'true');

    const noteControl = page
      .locator('.fc-select__control')
      .filter({ has: page.getByRole('combobox', { name: /^note$/i }) })
      .first();
    await noteControl.scrollIntoViewIfNeeded();
    await noteControl.click();
    await page.getByRole('option', { name: /^other$/i }).click();
    await expect(summary.getByRole('button', { name: /other/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('workbench pyramid layer panel fits a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAlice(page);
    await page.goto('/workbench');
    await page.getByRole('button', { name: /\+ new/i }).click();
    await expect(
      page.getByRole('heading', { name: /pyramid balance|echilibru piramid/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('pyramid-layer-empty')).toBeVisible();
    await page
      .getByRole('heading', { name: /pyramid balance|echilibru piramid/i })
      .scrollIntoViewIfNeeded();
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noOverflow).toBe(true);
    await expect(page.getByRole('img', { name: /olfactory pyramid/i })).toBeVisible();
  });

  test('workbench delete formula stays above sticky row actions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 });
    await loginAlice(page);
    await page.goto('/workbench');
    const del = page.getByRole('button', { name: /delete formula|șterge formula/i });
    await expect(del).toBeVisible({ timeout: 15_000 });
    await del.scrollIntoViewIfNeeded();
    const box = await del.boundingBox();
    expect(box).toBeTruthy();
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest('button')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(hit).toMatch(/delete formula|șterge formula/i);
  });

  test('workbench formula selector searches and confirms row delete', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAlice(page);
    await page.goto('/workbench');
    await page.getByRole('button', { name: /\+ new/i }).click();
    const selector = page.getByTestId('formula-selector');
    const value = selector.locator('.fc-select__single-value');
    await expect(value).toContainText(/untitled formula/i, { timeout: 15_000 });
    const createdLabel = ((await value.textContent()) ?? '').trim();
    const searchTerm = createdLabel.replace(/\s*\(.*$/, '').trim();

    async function openMenu() {
      await selector.locator('.fc-select__control').click();
      await expect(page.locator('.fc-select__menu')).toBeVisible();
    }

    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await openMenu();
      await expect(page.getByTestId('formula-option-delete').first()).toBeVisible();
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 2,
      );
      expect(noOverflow).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('.fc-select__menu')).toHaveCount(0);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await openMenu();
    const search = selector.getByRole('combobox', { name: /active formula/i });
    await search.fill(searchTerm);
    const option = page.locator('.fc-select__option--is-selected');
    await expect(option).toContainText(searchTerm);
    await option.getByTestId('formula-option-delete').click();
    await expect(page.getByTestId('formula-option-confirm')).toBeVisible();
    await expect(option).toContainText(/delete this formula/i);
    await page.getByTestId('formula-option-cancel').click();
    await expect(page.getByTestId('formula-option-confirm')).toHaveCount(0);
    await expect(page.locator('.fc-select__option--is-selected')).toContainText(searchTerm);
    await page
      .locator('.fc-select__option--is-selected')
      .getByTestId('formula-option-delete')
      .click();
    await page.getByTestId('formula-option-confirm').click();
    await page.keyboard.press('Escape').catch(() => undefined);
    await expect(value).not.toHaveText(createdLabel, { timeout: 10_000 });
  });

  test('costing shows line costs for selected formula', async ({ page }) => {
    await loginAlice(page);
    await page.goto('/costing');
    await expect(page.getByRole('heading', { name: /cost/i })).toBeVisible();
    await expect(
      page.getByText(/what you are pricing|select or create a formula|ce prețuiești/i),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('inventory add adjust and low badge path', async ({ page }) => {
    await loginAlice(page);
    await page.goto('/inventory');
    await page.getByRole('button', { name: /add stock/i }).click();
    await expect(page.getByRole('dialog', { name: /pick stock/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /low stock/i }).click();
    await expect(page).toHaveURL(/filter=low/);
  });

  test('evaluation sitting upserts t+0 then t+30 on the same day', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAlice(page);
    const smokeFormula = await provisionSmokeFormula(page);
    try {
      await page.goto(`/evaluation?formula=${smokeFormula.slug || smokeFormula.id}`);
      await expect(page).toHaveURL(/\/evaluation/);
      await expect(
        page.getByRole('heading', {
          name: /evaluation|evaluare|bewertung|évaluation|evaluación|valutazione/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /evaluation library|bibliotecă de evaluări/i }),
      ).toHaveCount(0);
      await expect(page.getByTestId('batch-blotter').first()).toBeVisible();
      await expect(page.getByTestId('batch-family-radar')).toBeVisible();
      await expect(page.getByTestId('batch-family-mini')).toHaveCount(7);
      await expect(page.getByTestId('batch-family-kpis')).toBeVisible();
      await expect(page.getByTestId('batch-hero-kpis')).toBeVisible();
      await expect(
        page.locator('[data-testid="batch-family-kpis"] [data-delta=""]').first(),
      ).toBeVisible();

      const saveEval = page.getByRole('button', {
        name: /save day|salvează ziua|tag .* speichern|sauver jour|guardar día|salva giorno/i,
      });
      await expect(saveEval).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#sitting-note')).toBeVisible();
      await expect(page.getByRole('tab', { name: /t\+30/i })).toBeVisible();
      const markGroup = page.getByRole('group', { name: /hedione/i });
      const weakMark = markGroup.getByRole('button', {
        name: /^(weak|slab|schwach|faible|débil|debole)$/i,
      });
      await expect(weakMark).toBeVisible({ timeout: 15_000 });
      await page.locator('#sitting-note').fill('t0 oil lift');
      await weakMark.click();
      await expect(weakMark).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.locator('[data-testid="batch-cell"][data-column="t0Notes"][data-mark="weak"]'),
      ).not.toHaveCount(0);
      await saveEval.click();
      await expect(
        page.getByText(/saved\.|salvat|enregistré|gespeichert|guardado|salvato/i).first(),
      ).toBeVisible({
        timeout: 10_000,
      });
      await expect(page).toHaveURL(/eval=/);
      const evalUrl = page.url();
      await expect(page.getByRole('button', { name: /t0 oil lift/i }).first()).toBeVisible();
      await expect(
        page.locator('[data-testid="batch-cell"][data-column="t0Notes"][data-mark="weak"]'),
      ).not.toHaveCount(0, {
        timeout: 15_000,
      });

      await page.getByRole('tab', { name: /t\+30/i }).click();
      await page.locator('#sitting-note').fill('t30 drier');
      const strongMark = markGroup.getByRole('button', {
        name: /^(strong|puternic|stark|fort|fuerte|forte)$/i,
      });
      await strongMark.click();
      await expect(strongMark).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.locator('[data-testid="batch-cell"][data-column="t30mNotes"][data-mark="strong"]'),
      ).not.toHaveCount(0);
      await expect(
        page.locator('[data-testid="batch-family-kpis"] [data-delta^="+"]'),
      ).not.toHaveCount(0);
      const patched = page.waitForResponse(
        (res) => res.request().method() === 'PATCH' && /\/evaluations\//.test(res.url()),
      );
      await saveEval.click();
      await patched;
      await expect(
        page.getByText(/saved\.|salvat|enregistré|gespeichert|guardado|salvato/i).first(),
      ).toBeVisible({
        timeout: 10_000,
      });
      expect(new URL(page.url()).searchParams.get('eval')).toBe(
        new URL(evalUrl).searchParams.get('eval'),
      );
      await expect(page.locator('#sitting-note')).toHaveValue('t30 drier');
      await expect(
        page.locator('[data-testid="batch-cell"][data-column="t0Notes"][data-mark="weak"]'),
      ).not.toHaveCount(0);
      await expect(
        page.locator('[data-testid="batch-cell"][data-column="t30mNotes"][data-mark="strong"]'),
      ).not.toHaveCount(0);

      await page.getByTestId('maceration-day-14').click();
      await expect(page.getByRole('tab', { name: /t\+30/i })).toHaveCount(0);
      await expect(
        page.getByRole('heading', {
          name: /evolution playhead|playhead evoluție|entwicklungs-playhead|curseur d.évolution|playhead de evolución|playhead evoluzione/i,
        }),
      ).toHaveCount(0);
      await expect(page.locator('#sitting-note')).toBeVisible();
      await page.getByTestId('maceration-day-1').click();
      await expect(page).toHaveURL(/eval=/);

      const adjust = page.getByRole('link', {
        name: /adjust formula|ajustează formula|formel anpassen|ajuster la formule|ajustar la fórmula|regola la formula/i,
      });
      await expect(adjust).toHaveAttribute('href', /eval=/);
      await adjust.click();
      await expect(page).toHaveURL(/\/workbench/);
      await expect(page).toHaveURL(/eval=/);

      await page
        .getByRole('link', {
          name: /evaluation|evaluare|bewertung|évaluation|evaluación|valutazione/i,
        })
        .first()
        .click();
      await expect(page).toHaveURL(/\/evaluation/);
      await expect(page).toHaveURL(/eval=/);
      await page.getByTestId('maceration-day-1').click();
      await page.getByRole('tab', { name: /^t\+0$/i }).click();
      await expect(page.locator('#sitting-note')).toHaveValue('t0 oil lift');
      await page.getByRole('tab', { name: /t\+30/i }).click();
      await expect(page.locator('#sitting-note')).toHaveValue('t30 drier');
    } finally {
      await deleteSmokeFormula(page, smokeFormula.id);
    }
  });

  test('evaluation sitting layout holds at 390, 768 and 1440', async ({ page }) => {
    await loginAlice(page);
    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/evaluation');
      await expect(
        page.getByRole('heading', {
          name: /evaluation|evaluare|bewertung|évaluation|evaluación|valutazione/i,
        }),
      ).toBeVisible();
      const saveEval = page.getByRole('button', {
        name: /save day|salvează ziua|tag .* speichern|sauver jour|guardar día|salva giorno/i,
      });
      if (await saveEval.isVisible().catch(() => false)) {
        await expect(page.locator('#sitting-note')).toBeVisible();
        await expect(saveEval).toBeVisible();
        await expect(page.getByTestId('batch-blotter').first()).toBeVisible();
        const radar = page.getByTestId('batch-family-radar');
        if ((await radar.count()) > 0) {
          await expect(radar.first()).toBeVisible();
          await expect(page.getByTestId('batch-family-mini')).toHaveCount(7);
          await expect(page.getByTestId('batch-family-kpis')).toBeVisible();
          await expect(page.getByTestId('batch-hero-kpis')).toBeVisible();
        }
        const markOk = page.getByRole('button', { name: /^(ok)$/i });
        if ((await markOk.count()) > 0) {
          await expect(markOk.first()).toBeVisible();
        }
      }
      await expect
        .poll(async () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          ),
        )
        .toBeTruthy();
      await page.screenshot({
        path: `/tmp/eval-qa/eval-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });

  test('theme switch persists and language menu changes nav', async ({ page }) => {
    await loginAlice(page);
    const theme = page.getByRole('switch').first();
    await theme.click();
    await page.reload();
    await expect(page.getByRole('switch').first()).toBeVisible();

    const lang = page
      .getByRole('button', { name: /english|français|română|deutsch|español|italiano/i })
      .first();
    await lang.click();
    await page
      .getByRole('option', { name: /français|french/i })
      .click()
      .catch(async () => {
        await page.getByRole('option').nth(1).click();
      });
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('mobile drawer at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAlice(page);
    await expect
      .poll(async () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      )
      .toBeTruthy();

    // Theme / language live in the drawer, not the top bar.
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /english|français|română|deutsch|español|italiano/i }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: /menu/i }).click();
    await expect(page.locator('#app-nav-drawer')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    await expect(page.locator('#app-nav-drawer').getByRole('switch')).toBeVisible();
    await expect(
      page.locator('#app-nav-drawer').getByRole('button', {
        name: /english|français|română|deutsch|español|italiano/i,
      }),
    ).toBeVisible();
  });
});
