export type InventoryFilter = 'all' | 'low' | 'material' | 'consumable' | 'expiring';

export type InventoryLike = {
  quantityGrams: number;
  minQuantityGrams?: number | null;
  expiresAt?: string | null;
  kind?: string | null;
};

export type InventorySearchable = InventoryLike & {
  materialName?: string | null;
  manufacturer?: string | null;
  location?: string | null;
};

export function isLowStock(item: InventoryLike): boolean {
  const min = Number(item.minQuantityGrams ?? 0);
  return Number(item.quantityGrams) <= min;
}

export function isExpired(item: InventoryLike, now = Date.now()): boolean {
  if (!item.expiresAt) return false;
  const expires = new Date(item.expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return expires < now;
}

export function isExpiringSoon(item: InventoryLike, withinDays = 60, now = Date.now()): boolean {
  if (!item.expiresAt || isExpired(item, now)) return false;
  const expires = new Date(item.expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  const limit = now + withinDays * 24 * 60 * 60 * 1000;
  return expires <= limit;
}

export function filterInventory<T extends InventoryLike & { kind?: string | null }>(
  items: T[],
  filter: InventoryFilter,
): T[] {
  if (filter === 'all') return items;
  if (filter === 'low') return items.filter(isLowStock);
  if (filter === 'material') return items.filter((i) => (i.kind ?? 'material') === 'material');
  if (filter === 'consumable') return items.filter((i) => i.kind === 'consumable');
  return items.filter((i) => isExpired(i) || isExpiringSoon(i));
}

export const INVENTORY_PAGE_SIZE = 25;

export function paginateInventory<T>(items: T[], page: number, pageSize = INVENTORY_PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safe = Math.min(Math.max(1, page), pages);
  const start = (safe - 1) * pageSize;
  return { page: safe, pages, total, items: items.slice(start, start + pageSize) };
}

export function searchInventory<T extends InventorySearchable>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const hay = [item.materialName, item.manufacturer, item.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function restockEstimate(items: Array<InventoryLike & { costPerGram?: number | null }>) {
  return items.filter(isLowStock).reduce((sum, item) => {
    const need = Math.max(0, Number(item.minQuantityGrams ?? 0) - Number(item.quantityGrams));
    return sum + need * Number(item.costPerGram ?? 0);
  }, 0);
}
