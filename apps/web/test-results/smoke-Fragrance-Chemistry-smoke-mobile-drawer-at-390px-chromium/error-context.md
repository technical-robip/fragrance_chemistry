# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Fragrance Chemistry smoke >> mobile drawer at 390px
- Location: e2e/smoke.spec.ts:786:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('switch')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByRole('switch') with timeout 5000ms
  - waiting for getByRole('switch')
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
    - banner [ref=e4]:
        - button "Open menu" [ref=e5] [cursor=pointer]
        - strong [ref=e12]: Fragrance Chemistry
        - button "Evaluation reminders" [ref=e14] [cursor=pointer]
        - link "Account" [ref=e18] [cursor=pointer]:
            - /url: /account
            - text: AP
    - complementary [ref=e19]:
        - generic [ref=e24]:
            - strong [ref=e25]: Fragrance Chemistry
            - generic [ref=e26]: Formulation lab
        - navigation "Primary" [ref=e27]:
            - link "Dashboard" [ref=e28] [cursor=pointer]:
                - /url: /?formula=brief-classic-chypre
            - link "Catalog" [ref=e29] [cursor=pointer]:
                - /url: /catalog
            - link "Workbench" [ref=e30] [cursor=pointer]:
                - /url: /workbench?formula=brief-classic-chypre
            - link "Live weighing" [ref=e31] [cursor=pointer]:
                - /url: /weighing?formula=brief-classic-chypre
            - link "Costing" [ref=e32] [cursor=pointer]:
                - /url: /costing?formula=brief-classic-chypre
            - link "Inventory" [ref=e33] [cursor=pointer]:
                - /url: /inventory
            - link "Evaluation" [ref=e34] [cursor=pointer]:
                - /url: /evaluation?formula=brief-classic-chypre
            - link "Encyclopedia" [ref=e35] [cursor=pointer]:
                - /url: /encyclopedia
            - link "Suppliers" [ref=e36] [cursor=pointer]:
                - /url: /suppliers
        - generic [ref=e37]:
            - generic [ref=e38]:
                - switch "Toggle color theme" [ref=e39] [cursor=pointer]
                - button "English English" [ref=e43] [cursor=pointer]:
                    - img "English" [ref=e44]
                    - generic [ref=e50]: English
            - generic [ref=e51]:
                - link "AP Alice Perfumer pro" [ref=e52] [cursor=pointer]:
                    - /url: /account
                    - generic [ref=e53]: AP
                    - generic [ref=e54]:
                        - strong [ref=e55]: Alice Perfumer
                        - emphasis [ref=e56]: pro
                - button "Evaluation reminders" [ref=e58] [cursor=pointer]
            - button "Sign out" [ref=e62] [cursor=pointer]
    - main [ref=e63]:
        - generic [ref=e65]:
            - generic [ref=e66]:
                - generic [ref=e67]:
                    - heading "Dashboard" [level=1] [ref=e68]
                    - paragraph [ref=e69]: Brief the active formula — structure, character, juice strength — then jump to the next lab step.
                - link "Open workbench" [ref=e70] [cursor=pointer]:
                    - /url: /workbench?formula=brief-classic-chypre
            - generic [ref=e71]:
                - link "Your formulas 18 Open →" [ref=e72] [cursor=pointer]:
                    - /url: /workbench?formula=brief-classic-chypre
                    - generic [ref=e73]: Your formulas
                    - strong [ref=e74]: '18'
                    - generic [ref=e75]: Open →
                - link "Catalog materials 763 Open →" [ref=e76] [cursor=pointer]:
                    - /url: /catalog
                    - generic [ref=e77]: Catalog materials
                    - strong [ref=e78]: '763'
                    - generic [ref=e79]: Open →
                - link "Evaluations logged 4 Open →" [ref=e80] [cursor=pointer]:
                    - /url: /evaluation
                    - generic [ref=e81]: Evaluations logged
                    - strong [ref=e82]: '4'
                    - generic [ref=e83]: Open →
                - link "Low stock alerts 0 Open →" [ref=e84] [cursor=pointer]:
                    - /url: /inventory?filter=low
                    - generic [ref=e85]: Low stock alerts
                    - strong [ref=e86]: '0'
                    - generic [ref=e87]: Open →
            - generic [ref=e88]:
                - generic [ref=e89]:
                    - generic [ref=e90]:
                        - heading "Choose a formula to brief" [level=2] [ref=e91]
                        - paragraph [ref=e92]:
                            - text: 'Status: draft ·'
                            - 'link "Last eval: 3/5 · day 1" [ref=e93] [cursor=pointer]':
                                - /url: /evaluation?formula=brief-classic-chypre&eval=c6909d76-2a41-491b-947d-0ecce14b771b
                        - paragraph [ref=e94]: Day 1 sitting in progress · T+4 h
                    - generic [ref=e95]:
                        - generic [ref=e97]:
                            - generic [ref=e98]:
                                - generic [ref=e99]: Active formula
                                - generic [ref=e100]:
                                    - log [ref=e102]
                                    - generic [ref=e104]:
                                        - generic [ref=e105]: 'Brief: Classic Chypre (draft)'
                                        - combobox "Active formula" [ref=e107]
                            - button "+ New" [ref=e112] [cursor=pointer]
                        - button "Export Excel" [ref=e113] [cursor=pointer]
                - generic [ref=e114]:
                    - article [ref=e115]:
                        - generic [ref=e117]:
                            - heading "Scent structure" [level=3] [ref=e118]
                            - paragraph [ref=e119]: How you placed each material — top, heart, or base.
                        - generic [ref=e122]:
                            - generic [ref=e124]:
                                - img "Olfactory pyramid" [ref=e125]:
                                    - button "Top 30.0%" [ref=e126] [cursor=pointer]:
                                        - generic: Top
                                    - button "Heart 38.0%" [ref=e128] [cursor=pointer]:
                                        - generic: Heart
                                    - button "Base 32.0%" [ref=e130] [cursor=pointer]:
                                        - generic: Base
                                - generic [aria-hidden]:
                                    - strong: 30.0%
                                - generic [aria-hidden]:
                                    - strong: 38.0%
                                - generic [aria-hidden]:
                                    - strong: 32.0%
                            - list [ref=e132]:
                                - listitem [ref=e133]:
                                    - button [ref=e134] [cursor=pointer]:
                                        - strong [ref=e136]: Top
                                        - emphasis [ref=e137]: 30.0%
                                - listitem [ref=e138]:
                                    - button [ref=e139] [cursor=pointer]:
                                        - strong [ref=e141]: Heart
                                        - emphasis [ref=e142]: 38.0%
                                - listitem [ref=e143]:
                                    - button [ref=e144] [cursor=pointer]:
                                        - strong [ref=e146]: Base
                                        - emphasis [ref=e147]: 32.0%
                        - generic [ref=e148]:
                            - heading "Dry-down vs tags" [level=4] [ref=e149]
                            - paragraph [ref=e150]: Blotter tenacity agrees with your pyramid. These materials should open, bloom, and linger on the steps you tagged.
                    - article [ref=e151]:
                        - generic [ref=e153]:
                            - heading "Juice profile" [level=3] [ref=e154]
                            - paragraph [ref=e155]: Drag the fill line to set concentrate strength
                        - generic [ref=e156]:
                            - generic "Concentrate 17 percent" [ref=e158]:
                                - generic [ref=e162]:
                                    - generic: FRAGRANCE CHEMISTRY
                                    - slider "Concentrate percent" [ref=e163]:
                                        - strong [ref=e166]: 17%
                                - generic [ref=e168]:
                                    - generic [ref=e169]: 17% concentrate · EDP
                                    - link "$45.23 / 50 ml" [ref=e170] [cursor=pointer]:
                                        - /url: /costing?formula=brief-classic-chypre
                            - paragraph [ref=e171]: 10.0 g concentrate @ 17% → 48.8 g diluent
                    - article [ref=e172]:
                        - heading "Family character" [level=3] [ref=e173]
                        - generic [ref=e174]:
                            - application [ref=e178]:
                                - generic [ref=e194]:
                                    - generic [ref=e195]: Floral
                                    - generic [ref=e197]: Fresh
                                    - generic [ref=e199]: Woody
                                    - generic [ref=e201]: Amber
                            - group "Family filters" [ref=e209]:
                                - button "Floral 38%" [ref=e210] [cursor=pointer]
                                - button "Fresh 30%" [ref=e212] [cursor=pointer]
                                - button "Woody 22%" [ref=e214] [cursor=pointer]
                                - button "Amber 10%" [ref=e216] [cursor=pointer]
                    - article [ref=e218]:
                        - heading "IFRA, EU label & allergens" [level=3] [ref=e219]
                        - generic [ref=e220]:
                            - generic [ref=e223]:
                                - strong [ref=e224]: IFRA status
                                - paragraph [ref=e225]: Non-compliant · Category 4 — Fine fragrance
                            - paragraph [ref=e226]: Category 4 is the fine-fragrance limit, checked on the finished juice. EU label declaration is a separate leave-on 0.001% threshold. Annex III hits are a curated subset, not a full CPNP file.
                            - generic [ref=e227]:
                                - heading "EU label declaration" [level=4] [ref=e228]
                                - paragraph [ref=e229]: Leave-on threshold 0.001% of concentrate (Reg. 1223/2009 practice).
                                - list [ref=e230]:
                                    - listitem [ref=e231]: Citronellol
                                    - listitem [ref=e232]: Eugenol
                                    - listitem [ref=e233]: Farnesol
                                    - listitem [ref=e234]: Geraniol
                                    - listitem [ref=e235]: Limonene
                                    - listitem [ref=e236]: Linalool
                                    - listitem [ref=e237]: Evernia Prunastri Extract
                            - paragraph [ref=e238]: No curated Annex III hits on these CAS numbers.
                            - list [ref=e239]:
                                - listitem [ref=e240]:
                                    - generic [ref=e241]: Jasmine Absolute
                                    - emphasis [ref=e242]: 3.06% / 0.6%
                                - listitem [ref=e243]:
                                    - generic [ref=e244]: Oakmoss Absolute
                                    - emphasis [ref=e245]: 2.04% / 0.1%
                            - link "Browse materials & limits" [ref=e246] [cursor=pointer]:
                                - /url: /catalog
                - generic [ref=e247]:
                    - generic [ref=e248]:
                        - heading "All materials in this formula" [level=3] [ref=e249]
                        - generic [ref=e250]:
                            - generic [ref=e251]:
                                - 'button "Sort by: Date added" [ref=e252] [cursor=pointer]':
                                    - generic [ref=e259]: Date added
                                - button "Family" [ref=e260] [cursor=pointer]
                            - group "Display units" [ref=e265]:
                                - button "%" [ref=e266] [cursor=pointer]
                                - button "PPT" [ref=e267] [cursor=pointer]
                                - button "g" [ref=e268] [cursor=pointer]
                    - list [ref=e269]:
                        - listitem [ref=e270]:
                            - list [ref=e271]:
                                - listitem [ref=e272]:
                                    - generic [ref=e273]:
                                        - checkbox "Select line" [ref=e275] [cursor=pointer]
                                        - link "Bergamot EO Top 30.0% $0.36" [ref=e276] [cursor=pointer]:
                                            - /url: /catalog/bergamot-eo-firmenich
                                            - generic [ref=e277]: Bergamot EO
                                            - generic [ref=e278]: Top
                                            - generic [ref=e279]:
                                                - emphasis [ref=e280]: 30.0%
                                                - generic [ref=e281]: $0.36
                                - listitem [ref=e282]:
                                    - generic [ref=e283]:
                                        - checkbox "Select line" [ref=e285] [cursor=pointer]
                                        - link "Rose Absolute Heart 20.0% $17.00" [ref=e286] [cursor=pointer]:
                                            - /url: /catalog/rose-absolute-symrise
                                            - generic [ref=e287]: Rose Absolute
                                            - generic [ref=e288]: Heart
                                            - generic [ref=e289]:
                                                - emphasis [ref=e290]: 20.0%
                                                - generic [ref=e291]: $17.00
                                - listitem [ref=e292]:
                                    - generic [ref=e293]:
                                        - checkbox "Select line" [ref=e295] [cursor=pointer]
                                        - link "Jasmine Absolute Heart 18.0% $21.60" [ref=e296] [cursor=pointer]:
                                            - /url: /catalog/jasmine-absolute-iff
                                            - generic [ref=e297]: Jasmine Absolute
                                            - generic [ref=e298]: Heart
                                            - generic [ref=e299]:
                                                - emphasis [ref=e300]: 18.0%
                                                - generic [ref=e301]: $21.60
                                - listitem [ref=e302]:
                                    - generic [ref=e303]:
                                        - checkbox "Select line" [ref=e305] [cursor=pointer]
                                        - link "Oakmoss Absolute Base 12.0% $2.88" [ref=e306] [cursor=pointer]:
                                            - /url: /catalog/oakmoss-absolute-synarome
                                            - generic [ref=e307]: Oakmoss Absolute
                                            - generic [ref=e308]: Base
                                            - generic [ref=e309]:
                                                - emphasis [ref=e310]: 12.0%
                                                - generic [ref=e311]: $2.88
                                - listitem [ref=e312]:
                                    - generic [ref=e313]:
                                        - checkbox "Select line" [ref=e315] [cursor=pointer]
                                        - link "Patchouli EO Base 10.0% $0.22" [ref=e316] [cursor=pointer]:
                                            - /url: /catalog/patchouli-eo-iff
                                            - generic [ref=e317]: Patchouli EO
                                            - generic [ref=e318]: Base
                                            - generic [ref=e319]:
                                                - emphasis [ref=e320]: 10.0%
                                                - generic [ref=e321]: $0.22
                                - listitem [ref=e322]:
                                    - generic [ref=e323]:
                                        - checkbox "Select line" [ref=e325] [cursor=pointer]
                                        - link "Labdanum Absolute Base 10.0% $1.60" [ref=e326] [cursor=pointer]:
                                            - /url: /catalog/labdanum-absolute-synarome
                                            - generic [ref=e327]: Labdanum Absolute
                                            - generic [ref=e328]: Base
                                            - generic [ref=e329]:
                                                - emphasis [ref=e330]: 10.0%
                                                - generic [ref=e331]: $1.60
                                - listitem [ref=e332]:
                                    - generic [ref=e333]:
                                        - checkbox "Select line" [ref=e335] [cursor=pointer]
                                        - link "Hedione Heart 0.0% $0.00" [ref=e336] [cursor=pointer]:
                                            - /url: /catalog/hedione-firmenich
                                            - generic [ref=e337]: Hedione
                                            - generic [ref=e338]: Heart
                                            - generic [ref=e339]:
                                                - emphasis [ref=e340]: 0.0%
                                                - generic [ref=e341]: $0.00
                - generic [ref=e342]:
                    - link "Edit in workbench" [ref=e343] [cursor=pointer]:
                        - /url: /workbench?formula=brief-classic-chypre
                    - link "Cost this juice" [ref=e344] [cursor=pointer]:
                        - /url: /costing?formula=brief-classic-chypre
                    - link "Evaluate" [ref=e345] [cursor=pointer]:
                        - /url: /evaluation?formula=brief-classic-chypre&eval=c6909d76-2a41-491b-947d-0ecce14b771b
                    - link "Weigh" [ref=e346] [cursor=pointer]:
                        - /url: /weighing?formula=brief-classic-chypre
