# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Fragrance Chemistry smoke >> unauthenticated workbench redirects to auth
- Location: e2e/smoke.spec.ts:85:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /sign in/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /sign in/i }) with timeout 5000ms
  - waiting for getByRole('heading', { name: /sign in/i })

```

```yaml
- banner:
    - link "Home":
        - /url: /
    - switch "Toggle color theme": Dark
    - button "English English":
        - img "English"
        - text: English
- main:
    - heading "Fragrance Chemistry" [level=1]
    - paragraph: Formulation lab
    - paragraph: Secure lab access
    - tablist:
        - tab "Sign in" [selected]
        - tab "Register"
    - text: Email
    - textbox "Email"
    - text: Password
    - textbox "Password"
    - button "Enter lab"
    - paragraph: JWT session against your configured API — no secrets in the client bundle.
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   |
  3   | const DEMO_EMAIL = 'alice@demo.local';
  4   | const DEMO_PASSWORD = 'DemoPass123!';
  5   | const API = process.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
  6   |
  7   | async function loginAlice(page: import('@playwright/test').Page) {
  8   |   await page.goto('/auth');
  9   |   await page.getByLabel('Email').fill(DEMO_EMAIL);
  10  |   await page.getByLabel('Password').fill(DEMO_PASSWORD);
  11  |   await page.getByRole('button', { name: /enter lab/i }).click();
  12  |   await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
  13  |     timeout: 15_000,
  14  |   });
  15  | }
  16  |
  17  | async function authHeaders(page: import('@playwright/test').Page) {
  18  |   const token = await page.evaluate(() => localStorage.getItem('fc.accessToken'));
  19  |   if (!token) throw new Error('Missing access token');
  20  |   return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  21  | }
  22  |
  23  | /** Disposable formula so sitting smokes never rename or overwrite Alice's library. */
  24  | async function provisionSmokeFormula(page: import('@playwright/test').Page) {
  25  |   const headers = await authHeaders(page);
  26  |   const catalogRes = await page.request.get(`${API}/catalog/materials?q=Hedione&limit=20`, {
  27  |     headers,
  28  |   });
  29  |   expect(catalogRes.ok()).toBeTruthy();
  30  |   const catalog = (await catalogRes.json()) as Array<{ id: string; name: string }>;
  31  |   const hedione = catalog.find((row) => /^hedione$/i.test(row.name)) ?? catalog[0];
  32  |   expect(hedione, 'Hedione (or any catalog material) for smoke formula').toBeTruthy();
  33  |
  34  |   const createdRes = await page.request.post(`${API}/formulas`, {
  35  |     headers,
  36  |     data: {
  37  |       name: `__smoke sitting ${Date.now()}`,
  38  |       status: 'draft',
  39  |       concentrationPct: 20,
  40  |       batchTargetGrams: 10,
  41  |       lines: [{ materialId: hedione!.id, percent: 100, pyramidNote: 'middle' }],
  42  |     },
  43  |   });
  44  |   expect(createdRes.ok()).toBeTruthy();
  45  |   return (await createdRes.json()) as { id: string; slug?: string | null };
  46  | }
  47  |
  48  | async function deleteSmokeFormula(page: import('@playwright/test').Page, id: string) {
  49  |   const headers = await authHeaders(page);
  50  |   await page.request.delete(`${API}/formulas/${id}`, { headers }).catch(() => undefined);
  51  | }
  52  |
  53  | test.describe('Fragrance Chemistry smoke', () => {
  54  |   test('unauthenticated home shows the landing page', async ({ page }) => {
  55  |     const protectedRequests: string[] = [];
  56  |     page.on('request', (request) => {
  57  |       const url = request.url();
  58  |       if (
  59  |         /\/api\/v1\/(formulas|catalog|inventory|evaluations|billing|encyclopedia)(?:\/|\?|$)/.test(
  60  |           url,
  61  |         )
  62  |       ) {
  63  |         protectedRequests.push(url);
  64  |       }
  65  |     });
  66  |
  67  |     await page.goto('/');
  68  |     await expect(
  69  |       page.getByRole('heading', { name: /every number in your formula, computed/i }),
  70  |     ).toBeVisible();
  71  |     await expect(page.getByRole('table', { name: /three plans/i })).toBeVisible();
  72  |     await expect(page.getByRole('heading', { name: /three moves, one engine/i })).toBeVisible();
  73  |
  74  |     const start = page.getByRole('link', { name: /start free/i }).first();
  75  |     await expect(start).toHaveAttribute('href', '/auth?mode=register');
  76  |     await start.click();
  77  |     await expect(page).toHaveURL(/\/auth\?mode=register/);
  78  |     await expect(page.getByRole('tab', { name: /register/i })).toHaveAttribute(
  79  |       'aria-selected',
  80  |       'true',
  81  |     );
  82  |     expect(protectedRequests).toEqual([]);
  83  |   });
  84  |
  85  |   test('unauthenticated workbench redirects to auth', async ({ page }) => {
  86  |     await page.goto('/workbench');
  87  |     await expect(page).toHaveURL(/\/auth/);
> 88  |     await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  89  |   });
  90  |
  91  |   test('reject bad login', async ({ page }) => {
  92  |     await page.goto('/auth');
  93  |     await page.getByLabel('Email').fill('nobody@demo.local');
  94  |     await page.getByLabel('Password').fill('wrong-password');
  95  |     await page.getByRole('button', { name: /enter lab/i }).click();
  96  |     await expect(page.getByText(/invalid credentials|could not reach/i)).toBeVisible();
  97  |   });
  98  |
  99  |   test('register new user and land on dashboard', async ({ page }) => {
  100 |     const stamp = Date.now();
  101 |     await page.goto('/auth');
  102 |     await page.getByRole('tab', { name: /register/i }).click();
  103 |     await page.getByLabel('Display name').fill(`Tester ${stamp}`);
  104 |     await page.getByLabel('Email').fill(`tester.${stamp}@example.com`);
  105 |     await page.getByLabel('Password').fill('Password123!');
  106 |     await page.getByRole('button', { name: /create account|join lab|register|sign up/i }).click();
  107 |     await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
  108 |       timeout: 20_000,
  109 |     });
  110 |   });
  111 |
  112 |   test('login alice, hydrate after reload, navigate routes', async ({ page }) => {
  113 |     await loginAlice(page);
  114 |
  115 |     await page.reload();
  116 |     await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
  117 |       timeout: 15_000,
  118 |     });
  119 |
  120 |     const routes: Array<{ path: string; heading: RegExp }> = [
  121 |       { path: '/catalog', heading: /catalog/i },
  122 |       { path: '/workbench', heading: /workbench|formula/i },
  123 |       { path: '/weighing', heading: /weigh/i },
  124 |       { path: '/costing', heading: /cost/i },
  125 |       { path: '/inventory', heading: /inventory/i },
  126 |       { path: '/evaluation', heading: /evaluation/i },
  127 |       { path: '/encyclopedia', heading: /encyclopedia/i },
  128 |       { path: '/suppliers', heading: /suppliers/i },
  129 |     ];
  130 |
  131 |     for (const route of routes) {
  132 |       await page.goto(route.path);
  133 |       await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({
  134 |         timeout: 10_000,
  135 |       });
  136 |     }
  137 |
  138 |     await page.getByRole('button', { name: /sign out/i }).click();
  139 |     await expect(page).toHaveURL(/\/auth/);
  140 |   });
  141 |
  142 |   test('catalog galaxolide-synarome IFRA and Stock tabs do not 500', async ({ page }) => {
  143 |     await loginAlice(page);
  144 |     const failures: string[] = [];
  145 |     page.on('response', (res) => {
  146 |       const url = res.url();
  147 |       if (
  148 |         res.status() >= 500 &&
  149 |         (url.includes('/ifra/materials/') || url.includes('/catalog/materials/'))
  150 |       ) {
  151 |         failures.push(`${res.status()} ${url}`);
  152 |       }
  153 |     });
  154 |     await page.goto('/catalog/galaxolide-synarome');
  155 |     await expect(page.getByRole('heading', { name: /galaxolide/i })).toBeVisible({
  156 |       timeout: 15_000,
  157 |     });
  158 |     await page.getByRole('tab', { name: /^ifra$/i }).click();
  159 |     await expect(page.getByText(/no ifra limits|fine fragrance|category/i).first()).toBeVisible({
  160 |       timeout: 10_000,
  161 |     });
  162 |     await page.getByRole('tab', { name: /^stock$/i }).click();
  163 |     await expect(page.getByText(/min stock|inventory/i).first()).toBeVisible();
  164 |     expect(failures, failures.join('\n')).toEqual([]);
  165 |   });
  166 |
  167 |   test('alice opens account and updates display name', async ({ page }) => {
  168 |     await loginAlice(page);
  169 |     await page.goto('/account');
  170 |     await expect(page.getByRole('heading', { name: /account|cont/i })).toBeVisible({
  171 |       timeout: 15_000,
  172 |     });
  173 |     const name = page.getByLabel(/display name|nume afișat/i).first();
  174 |     await name.fill('Alice Perfumer');
  175 |     await page.getByRole('button', { name: /save profile|salvează profilul/i }).click();
  176 |     await expect(page.getByText(/saved|salvat/i).first()).toBeVisible({ timeout: 10_000 });
  177 |   });
  178 |
  179 |   test('alice is redirected away from admin', async ({ page }) => {
  180 |     await loginAlice(page);
  181 |     await page.goto('/admin');
  182 |     await expect(page).not.toHaveURL(/\/admin/);
  183 |     await expect(page.getByRole('heading', { name: /dashboard|panou/i })).toBeVisible({
  184 |       timeout: 15_000,
  185 |     });
  186 |   });
  187 |
  188 |   test('admin can open users and plans', async ({ page }) => {
```
