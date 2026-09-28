# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Fragrance Chemistry smoke >> workbench formula selector searches and confirms row delete
- Location: e2e/smoke.spec.ts:397:3

# Error details

```
Error: expect(locator).not.toHaveText(expected) failed

Locator:  getByTestId('formula-selector').locator('.fc-select__single-value')
Expected: not "Untitled formula Sep 28, 03:31 PM (draft)"
Received: "Untitled formula Sep 28, 03:31 PM (draft)"
Timeout:  10000ms

Call log:
  - Expect "not toHaveText" getByTestId('formula-selector').locator('.fc-select__single-value') with timeout 10000ms
  - waiting for getByTestId('formula-selector').locator('.fc-select__single-value')
    24 × locator resolved to <div class="fc-select__single-value css-cjqrcd-singleValue">Untitled formula Sep 28, 03:31 PM (draft)</div>
       - unexpected value "Untitled formula Sep 28, 03:31 PM (draft)"

```

```yaml
- text: Untitled formula Sep 28, 03:31 PM (draft)
```

# Test source

```ts
  347 |       .filter({ has: page.getByRole('combobox', { name: /^note$/i }) })
  348 |       .first();
  349 |     await noteControl.scrollIntoViewIfNeeded();
  350 |     await noteControl.click();
  351 |     await page.getByRole('option', { name: /^other$/i }).click();
  352 |     await expect(summary.getByRole('button', { name: /other/i })).toBeVisible({
  353 |       timeout: 10_000,
  354 |     });
  355 |   });
  356 |
  357 |   test('workbench pyramid layer panel fits a mobile viewport', async ({ page }) => {
  358 |     await page.setViewportSize({ width: 390, height: 844 });
  359 |     await loginAlice(page);
  360 |     await page.goto('/workbench');
  361 |     await page.getByRole('button', { name: /\+ new/i }).click();
  362 |     await expect(
  363 |       page.getByRole('heading', { name: /pyramid balance|echilibru piramid/i }),
  364 |     ).toBeVisible({
  365 |       timeout: 15_000,
  366 |     });
  367 |     await expect(page.getByTestId('pyramid-layer-empty')).toBeVisible();
  368 |     await page
  369 |       .getByRole('heading', { name: /pyramid balance|echilibru piramid/i })
  370 |       .scrollIntoViewIfNeeded();
  371 |     const noOverflow = await page.evaluate(
  372 |       () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  373 |     );
  374 |     expect(noOverflow).toBe(true);
  375 |     await expect(page.getByRole('img', { name: /olfactory pyramid/i })).toBeVisible();
  376 |   });
  377 |
  378 |   test('workbench delete formula stays above sticky row actions', async ({ page }) => {
  379 |     await page.setViewportSize({ width: 1280, height: 560 });
  380 |     await loginAlice(page);
  381 |     await page.goto('/workbench');
  382 |     const del = page.getByRole('button', { name: /delete formula|șterge formula/i });
  383 |     await expect(del).toBeVisible({ timeout: 15_000 });
  384 |     await del.scrollIntoViewIfNeeded();
  385 |     const box = await del.boundingBox();
  386 |     expect(box).toBeTruthy();
  387 |     const hit = await page.evaluate(
  388 |       ({ x, y }) => {
  389 |         const el = document.elementFromPoint(x, y);
  390 |         return el?.closest('button')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  391 |       },
  392 |       { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  393 |     );
  394 |     expect(hit).toMatch(/delete formula|șterge formula/i);
  395 |   });
  396 |
  397 |   test('workbench formula selector searches and confirms row delete', async ({ page }) => {
  398 |     test.setTimeout(60_000);
  399 |     await loginAlice(page);
  400 |     await page.goto('/workbench');
  401 |     await page.getByRole('button', { name: /\+ new/i }).click();
  402 |     const selector = page.getByTestId('formula-selector');
  403 |     const value = selector.locator('.fc-select__single-value');
  404 |     await expect(value).toContainText(/untitled formula/i, { timeout: 15_000 });
  405 |     const createdLabel = ((await value.textContent()) ?? '').trim();
  406 |     const searchTerm = createdLabel.replace(/\s*\(.*$/, '').trim();
  407 |
  408 |     async function openMenu() {
  409 |       await selector.locator('.fc-select__control').click();
  410 |       await expect(page.locator('.fc-select__menu')).toBeVisible();
  411 |     }
  412 |
  413 |     for (const viewport of [
  414 |       { width: 1280, height: 800 },
  415 |       { width: 768, height: 1024 },
  416 |       { width: 390, height: 844 },
  417 |     ]) {
  418 |       await page.setViewportSize(viewport);
  419 |       await openMenu();
  420 |       await expect(page.getByTestId('formula-option-delete').first()).toBeVisible();
  421 |       const noOverflow = await page.evaluate(
  422 |         () => document.documentElement.scrollWidth <= window.innerWidth + 2,
  423 |       );
  424 |       expect(noOverflow).toBe(true);
  425 |       await page.keyboard.press('Escape');
  426 |       await expect(page.locator('.fc-select__menu')).toHaveCount(0);
  427 |     }
  428 |
  429 |     await page.setViewportSize({ width: 1280, height: 800 });
  430 |     await openMenu();
  431 |     const search = selector.getByRole('combobox', { name: /active formula/i });
  432 |     await search.fill(searchTerm);
  433 |     const option = page.locator('.fc-select__option--is-selected');
  434 |     await expect(option).toContainText(searchTerm);
  435 |     await option.getByTestId('formula-option-delete').click();
  436 |     await expect(page.getByTestId('formula-option-confirm')).toBeVisible();
  437 |     await expect(option).toContainText(/delete this formula/i);
  438 |     await page.getByTestId('formula-option-cancel').click();
  439 |     await expect(page.getByTestId('formula-option-confirm')).toHaveCount(0);
  440 |     await expect(page.locator('.fc-select__option--is-selected')).toContainText(searchTerm);
  441 |     await page
  442 |       .locator('.fc-select__option--is-selected')
  443 |       .getByTestId('formula-option-delete')
  444 |       .click();
  445 |     await page.getByTestId('formula-option-confirm').click();
  446 |     await page.keyboard.press('Escape').catch(() => undefined);
> 447 |     await expect(value).not.toHaveText(createdLabel, { timeout: 10_000 });
      |                             ^ Error: expect(locator).not.toHaveText(expected) failed
  448 |   });
  449 |
  450 |   test('costing shows line costs for selected formula', async ({ page }) => {
  451 |     await loginAlice(page);
  452 |     await page.goto('/costing');
  453 |     await expect(page.getByRole('heading', { name: /cost/i })).toBeVisible();
  454 |     await expect(
  455 |       page.getByText(/what you are pricing|select or create a formula|ce prețuiești/i),
  456 |     ).toBeVisible({
  457 |       timeout: 10_000,
  458 |     });
  459 |   });
  460 |
  461 |   test('inventory add adjust and low badge path', async ({ page }) => {
  462 |     await loginAlice(page);
  463 |     await page.goto('/inventory');
  464 |     await page.getByRole('button', { name: /add stock/i }).click();
  465 |     await expect(page.getByRole('dialog', { name: /pick stock/i })).toBeVisible();
  466 |     await page.keyboard.press('Escape');
  467 |     await page.getByRole('tab', { name: /low stock/i }).click();
  468 |     await expect(page).toHaveURL(/filter=low/);
  469 |   });
  470 |
  471 |   test('evaluation sitting upserts t+0 then t+30 on the same day', async ({ page }) => {
  472 |     test.setTimeout(90_000);
  473 |     await loginAlice(page);
  474 |     const smokeFormula = await provisionSmokeFormula(page);
  475 |     try {
  476 |       await page.goto(`/evaluation?formula=${smokeFormula.slug || smokeFormula.id}`);
  477 |       await expect(page).toHaveURL(/\/evaluation/);
  478 |       await expect(
  479 |         page.getByRole('heading', {
  480 |           name: /evaluation|evaluare|bewertung|évaluation|evaluación|valutazione/i,
  481 |         }),
  482 |       ).toBeVisible();
  483 |       await expect(
  484 |         page.getByRole('heading', { name: /evaluation library|bibliotecă de evaluări/i }),
  485 |       ).toHaveCount(0);
  486 |       await expect(page.getByTestId('batch-blotter').first()).toBeVisible();
  487 |       await expect(page.getByTestId('batch-family-radar')).toBeVisible();
  488 |       await expect(page.getByTestId('batch-family-mini')).toHaveCount(7);
  489 |       await expect(page.getByTestId('batch-family-kpis')).toBeVisible();
  490 |       await expect(page.getByTestId('batch-hero-kpis')).toBeVisible();
  491 |       await expect(
  492 |         page.locator('[data-testid="batch-family-kpis"] [data-delta=""]').first(),
  493 |       ).toBeVisible();
  494 |
  495 |       const saveEval = page.getByRole('button', {
  496 |         name: /save day|salvează ziua|tag .* speichern|sauver jour|guardar día|salva giorno/i,
  497 |       });
  498 |       await expect(saveEval).toBeVisible({ timeout: 10_000 });
  499 |       await expect(page.locator('#sitting-note')).toBeVisible();
  500 |       await expect(page.getByRole('tab', { name: /t\+30/i })).toBeVisible();
  501 |       const markGroup = page.getByRole('group', { name: /hedione/i });
  502 |       const weakMark = markGroup.getByRole('button', {
  503 |         name: /^(weak|slab|schwach|faible|débil|debole)$/i,
  504 |       });
  505 |       await expect(weakMark).toBeVisible({ timeout: 15_000 });
  506 |       await page.locator('#sitting-note').fill('t0 oil lift');
  507 |       await weakMark.click();
  508 |       await expect(weakMark).toHaveAttribute('aria-pressed', 'true');
  509 |       await expect(
  510 |         page.locator('[data-testid="batch-cell"][data-column="t0Notes"][data-mark="weak"]'),
  511 |       ).not.toHaveCount(0);
  512 |       await saveEval.click();
  513 |       await expect(
  514 |         page.getByText(/saved\.|salvat|enregistré|gespeichert|guardado|salvato/i).first(),
  515 |       ).toBeVisible({
  516 |         timeout: 10_000,
  517 |       });
  518 |       await expect(page).toHaveURL(/eval=/);
  519 |       const evalUrl = page.url();
  520 |       await expect(page.getByRole('button', { name: /t0 oil lift/i }).first()).toBeVisible();
  521 |       await expect(
  522 |         page.locator('[data-testid="batch-cell"][data-column="t0Notes"][data-mark="weak"]'),
  523 |       ).not.toHaveCount(0, {
  524 |         timeout: 15_000,
  525 |       });
  526 |
  527 |       await page.getByRole('tab', { name: /t\+30/i }).click();
  528 |       await page.locator('#sitting-note').fill('t30 drier');
  529 |       const strongMark = markGroup.getByRole('button', {
  530 |         name: /^(strong|puternic|stark|fort|fuerte|forte)$/i,
  531 |       });
  532 |       await strongMark.click();
  533 |       await expect(strongMark).toHaveAttribute('aria-pressed', 'true');
  534 |       await expect(
  535 |         page.locator('[data-testid="batch-cell"][data-column="t30mNotes"][data-mark="strong"]'),
  536 |       ).not.toHaveCount(0);
  537 |       await expect(
  538 |         page.locator('[data-testid="batch-family-kpis"] [data-delta^="+"]'),
  539 |       ).not.toHaveCount(0);
  540 |       const patched = page.waitForResponse(
  541 |         (res) => res.request().method() === 'PATCH' && /\/evaluations\//.test(res.url()),
  542 |       );
  543 |       await saveEval.click();
  544 |       await patched;
  545 |       await expect(
  546 |         page.getByText(/saved\.|salvat|enregistré|gespeichert|guardado|salvato/i).first(),
  547 |       ).toBeVisible({
```
