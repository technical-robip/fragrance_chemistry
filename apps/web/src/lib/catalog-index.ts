import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { type CatalogIndexItem } from '@fc/shared';
import { api } from './api-client';
import { buildCatalogQuery } from './catalog-query';

export type PickedMaterial = {
  id: string;
  name: string;
  manufacturer: string | null;
  olfactoryFamily: string | null;
  pyramidNote: string | null;
  costPerGram: string | null;
  casNumber: string | null;
  imageUrl?: string | null;
  isPrivate?: boolean;
};

export const CATALOG_INDEX_STALE_MS = 5 * 60 * 1000;
export const CATALOG_INDEX_LIMIT = 2000;

export function catalogIndexQueryKey(includePrivate: boolean) {
  return ['catalog', 'index', includePrivate] as const;
}

export function fetchCatalogIndex(includePrivate: boolean) {
  return api.get<CatalogIndexItem[]>(
    `/catalog/materials${buildCatalogQuery({ includePrivate, limit: CATALOG_INDEX_LIMIT })}`,
  );
}

export function catalogIndexQueryOptions(includePrivate: boolean) {
  return {
    queryKey: catalogIndexQueryKey(includePrivate),
    queryFn: () => fetchCatalogIndex(includePrivate),
    staleTime: CATALOG_INDEX_STALE_MS,
  } satisfies UseQueryOptions<CatalogIndexItem[]>;
}

export function useCatalogIndex(includePrivate: boolean, enabled = true) {
  return useQuery({
    ...catalogIndexQueryOptions(includePrivate),
    enabled,
  });
}
