# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary users, both formulating perfume themselves rather than commissioning it:

- **The indie perfumer launching a brand.** Works from a home or small rented lab, sells or intends to sell. Needs IFRA compliance evidence and a defensible cost per bottle before a product can legally and profitably ship.
- **The advanced enthusiast.** Formulates for themselves, keeps notes in spreadsheets, and has outgrown them: versions get lost, dilutions get recalculated by hand, allergen totals are guessed.

Secondary, confirmed in code but not the landing page's lead audience: **raw material suppliers** (regional directory, sponsored listings on Enterprise) and **lab admins** (admin zone for users, plans, quotas).

Shared situation: they work at a bench, with a scale, in sessions that get interrupted. They handle quantities where 0.0003 g matters and where a scale cannot weigh what the formula asks for.

## Product Purpose

One place to take a fragrance from idea to bottle, where every number is computed rather than remembered: composition, dilution, IFRA compliance, weighing, cost, maceration, and evaluation.

Success means a user can answer three questions about their own formula without leaving the app or opening a spreadsheet: is this compliant for its product category, what does a bottle cost, and what did it smell like at T+24h.

## Positioning

The calculation engine (`packages/formula-engine`) is pure TypeScript imported identically into the browser and into NestJS, so the number a user sees while adjusting a drop is the same number the server writes into the compliance report. A competitor with a server-side calculator cannot truthfully claim the instant-feedback half; one with a client-side calculator cannot truthfully claim the authoritative half.

Two mechanisms neighboring products do not have:

- **Automatic dilution below scale resolution.** When a target mass falls under the scale's threshold, the engine converts the pure material to a standard dilution and subtracts the solvent from the fill, instead of asking the user to weigh something their scale cannot read.
- **Allergen aggregation across sources.** Linalool arriving from bergamot, from lemon, and from the pure isolate is summed into one declared total, which is what a compliance check actually requires.

## Operating Context

- Bench work with a connected scale: Web Serial and Web Bluetooth on desktop and Android, Capacitor BLE on iOS (`packages/scale-bridge`).
- Sequential weighing, ingredient by ingredient, with automatic re-balancing when a pour overshoots: unpoured lines rescale proportionally.
- Batch scaling from 5 g to 100 kg; final concentrations for EDT, EDP, and Extrait.
- Maceration is measured in days, not minutes: timers at day 1, 7, 14, 30, with organoleptic sheets at T+0, T+30min, T+4h, T+24h.
- IFRA work spans 12 product categories, with peroxide warnings on citrus and phototoxicity flags.
- Costing at three levels: concentrate, diluted juice, packaged unit, with a volume slider producing COGS, wholesale, RRP, and margin.
- Six interface languages: en, ro, fr, it, es, de.

## Capabilities and Constraints

Shipped and verifiable in code: olfactory catalog with CAS and IUPAC and full-text search, formulation matrix with JSONB version history, IFRA engine, live weighing, costing and forecast, inventory with expiry and physical location, evaluation notebook, perfume encyclopedia, regional supplier directory, PDF and XLSX export through BullMQ, plans with per-plan features and quotas.

Constraints that bind the landing page:

- **No server-side rendering.** `apps/web` is a Vite SPA, so SEO is static markup in `index.html` plus runtime JSON-LD, not prerendered HTML.
- **Only `/health` and `/auth/*` are public** on the API. A public page must not depend on an authenticated endpoint.
- **No pricing exists anywhere in the product.** `core.plans` has no price column and billing is an explicit stub (`enabled: false`). Plans may be compared by feature and quota, never by price.
- **No `pgvector` on the server**, so search is `tsvector` plus `pg_trgm`, never embeddings. Do not claim semantic or AI search.
- Per-user isolation is enforced by PostgreSQL row-level security with a non-`BYPASSRLS` runtime role, proven by a test that user A cannot read user B's rows.
- Real IFRA standard data is not redistributable and is not committed; it is imported by the operator. The app ships a demo set. Place the IFRA 51st Amendment overview Excel at `data/ifra/standards.xlsx` (gitignored) and run `pnpm --filter @fc/api data:import-ifra`. Limits match existing catalog rows by CAS and never insert duplicate materials. Optional CAS/IUPAC fill-nulls: `pnpm --filter @fc/api data:enrich-cas -- --dry-run`. Operator notes: `apps/api/src/database/data/ifra-operator.md`.
- EU cosmetics labeling is a **separate** engine from IFRA category limits. The shipped allergen list is the original Annex III fragrance 26 (leave-on 0.001% / rinse-off 0.01%). Annex III restriction checks are a **curated fragrance subset**, not complete Annex III, SCCS, or CPNP/PIF coverage. Do not claim otherwise.

## Brand Commitments

- Name: **Fragrance Chemistry**. Tagline in use: "Formulation lab" / "Laborator de formulare".
- Incumbent visual world in `apps/web/src/styles/tokens.css` is design authority: deep ink grounds, teal accent, amber warning, Fraunces display over Source Sans 3 body, dark and light themes both shipped and switchable.
- Every user-facing string goes through i18n in all six locales. No hardcoded copy.
- Public repository, MIT licensed. No secrets, no server host, no credentials in any committed file.

## Evidence on Hand

Real, usable on a public page:

- **566 raw materials** in `apps/api/src/database/data/materials-catalog.json`, each with CAS number, olfactory family, pyramid note, manufacturer, and cost per gram.
- **9 olfactory families**: Amber, Animalic, Floral, Fresh, Gourmand, Green, Oriental, Special, Woody.
- **12 IFRA product categories**, 6 interface languages.
- A working calculation engine that can run in the page itself, with tests.
- Product visuals already built and real: pyramid, notes radar, family polar ring, compliance panel, scale readout.

Absences that must not be filled with invention:

- **No customers, no testimonials, no case studies, no press, no benchmarks, no user counts.** The product is in **private beta**; the page may say so plainly and may offer early access.
- No prices, no plan costs, no trial lengths.
- No awards, no certifications, no third-party audits. IFRA is a standard the product checks against, not an endorsement of the product.
- No launch date commitment.

## Product Principles

1. **Compute, never recall.** Any number a perfumer would otherwise keep in their head or a spreadsheet is derived by the engine and shown where the decision is made.
2. **One engine, two runtimes.** The browser and the server agree because they import the same functions; a discrepancy is a bug, not a rounding difference.
3. **The bench sets the constraints.** Scale resolution, interrupted sessions, gloved hands, and maceration timescales dictate the interface, not the other way around.
4. **Compliance is a gate, not a report.** When a formula exceeds a standard, the product blocks the label rather than printing a warning nobody reads.
5. **A user's formulas are theirs.** Isolation is enforced at the database, not in application code.

## Accessibility & Inclusion

- Bench use with a scale means high-contrast readouts and touch targets that survive gloves: the existing `--fc-touch-min` is 44px and applies to the whole product.
- Both dark and light themes are first-class and user-switchable; neither may be treated as the only supported rendition.
- Six locales, so every layout must survive text expansion, German compounds included.
- Target standard: WCAG 2.2 AA, keyboard-first, visible focus, reduced-motion respected.
