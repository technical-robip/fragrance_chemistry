---
version: 1
slug: 'src-pages-landing-landingpage-tsx'
primary_target: 'src/pages/landing/LandingPage.tsx'
related_targets: []
---

## Scope

The public landing surface at `/` for unauthenticated visitors. Visitor mode: Persuade. Authenticated users keep the dashboard at the same route.

## Audience and job

Indie perfumers launching a brand and advanced enthusiasts outgrowing spreadsheets. Job: decide whether this lab can take their own formula from idea to bottle with every number computed. Action: create a free account. Private beta is stated plainly; early access is the honest CTA.

## Proof and content

No customers, testimonials, benchmarks, user counts, or prices exist; none may be invented. Proof is the product itself: 566 real catalog materials with CAS and cost per gram, 9 olfactory families, 12 IFRA categories, 6 locales, and the real `@fc/formula-engine` running in the page so the visitor changes a formula and watches the numbers move.

## Constraints

Vite SPA, no SSR. No authenticated API call from this page. Identity is pinned to `tokens.css`; both dark and light ship. All copy through i18n in six locales. WCAG 2.2 AA, 44px targets, reduced motion respected.

## Direction contract

THESIS: A lab reference manual where the computed layer is a physical sheet lying over the raw material, so the product's one idea, every number is derived rather than remembered, is the page's construction and not a claim in it. It refuses the marketing-page arrangement this category ships: stacked full-bleed bands of centered headline over a screenshot, and the row of equal icon-heading-text cards standing in for capability.

OWN-WORLD: Deep ink section boards, one hue at full strength per workflow division, taken only from the committed palette: teal for composition, note-green for the catalog, amber for compliance, note-violet for maceration and evaluation, danger red reserved for the errata slip. Over each board sits a milk-acetate leaf, a translucent sheet with two punch holes at its bound edge, a visible cut edge, and one short hard shadow along that cut side; the leaf carries computed values and nothing else. Fraunces sets the display voice hanging in the fifth margin column of a four-column grid; Source Sans 3 sets body at a 62-character measure; measured quantities only are set in tabular system mono. A stepped tab rail runs down the fore edge, one tab per division, height proportional to what the division contains, and the current tab extends until it is the board. Elevation is declared once: the leaf owns the shadow, boards carry none.

STORY: The visitor understands within one viewport that this is a working formulation lab, not a note-taking app, because the first thing they see is a real formula with its computed sheet lying over it. They come to believe the numbers are trustworthy because they move the formula themselves and the totals, pyramid, and compliance state recompute in front of them from the same engine the server uses. They create a free account.

FIRST VIEWPORT: Full-bleed ink board. Punch holes and a rotated spine label at the extreme left margin. The headline sets in Fraunces at display scale across the four columns' left two, hanging from the fifth margin column, with the one-line subhead and the primary action, Start free, directly beneath it at body scale; a quiet secondary action sits beside it and the private-beta line sits under both. The right two columns carry the acetate leaf over a real formula: ingredient lines on the board beneath, computed mass, percentage, and the compliance state on the clear sheet above, with the unweighed remainder drawn as ghost cells rather than left blank. The tab rail is visible down the right edge from the first pixel, six tabs, the first extended. No eyebrow, no kicker, no gradient text.

FORM: The boxed-software reference manual lying open at a tabbed section, with punched acetate leaves hinged over a coloured divider board and a stepped tab rail down the fore edge. Catalog challenger `rw-manual-acetate-tab-board`, fused and judged the winner against the three dealt grounded structures on both audience identification and product clarity; the dealt lead was the specimen catalog and the formula sheet topped the unrolled list. Seed key `9a48d04a`, surface scope, persuade mode, code-led. Three raises, each named for its donor: from `reefs-bioluminescent-nocturnal-chromatophore-skin-language`, compliance state recolours the surface of the line it describes instead of appearing as a badge beside it; from `medium-native-ebru-floated-pigment`, changing one line visibly displaces its neighbours rather than updating in isolation; from `signals-instruments-seven-segment-alarm-clock`, absence is drawn as deliberately as presence, so unweighed and untargeted values ship as ghost cells.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Signature interaction and motion grammar

One orchestrated moment, not scattered effects: the hinge. Every state change is a two-frame `steps(2)` step of 90ms pivoting at the punched edge, and nothing eases or fades anywhere on the page. Tab changes hinge the leaf, the interactive teaser hinges its recomputed lines, and `prefers-reduced-motion` drops to the settled frame.

## Unresolved

Canonical origin comes from `VITE_SITE_URL` with a localhost fallback; the operator sets it at deploy.