```

# Test source

```ts
  698 |     expect(bergamot).toBeTruthy();
  699 |     const createdRes = await page.request.post(`${API}/formulas`, {
  700 |       headers,
  701 |       data: {
  702 |         name: `__smoke zero weigh ${Date.now()}`,
  703 |         status: 'draft',
  704 |         concentrationPct: 17,
  705 |         batchTargetGrams: 5,
  706 |         lines: [
  707 |           { materialId: bergamot!.id, percent: 40, weighedGrams: 0, pyramidNote: 'top' },
  708 |           { materialId: bergamot!.id, percent: 60, weighedGrams: 0, pyramidNote: 'middle' },
  709 |         ],
  710 |       },
  711 |     });
  712 |     expect(createdRes.ok()).toBeTruthy();
  713 |     const formula = (await createdRes.json()) as { id: string; slug?: string | null };
  714 |     try {
  715 |       await page.goto(`/weighing?formula=${formula.slug ?? formula.id}`);
  716 |       await expect(page.getByTestId('weigh-current')).toBeVisible({ timeout: 15_000 });
  717 |       await expect(page.getByTestId('weigh-current')).not.toHaveText(/batch poured|lot turnat/i);
  718 |       await expect(page.getByTestId('weigh-target')).toHaveText('2.000 g');
  719 |       await expect(page.getByTestId('weigh-batch')).toBeEnabled();
  720 |       await page
  721 |         .getByRole('button', { name: /bergamot/i })
  722 |         .nth(1)
  723 |         .click();
  724 |       await expect(page.getByTestId('weigh-target')).toHaveText('3.000 g');
  725 |       await page
  726 |         .getByRole('button', { name: /about adjusting the rest|despre ajustarea restului/i })
  727 |         .click();
  728 |       await expect(page.getByRole('tooltip')).toBeVisible();
  729 |     } finally {
  730 |       await deleteSmokeFormula(page, formula.id);
  731 |     }
  732 |   });
  733 |
  734 |   test('live weighing stays usable on phone, tablet, and desktop', async ({ page }) => {
  735 |     test.setTimeout(60_000);
  736 |     await loginAlice(page);
  737 |     const formula = await provisionSmokeFormula(page);
  738 |     try {
  739 |       await page.goto(`/weighing?formula=${formula.slug ?? formula.id}`);
  740 |       await expect(page.getByTestId('weigh-accept')).toBeVisible({ timeout: 15_000 });
  741 |       await page.getByRole('button', { name: /mock scale|cântar mock/i }).click();
  742 |       await expect(page.getByTestId('weigh-pour')).toBeVisible();
  743 |
  744 |       for (const viewport of [
  745 |         { width: 390, height: 844 },
  746 |         { width: 768, height: 1024 },
  747 |         { width: 1280, height: 800 },
  748 |       ]) {
  749 |         await page.setViewportSize(viewport);
  750 |         const noOverflow = await page.evaluate(
  751 |           () => document.documentElement.scrollWidth <= window.innerWidth + 2,
  752 |         );
  753 |         expect(noOverflow).toBe(true);
  754 |
  755 |         for (const testId of ['weigh-pour', 'weigh-accept']) {
  756 |           const control = page.getByTestId(testId);
  757 |           await control.scrollIntoViewIfNeeded();
  758 |           const box = await control.boundingBox();
  759 |           expect(box).toBeTruthy();
  760 |           const hit = await page.evaluate(
  761 |             ({ x, y }) =>
  762 |               document
  763 |                 .elementFromPoint(x, y)
  764 |                 ?.closest('[data-testid]')
  765 |                 ?.getAttribute('data-testid'),
  766 |             { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  767 |           );
  768 |           expect(hit).toBe(testId);
  769 |         }
  770 |
  771 |         const current = await page.getByTestId('weigh-current').boundingBox();
  772 |         const steps = await page.getByTestId('weigh-steps').boundingBox();
  773 |         expect(current && steps).toBeTruthy();
  774 |         const overlaps =
  775 |           current!.x < steps!.x + steps!.width &&
  776 |           current!.x + current!.width > steps!.x &&
  777 |           current!.y < steps!.y + steps!.height &&
  778 |           current!.y + current!.height > steps!.y;
  779 |         expect(overlaps).toBe(false);
  780 |       }
  781 |     } finally {
  782 |       await deleteSmokeFormula(page, formula.id);
  783 |     }
  784 |   });
  785 |
  786 |   test('mobile drawer at 390px', async ({ page }) => {
  787 |     await page.setViewportSize({ width: 390, height: 844 });
  788 |     await loginAlice(page);
  789 |     await expect
  790 |       .poll(async () =>
  791 |         page.evaluate(
  792 |           () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  793 |         ),
  794 |       )
  795 |       .toBeTruthy();
  796 |
  797 |     // Theme / language live in the drawer, not the top bar.
> 798 |     await expect(page.getByRole('switch')).toHaveCount(0);
      |                                            ^ Error: expect(locator).toHaveCount(expected) failed
  799 |     await expect(
  800 |       page.getByRole('button', { name: /english|français|română|deutsch|español|italiano/i }),
  801 |     ).toHaveCount(0);
  802 |
  803 |     await page.getByRole('button', { name: /menu/i }).click();
  804 |     await expect(page.locator('#app-nav-drawer')).toBeVisible();
  805 |     await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  806 |     await expect(page.locator('#app-nav-drawer').getByRole('switch')).toBeVisible();
  807 |     await expect(
  808 |       page.locator('#app-nav-drawer').getByRole('button', {
  809 |         name: /english|français|română|deutsch|español|italiano/i,
  810 |       }),
  811 |     ).toBeVisible();
  812 |   });
  813 | });
  814 |
```
