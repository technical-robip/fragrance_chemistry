import {
  planCasEnrichment,
  type CatalogIdentity,
  type CasEnrichPlanRow,
  type ChemistryLookup,
  type MaterialAlias,
} from '@fc/shared';

export async function lookupPubChem(
  name: string,
): Promise<{ casNumber?: string; iupac?: string } | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/IUPACName,MolecularFormula/JSON`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      PropertyTable?: { Properties?: Array<{ IUPACName?: string }> };
    };
    const iupac = body.PropertyTable?.Properties?.[0]?.IUPACName;
    return iupac ? { iupac } : null;
  } catch {
    return null;
  }
}

export function planCatalogCasEnrichment(
  catalog: CatalogIdentity[],
  aliases: MaterialAlias[],
  lookup?: ChemistryLookup,
): Promise<CasEnrichPlanRow[]> {
  return planCasEnrichment(catalog, aliases, lookup);
}
