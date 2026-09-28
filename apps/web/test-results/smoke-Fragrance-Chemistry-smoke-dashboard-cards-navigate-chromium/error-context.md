# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Fragrance Chemistry smoke >> dashboard cards navigate
- Location: e2e/smoke.spec.ts:210:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: /active formulas/i })

```

# Page snapshot

```yaml
- generic [ref=e3]:
    - complementary [ref=e4]:
        - generic [ref=e9]:
            - strong [ref=e10]: Fragrance Chemistry
            - generic [ref=e11]: Formulation lab
        - navigation "Primary" [ref=e12]:
            - link "Dashboard" [ref=e13] [cursor=pointer]:
                - /url: /?formula=brief-classic-chypre
            - link "Catalog" [ref=e14] [cursor=pointer]:
                - /url: /catalog
            - link "Workbench" [ref=e15] [cursor=pointer]:
                - /url: /workbench?formula=brief-classic-chypre
            - link "Live weighing" [ref=e16] [cursor=pointer]:
                - /url: /weighing?formula=brief-classic-chypre
            - link "Costing" [ref=e17] [cursor=pointer]:
                - /url: /costing?formula=brief-classic-chypre
            - link "Inventory" [ref=e18] [cursor=pointer]:
                - /url: /inventory
            - link "Evaluation" [ref=e19] [cursor=pointer]:
                - /url: /evaluation?formula=brief-classic-chypre
            - link "Encyclopedia" [ref=e20] [cursor=pointer]:
                - /url: /encyclopedia
            - link "Suppliers" [ref=e21] [cursor=pointer]:
                - /url: /suppliers
        - generic [ref=e22]:
            - generic [ref=e23]:
                - switch "Toggle color theme" [ref=e24] [cursor=pointer]:
                    - generic [ref=e27]: Dark
                - button "English English" [ref=e29] [cursor=pointer]:
                    - img "English" [ref=e30]
                    - generic [ref=e36]: English
            - generic [ref=e37]:
                - link "AP Alice Perfumer pro" [ref=e38] [cursor=pointer]:
                    - /url: /account
                    - generic [ref=e39]: AP
                    - generic [ref=e40]:
                        - strong [ref=e41]: Alice Perfumer
                        - emphasis [ref=e42]: pro
                - button "Evaluation reminders" [ref=e44] [cursor=pointer]
            - button "Sign out" [ref=e48] [cursor=pointer]
    - main [ref=e49]:
        - generic [ref=e51]:
            - generic [ref=e52]:
                - generic [ref=e53]:
                    - heading "Dashboard" [level=1] [ref=e54]
                    - paragraph [ref=e55]: Brief the active formula — structure, character, juice strength — then jump to the next lab step.
                - link "Open workbench" [ref=e56] [cursor=pointer]:
                    - /url: /workbench?formula=brief-classic-chypre
            - generic [ref=e57]:
                - link "Your formulas 14 Open →" [ref=e58] [cursor=pointer]:
                    - /url: /workbench?formula=brief-classic-chypre
                    - generic [ref=e59]: Your formulas
                    - strong [ref=e60]: '14'
                    - generic [ref=e61]: Open →
                - link "Catalog materials 763 Open →" [ref=e62] [cursor=pointer]:
                    - /url: /catalog
                    - generic [ref=e63]: Catalog materials
                    - strong [ref=e64]: '763'
                    - generic [ref=e65]: Open →
                - link "Evaluations logged 4 Open →" [ref=e66] [cursor=pointer]:
                    - /url: /evaluation
                    - generic [ref=e67]: Evaluations logged
                    - strong [ref=e68]: '4'
                    - generic [ref=e69]: Open →
                - link "Low stock alerts 0 Open →" [ref=e70] [cursor=pointer]:
                    - /url: /inventory?filter=low
                    - generic [ref=e71]: Low stock alerts
                    - strong [ref=e72]: '0'
                    - generic [ref=e73]: Open →
            - generic [ref=e74]:
                - generic [ref=e75]:
                    - generic [ref=e76]:
                        - heading "Choose a formula to brief" [level=2] [ref=e77]
                        - paragraph [ref=e78]:
                            - text: 'Status: draft ·'
                            - 'link "Last eval: 3/5 · day 1" [ref=e79] [cursor=pointer]':
                                - /url: /evaluation?formula=brief-classic-chypre&eval=c6909d76-2a41-491b-947d-0ecce14b771b
                        - paragraph [ref=e80]: Day 1 sitting in progress · T+4 h
                    - generic [ref=e81]:
                        - generic [ref=e83]:
                            - generic [ref=e84]:
                                - generic [ref=e85]: Active formula
                                - generic [ref=e86]:
                                    - log [ref=e88]
                                    - generic [ref=e90]:
                                        - generic [ref=e91]: 'Brief: Classic Chypre (draft)'
                                        - combobox "Active formula" [ref=e93]
                            - button "+ New" [ref=e98] [cursor=pointer]
                        - button "Export Excel" [ref=e99] [cursor=pointer]
                - generic [ref=e100]:
                    - article [ref=e101]:
                        - generic [ref=e103]:
                            - heading "Scent structure" [level=3] [ref=e104]
                            - paragraph [ref=e105]: How you placed each material — top, heart, or base.
                        - generic [ref=e108]:
                            - generic [ref=e110]:
                                - img "Olfactory pyramid" [ref=e111]:
                                    - button "Top 30.0%" [ref=e112] [cursor=pointer]:
                                        - generic: Top
                                    - button "Heart 38.0%" [ref=e114] [cursor=pointer]:
                                        - generic: Heart
                                    - button "Base 32.0%" [ref=e116] [cursor=pointer]:
                                        - generic: Base
                                - generic [aria-hidden]:
                                    - strong: 30.0%
                                - generic [aria-hidden]:
                                    - strong: 38.0%
                                - generic [aria-hidden]:
                                    - strong: 32.0%
                            - list [ref=e118]:
                                - listitem [ref=e119]:
                                    - button [ref=e120] [cursor=pointer]:
                                        - strong [ref=e122]: Top
                                        - emphasis [ref=e123]: 30.0%
                                - listitem [ref=e124]:
                                    - button [ref=e125] [cursor=pointer]:
                                        - strong [ref=e127]: Heart
                                        - emphasis [ref=e128]: 38.0%
                                - listitem [ref=e129]:
                                    - button [ref=e130] [cursor=pointer]:
                                        - strong [ref=e132]: Base
                                        - emphasis [ref=e133]: 32.0%
                        - generic [ref=e134]:
                            - heading "Dry-down vs tags" [level=4] [ref=e135]
                            - paragraph [ref=e136]: Blotter tenacity agrees with your pyramid. These materials should open, bloom, and linger on the steps you tagged.
                    - article [ref=e137]:
                        - generic [ref=e139]:
                            - heading "Juice profile" [level=3] [ref=e140]
                            - paragraph [ref=e141]: Drag the fill line to set concentrate strength
                        - generic [ref=e142]:
                            - generic "Concentrate 17 percent" [ref=e144]:
                                - generic [ref=e148]:
                                    - generic: FRAGRANCE CHEMISTRY
                                    - slider "Concentrate percent" [ref=e149]:
                                        - strong [ref=e152]: 17%
                                - generic [ref=e154]:
                                    - generic [ref=e155]: 17% concentrate · EDP
                                    - link "$45.23 / 50 ml" [ref=e156] [cursor=pointer]:
                                        - /url: /costing?formula=brief-classic-chypre
                            - paragraph [ref=e157]: 10.0 g concentrate @ 17% → 48.8 g diluent
                    - article [ref=e158]:
                        - heading "Family character" [level=3] [ref=e159]
                        - generic [ref=e160]:
                            - application [ref=e164]:
                                - generic [ref=e180]:
                                    - generic [ref=e181]: Floral
                                    - generic [ref=e183]: Fresh
                                    - generic [ref=e185]: Woody
                                    - generic [ref=e187]: Amber
                            - group "Family filters" [ref=e195]:
                                - button "Floral 38%" [ref=e196] [cursor=pointer]
                                - button "Fresh 30%" [ref=e198] [cursor=pointer]
                                - button "Woody 22%" [ref=e200] [cursor=pointer]
                                - button "Amber 10%" [ref=e202] [cursor=pointer]
                    - article [ref=e204]:
                        - heading "IFRA, EU label & allergens" [level=3] [ref=e205]
                        - generic [ref=e206]:
                            - generic [ref=e209]:
                                - strong [ref=e210]: IFRA status
                                - paragraph [ref=e211]: Non-compliant · Category 4 — Fine fragrance
                            - paragraph [ref=e212]: Category 4 is the fine-fragrance limit, checked on the finished juice. EU label declaration is a separate leave-on 0.001% threshold. Annex III hits are a curated subset, not a full CPNP file.
                            - generic [ref=e213]:
                                - heading "EU label declaration" [level=4] [ref=e214]
                                - paragraph [ref=e215]: Leave-on threshold 0.001% of concentrate (Reg. 1223/2009 practice).
                                - list [ref=e216]:
                                    - listitem [ref=e217]: Citronellol
                                    - listitem [ref=e218]: Eugenol
                                    - listitem [ref=e219]: Farnesol
                                    - listitem [ref=e220]: Geraniol
                                    - listitem [ref=e221]: Limonene
                                    - listitem [ref=e222]: Linalool
                                    - listitem [ref=e223]: Evernia Prunastri Extract
                            - paragraph [ref=e224]: No curated Annex III hits on these CAS numbers.
                            - list [ref=e225]:
                                - listitem [ref=e226]:
                                    - generic [ref=e227]: Jasmine Absolute
                                    - emphasis [ref=e228]: 3.06% / 0.6%
                                - listitem [ref=e229]:
                                    - generic [ref=e230]: Oakmoss Absolute
                                    - emphasis [ref=e231]: 2.04% / 0.1%
                            - link "Browse materials & limits" [ref=e232] [cursor=pointer]:
                                - /url: /catalog
                - generic [ref=e233]:
                    - generic [ref=e234]:
                        - heading "All materials in this formula" [level=3] [ref=e235]
                        - generic [ref=e236]:
                            - generic [ref=e237]:
                                - 'button "Sort by: Date added" [ref=e238] [cursor=pointer]':
                                    - generic [ref=e245]: Date added
                                - button "Family" [ref=e246] [cursor=pointer]
                            - group "Display units" [ref=e251]:
                                - button "%" [ref=e252] [cursor=pointer]
                                - button "PPT" [ref=e253] [cursor=pointer]
                                - button "g" [ref=e254] [cursor=pointer]
                    - list [ref=e255]:
                        - listitem [ref=e256]:
                            - list [ref=e257]:
                                - listitem [ref=e258]:
                                    - generic [ref=e259]:
                                        - checkbox "Select line" [ref=e261] [cursor=pointer]
                                        - link "Bergamot EO Top 30.0% $0.36" [ref=e262] [cursor=pointer]:
                                            - /url: /catalog/bergamot-eo-firmenich
                                            - generic [ref=e263]: Bergamot EO
                                            - generic [ref=e264]: Top
                                            - generic [ref=e265]:
                                                - emphasis [ref=e266]: 30.0%
                                                - generic [ref=e267]: $0.36
                                - listitem [ref=e268]:
                                    - generic [ref=e269]:
                                        - checkbox "Select line" [ref=e271] [cursor=pointer]
                                        - link "Rose Absolute Heart 20.0% $17.00" [ref=e272] [cursor=pointer]:
                                            - /url: /catalog/rose-absolute-symrise
                                            - generic [ref=e273]: Rose Absolute
                                            - generic [ref=e274]: Heart
                                            - generic [ref=e275]:
                                                - emphasis [ref=e276]: 20.0%
                                                - generic [ref=e277]: $17.00
                                - listitem [ref=e278]:
                                    - generic [ref=e279]:
                                        - checkbox "Select line" [ref=e281] [cursor=pointer]
                                        - link "Jasmine Absolute Heart 18.0% $21.60" [ref=e282] [cursor=pointer]:
                                            - /url: /catalog/jasmine-absolute-iff
                                            - generic [ref=e283]: Jasmine Absolute
                                            - generic [ref=e284]: Heart
                                            - generic [ref=e285]:
                                                - emphasis [ref=e286]: 18.0%
                                                - generic [ref=e287]: $21.60
                                - listitem [ref=e288]:
                                    - generic [ref=e289]:
                                        - checkbox "Select line" [ref=e291] [cursor=pointer]
                                        - link "Oakmoss Absolute Base 12.0% $2.88" [ref=e292] [cursor=pointer]:
                                            - /url: /catalog/oakmoss-absolute-synarome
                                            - generic [ref=e293]: Oakmoss Absolute
                                            - generic [ref=e294]: Base
                                            - generic [ref=e295]:
                                                - emphasis [ref=e296]: 12.0%
                                                - generic [ref=e297]: $2.88
                                - listitem [ref=e298]:
                                    - generic [ref=e299]:
                                        - checkbox "Select line" [ref=e301] [cursor=pointer]
                                        - link "Patchouli EO Base 10.0% $0.22" [ref=e302] [cursor=pointer]:
                                            - /url: /catalog/patchouli-eo-iff
                                            - generic [ref=e303]: Patchouli EO
                                            - generic [ref=e304]: Base
                                            - generic [ref=e305]:
                                                - emphasis [ref=e306]: 10.0%
                                                - generic [ref=e307]: $0.22
                                - listitem [ref=e308]:
                                    - generic [ref=e309]:
                                        - checkbox "Select line" [ref=e311] [cursor=pointer]
                                        - link "Labdanum Absolute Base 10.0% $1.60" [ref=e312] [cursor=pointer]:
                                            - /url: /catalog/labdanum-absolute-synarome
                                            - generic [ref=e313]: Labdanum Absolute
                                            - generic [ref=e314]: Base
                                            - generic [ref=e315]:
                                                - emphasis [ref=e316]: 10.0%
                                                - generic [ref=e317]: $1.60
                                - listitem [ref=e318]:
                                    - generic [ref=e319]:
                                        - checkbox "Select line" [ref=e321] [cursor=pointer]
                                        - link "Hedione Heart 0.0% $0.00" [ref=e322] [cursor=pointer]:
                                            - /url: /catalog/hedione-firmenich
                                            - generic [ref=e323]: Hedione
                                            - generic [ref=e324]: Heart
                                            - generic [ref=e325]:
                                                - emphasis [ref=e326]: 0.0%
                                                - generic [ref=e327]: $0.00
                - generic [ref=e328]:
                    - link "Edit in workbench" [ref=e329] [cursor=pointer]:
                        - /url: /workbench?formula=brief-classic-chypre
                    - link "Cost this juice" [ref=e330] [cursor=pointer]:
                        - /url: /costing?formula=brief-classic-chypre
                    - link "Evaluate" [ref=e331] [cursor=pointer]:
                        - /url: /evaluation?formula=brief-classic-chypre&eval=c6909d76-2a41-491b-947d-0ecce14b771b
                    - link "Weigh" [ref=e332] [cursor=pointer]:
                        - /url: /weighing?formula=brief-classic-chypre
