# IFRA Excel (operator only)

IFRA Standards are not redistributable. This repository ships a **demo** category-4 set and never invents `max_percent` from informal web pages.

## Import

1. Obtain the IFRA 51st Amendment **Standards Overview** (PDF or Excel) from IFRA (operator licence).
2. Place it at repo-root `data/ifra/standards.pdf` or `data/ifra/standards.xlsx` (gitignored) or set `IFRA_IMPORT_PATH`.
3. Run:

```bash
pnpm --filter @fc/api data:import-ifra
# dry-run first:
pnpm --filter @fc/api data:import-ifra -- --dry-run
```

The import stores the standard (type, risk, notes, synonyms, 18 category limits) and links every catalog row that shares a CAS or an exact normalized name. Standards with no catalog row, including prohibitions, are inserted as reference materials. Re-running the import updates those rows in place.

Optional null-CAS fill (merge, never insert):

```bash
pnpm --filter @fc/api data:enrich-cas -- --dry-run
```

## EU Cosmetics Regulation (separate path)

IFRA category limits are not EU label rules. Curated public lists:

- `eu-label-allergens.json` — Annex III fragrance allergens with leave-on **0.001%** / rinse-off **0.01%** declaration thresholds (original 26; **subset**, not the full 2023/1545 expansion).
- `eu-annex-iii-fragrance.json` — high-impact fragrance Annex III entries (bans / selected max %). **Not** a complete annex or CPNP/PIF.

The dashboard briefing returns both `ifra` and `euLabel` / `euAnnex` without overwriting IFRA semantics.