```

# Test source

```ts
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
  189 |     await page.goto('/auth');
  190 |     await page.getByLabel('Email').fill('admin@demo.local');
  191 |     await page.getByLabel('Password').fill(DEMO_PASSWORD);
  192 |     await page.getByRole('button', { name: /enter lab/i }).click();
  193 |     await expect(page.getByRole('heading', { name: /dashboard|panou/i })).toBeVisible({
  194 |       timeout: 15_000,
  195 |     });
  196 |     await page.goto('/admin');
  197 |     await expect(page.getByRole('heading', { name: /administration|administrare/i })).toBeVisible({
  198 |       timeout: 15_000,
  199 |     });
  200 |     await page.goto('/admin/users');
  201 |     await expect(page.getByRole('link', { name: /alice/i }).first()).toBeVisible({
  202 |       timeout: 10_000,
  203 |     });
  204 |     await page.goto('/admin/plans');
  205 |     await expect(page.getByRole('link', { name: /free|pro|enterprise/i }).first()).toBeVisible({
  206 |       timeout: 10_000,
  207 |     });
  208 |   });
  209 |
  210 |   test('dashboard cards navigate', async ({ page }) => {
  211 |     await loginAlice(page);
> 212 |     await page.getByRole('link', { name: /active formulas/i }).click();
      |                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
  213 |     await expect(page).toHaveURL(/\/workbench/);
  214 |     await page.goto('/');
  215 |     await page.getByRole('link', { name: /low stock/i }).click();
  216 |     await expect(page).toHaveURL(/\/inventory/);
  217 |   });
  218 |
  219 |   test('workbench create formula and persist after reload', async ({ page }) => {
  220 |     await loginAlice(page);
  221 |     await page.goto('/workbench');
  222 |     await page.getByRole('button', { name: /\+ new/i }).click();
  223 |     await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 10_000 });
  224 |     const addBtn = page.getByRole('button', { name: /add material/i });
  225 |     if (await addBtn.isVisible().catch(() => false)) {
  226 |       await addBtn.click();
  227 |       const search = page.getByPlaceholder(/search/i).first();
  228 |       if (await search.isVisible().catch(() => false)) {
  229 |         await search.fill('a');
  230 |         const option = page.getByRole('button').filter({ hasText: /.+/ }).nth(1);
  231 |         await option.click({ timeout: 5_000 }).catch(() => undefined);
  232 |       }
  233 |       await page.keyboard.press('Escape').catch(() => undefined);
  234 |     }
  235 |     const save = page.getByRole('button', { name: /save/i });
  236 |     if (await save.isEnabled().catch(() => false)) {
  237 |       await save.click();
  238 |     }
  239 |     await page.reload();
  240 |     await expect(page.getByRole('heading', { name: /workbench|formula/i }).first()).toBeVisible();
  241 |     const del = page.getByRole('button', { name: /^delete$/i });
  242 |     if (await del.isVisible().catch(() => false)) {
  243 |       page.once('dialog', (d) => d.accept());
  244 |       await del.click();
  245 |     }
  246 |   });
  247 |
  248 |   test('workbench picker stays open after adding a material', async ({ page }) => {
  249 |     await loginAlice(page);
  250 |     await page.goto('/workbench');
  251 |     await page.getByRole('button', { name: /\+ new/i }).click();
  252 |     const addBtn = page.getByRole('button', { name: /add material|adaugă material/i });
  253 |     await expect(addBtn).toBeVisible({ timeout: 15_000 });
  254 |     await addBtn.click();
  255 |     const dialog = page.getByRole('dialog');
  256 |     await expect(dialog).toBeVisible();
  257 |     const search = page.getByPlaceholder(/search|caut/i).first();
  258 |     await search.fill('a');
  259 |     const option = dialog
  260 |       .locator('button')
  261 |       .filter({ has: page.locator('strong') })
  262 |       .first();
  263 |     await expect(option).toBeVisible({ timeout: 10_000 });
  264 |     await option.click();
  265 |     await expect(dialog).toBeVisible();
  266 |     await expect(dialog.getByRole('button', { name: /done|gata/i })).toBeVisible();
  267 |     await dialog.getByRole('button', { name: /done|gata/i }).click();
  268 |     await expect(dialog).toBeHidden();
  269 |   });
  270 |
  271 |   test('workbench pyramid shows layer contents instead of a percent legend', async ({ page }) => {
  272 |     test.setTimeout(60_000);
  273 |     await loginAlice(page);
  274 |     await page.goto('/workbench');
  275 |     await page.getByRole('button', { name: /\+ new/i }).click();
  276 |     await expect(
  277 |       page.getByRole('heading', { name: /pyramid balance|echilibru piramid/i }),
  278 |     ).toBeVisible({
  279 |       timeout: 15_000,
  280 |     });
  281 |     await expect(page.getByTestId('pyramid-layer-empty')).toBeVisible();
  282 |     await expect(page.getByTestId('pyramid-layer-summary')).toHaveCount(0);
  283 |
  284 |     const addBtn = page.getByRole('button', { name: /add material|adaugă material/i });
  285 |     await addBtn.click();
  286 |     const dialog = page.getByRole('dialog');
  287 |     await expect(dialog).toBeVisible();
  288 |
  289 |     async function pick(query: string) {
  290 |       const search = page.getByPlaceholder(/search|caut/i).first();
  291 |       await search.fill(query);
  292 |       const option = dialog
  293 |         .locator('button')
  294 |         .filter({ has: page.locator('strong') })
  295 |         .filter({ hasText: new RegExp(query, 'i') })
  296 |         .first();
  297 |       await expect(option).toBeVisible({ timeout: 10_000 });
  298 |       await option.click();
  299 |     }
  300 |
  301 |     await pick('Hedione');
  302 |     await pick('Linalool');
  303 |     await dialog.getByRole('button', { name: /done|gata/i }).click();
  304 |     await expect(dialog).toBeHidden();
  305 |
  306 |     const summary = page.getByTestId('pyramid-layer-summary');
  307 |     await expect(summary).toBeVisible();
  308 |     await expect(summary).toContainText(/hedione|linalool/i);
  309 |     await expect(page.getByTestId('pyramid-layer-empty')).toHaveCount(0);
  310 |
  311 |     const heartRow = summary.getByRole('button', { name: /heart/i });
  312 |     await heartRow.click();
```
