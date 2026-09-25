import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MaterialPicker, type PickedMaterial } from '@/components/MaterialPicker';
import { MaterialAvatar } from '@/components/MaterialAvatar';
import { FcSelect } from '@/components/FcSelect';
import { api } from '@/lib/api-client';
import {
  filterInventory,
  isExpired,
  isExpiringSoon,
  isLowStock,
  paginateInventory,
  restockEstimate,
  searchInventory,
  type InventoryFilter,
} from '@/lib/inventory-utils';
import styles from './InventoryPage.module.css';

type InventoryItem = {
  id: string;
  materialId: string;
  quantityGrams: string;
  location: string | null;
  kind: string;
  minQuantityGrams: string | null;
  expiresAt: string | null;
  materialName: string;
  manufacturer: string | null;
  costPerGram: string | null;
  olfactoryFamily: string | null;
  slug: string | null;
  imageUrl: string | null;
};

type Draft = {
  material: PickedMaterial | null;
  quantityGrams: number;
  kind: 'material' | 'consumable';
  location: string;
  minQuantityGrams: number;
  expiresAt: string;
};

const emptyDraft = (): Draft => ({
  material: null,
  quantityGrams: 100,
  kind: 'material',
  location: 'Bench',
  minQuantityGrams: 25,
  expiresAt: '',
});

function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function InventoryPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as InventoryFilter | null) ?? 'all';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });

  const items = data ?? [];
  const normalized = items.map((i) => ({
    ...i,
    quantityGrams: Number(i.quantityGrams),
    minQuantityGrams: Number(i.minQuantityGrams ?? 0),
    costPerGram: i.costPerGram ? Number(i.costPerGram) : 0,
  }));
  const visible = searchInventory(filterInventory(normalized, filter), query);
  const paged = paginateInventory(visible, page);
  const events = useQuery({
    queryKey: ['inventory', editingId, 'events'],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          action: string;
          before: { quantityGrams?: string } | null;
          after: { quantityGrams?: string } | null;
          createdAt: string;
        }>
      >(`/inventory/${editingId}/events`),
    enabled: Boolean(editingId),
  });

  const lowItems = normalized.filter(isLowStock);
  const restockTotal = restockEstimate(lowItems);

  const existingForDraft = draft.material
    ? normalized.find((i) => i.materialId === draft.material!.id)
    : undefined;

  const upsert = useMutation({
    mutationFn: () => {
      if (!draft.material) throw new Error('Pick a material');
      return api.post('/inventory', {
        materialId: draft.material.id,
        quantityGrams: draft.quantityGrams,
        kind: draft.kind,
        location: draft.location || undefined,
        minQuantityGrams: draft.minQuantityGrams,
        ...(draft.expiresAt
          ? { expiresAt: draft.expiresAt }
          : existingForDraft
            ? {}
            : { expiresAt: null }),
      });
    },
    onSuccess: async () => {
      closePanel();
      await qc.invalidateQueries({ queryKey: ['inventory'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });

  const patch = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('Nothing to edit');
      return api.patch(`/inventory/${editingId}`, {
        quantityGrams: draft.quantityGrams,
        kind: draft.kind,
        location: draft.location || null,
        minQuantityGrams: draft.minQuantityGrams,
        expiresAt: draft.expiresAt || null,
      });
    },
    onSuccess: async () => {
      closePanel();
      await qc.invalidateQueries({ queryKey: ['inventory'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });

  const adjust = useMutation({
    mutationFn: ({ id, deltaGrams }: { id: string; deltaGrams: number }) =>
      api.patch(`/inventory/${id}/adjust`, { deltaGrams }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });

  const chips = useMemo(
    () =>
      [
        { id: 'all' as const, label: t('inventory.filterAll') },
        { id: 'low' as const, label: t('inventory.filterLow') },
        { id: 'material' as const, label: t('inventory.filterMaterial') },
        { id: 'consumable' as const, label: t('inventory.filterConsumable') },
        { id: 'expiring' as const, label: t('inventory.filterExpiring') },
      ] as const,
    [t],
  );

  function setFilter(next: InventoryFilter) {
    setPage(1);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === 'all') p.delete('filter');
      else p.set('filter', next);
      return p;
    });
  }

  function closePanel() {
    setDraft(emptyDraft());
    setEditingId(null);
    setPickerOpen(false);
  }

  function startAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setPickerOpen(true);
  }

  function startEdit(row: (typeof normalized)[number]) {
    setEditingId(row.id);
    setDraft({
      material: {
        id: row.materialId,
        name: row.materialName,
        manufacturer: row.manufacturer,
        olfactoryFamily: row.olfactoryFamily,
        pyramidNote: null,
        costPerGram: String(row.costPerGram),
        casNumber: null,
        imageUrl: row.imageUrl,
      },
      quantityGrams: row.quantityGrams,
      kind: row.kind === 'consumable' ? 'consumable' : 'material',
      location: row.location ?? '',
      minQuantityGrams: row.minQuantityGrams,
      expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : '',
    });
    setPickerOpen(false);
  }

  function copyRestock() {
    const text = lowItems
      .map((i) => {
        const need = Math.max(0, Number(i.minQuantityGrams) - Number(i.quantityGrams));
        return `${i.materialName}: +${need.toFixed(1)} g (min ${i.minQuantityGrams})`;
      })
      .join('\n');
    void navigator.clipboard.writeText(text || t('inventory.restockNone'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const adding = Boolean(draft.material || pickerOpen) && !editingId;
  const saving = upsert.isPending || patch.isPending;

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1 className="fc-page-title">{t('inventory.title')}</h1>
          <p className="fc-muted">{t('inventory.subtitle')}</p>
        </div>
        <button type="button" className="fc-btn fc-btn--primary" onClick={startAdd}>
          {t('inventory.addStock')}
        </button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="fc-sr-only">{t('inventory.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t('inventory.search')}
          />
        </label>
        <div className={styles.chips} role="tablist" aria-label={t('inventory.title')}>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={filter === chip.id}
              className={`${styles.chip} ${filter === chip.id ? styles.chipActive : ''}`}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {adding ? (
        <div className={`fc-card ${styles.addPanel}`}>
          <h2>{t('inventory.addStock')}</h2>
          <p className="fc-muted">
            {t('inventory.material')}:{' '}
            {draft.material ? (
              <strong>{draft.material.name}</strong>
            ) : (
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                onClick={() => setPickerOpen(true)}
              >
                {t('inventory.chooseMaterial')}
              </button>
            )}
          </p>
          {!editingId && existingForDraft ? (
            <p className="fc-muted">
              {t('inventory.onHandAdding', {
                onHand: existingForDraft.quantityGrams.toFixed(1),
                adding: draft.quantityGrams,
              })}
            </p>
          ) : null}
          <div className={styles.addGrid}>
            <label>
              {t('inventory.qty')}
              <input
                type="number"
                min={0}
                value={draft.quantityGrams}
                onChange={(e) => setDraft((d) => ({ ...d, quantityGrams: Number(e.target.value) }))}
              />
            </label>
            <label>
              {t('inventory.kind')}
              <FcSelect
                options={[
                  { value: 'material', label: t('inventory.kindMaterial') },
                  { value: 'consumable', label: t('inventory.kindConsumable') },
                ]}
                value={draft.kind}
                onChange={(v) =>
                  v && setDraft((d) => ({ ...d, kind: v as 'material' | 'consumable' }))
                }
                aria-label={t('inventory.kind')}
              />
            </label>
            <label>
              {t('inventory.location')}
              <input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              />
            </label>
            <label>
              {t('inventory.minQty')}
              <input
                type="number"
                min={0}
                value={draft.minQuantityGrams}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minQuantityGrams: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              {t('inventory.expires')}
              <input
                className={styles.control}
                type="date"
                value={draft.expiresAt}
                onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))}
              />
            </label>
          </div>
          <div className={styles.addActions}>
            <button
              type="button"
              className="fc-btn fc-btn--amber"
              disabled={!draft.material || saving}
              onClick={() => upsert.mutate()}
            >
              {saving ? t('inventory.saving') : t('inventory.saveStock')}
            </button>
            <button type="button" className="fc-btn fc-btn--ghost" onClick={closePanel}>
              {t('inventory.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? <p className="fc-muted">{t('inventory.loading')}</p> : null}
      {isError ? <p className="fc-muted">{t('inventory.error')}</p> : null}

      <div className={`fc-table-wrap ${styles.wrap}`}>
        <table className="fc-table">
          <thead>
            <tr>
              <th>{t('inventory.material')}</th>
              <th>{t('inventory.kind')}</th>
              <th>{t('inventory.qty')}</th>
              <th>{t('inventory.minQty')}</th>
              <th>{t('inventory.costPerGram')}</th>
              <th>{t('inventory.location')}</th>
              <th>{t('inventory.expires')}</th>
              <th>{t('inventory.status')}</th>
              <th>{t('inventory.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paged.items.map((row) => {
              const low = isLowStock(row);
              const expired = isExpired(row);
              const expiring = isExpiringSoon(row);
              const editing = editingId === row.id;
              const name = (
                <div className={styles.materialCell}>
                  <MaterialAvatar
                    name={row.materialName}
                    family={row.olfactoryFamily}
                    imageUrl={row.imageUrl}
                    size={32}
                  />
                  <div>
                    <strong>{row.materialName}</strong>
                    {row.manufacturer ? (
                      <span className={styles.sub}>{row.manufacturer}</span>
                    ) : null}
                  </div>
                </div>
              );
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      {row.slug ? (
                        <Link to={`/catalog/${row.slug}`} className={styles.materialLink}>
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </td>
                    <td>
                      {row.kind === 'consumable'
                        ? t('inventory.kindConsumable')
                        : t('inventory.kindMaterial')}
                    </td>
                    <td className={low ? styles.low : undefined}>{row.quantityGrams.toFixed(1)}</td>
                    <td>{row.minQuantityGrams.toFixed(1)}</td>
                    <td>{formatMoney(row.costPerGram)}</td>
                    <td>{row.location ?? '—'}</td>
                    <td>{formatDate(row.expiresAt)}</td>
                    <td>
                      <span className={styles.badges}>
                        {expired ? (
                          <span className={styles.lightExpired}>{t('inventory.badgeExpired')}</span>
                        ) : null}
                        {expiring ? (
                          <span className={styles.lightSoon}>{t('inventory.badgeExpiring')}</span>
                        ) : null}
                        {!expired && !expiring && row.expiresAt ? (
                          <span className={styles.lightOk}>{t('inventory.badgeOk')}</span>
                        ) : null}
                        {low ? (
                          <span className={styles.badgeLow}>{t('inventory.badgeLow')}</span>
                        ) : null}
                        {!low && !expired && !expiring && !row.expiresAt ? '—' : null}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className="fc-btn fc-btn--ghost"
                          aria-label={t('inventory.decrease')}
                          onClick={() => adjust.mutate({ id: row.id, deltaGrams: -10 })}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="fc-btn fc-btn--ghost"
                          aria-label={t('inventory.increase')}
                          onClick={() => adjust.mutate({ id: row.id, deltaGrams: 10 })}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="fc-btn fc-btn--ghost"
                          onClick={() => startEdit(row)}
                        >
                          {t('inventory.edit')}
                        </button>
                        <button
                          type="button"
                          className="fc-btn fc-btn--ghost"
                          onClick={() => {
                            if (
                              window.confirm(
                                t('inventory.deleteConfirm', { name: row.materialName }),
                              )
                            ) {
                              remove.mutate(row.id);
                            }
                          }}
                        >
                          {t('inventory.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editing ? (
                    <tr>
                      <td colSpan={9}>
                        <div className={styles.addGrid}>
                          <label>
                            {t('inventory.qty')}
                            <input
                              className={styles.control}
                              type="number"
                              min={0}
                              value={draft.quantityGrams}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, quantityGrams: Number(e.target.value) }))
                              }
                            />
                          </label>
                          <label>
                            {t('inventory.kind')}
                            <FcSelect
                              options={[
                                { value: 'material', label: t('inventory.kindMaterial') },
                                { value: 'consumable', label: t('inventory.kindConsumable') },
                              ]}
                              value={draft.kind}
                              onChange={(v) =>
                                v &&
                                setDraft((d) => ({ ...d, kind: v as 'material' | 'consumable' }))
                              }
                              aria-label={t('inventory.kind')}
                            />
                          </label>
                          <label>
                            {t('inventory.location')}
                            <input
                              className={styles.control}
                              value={draft.location}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, location: e.target.value }))
                              }
                            />
                          </label>
                          <label>
                            {t('inventory.minQty')}
                            <input
                              className={styles.control}
                              type="number"
                              min={0}
                              value={draft.minQuantityGrams}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  minQuantityGrams: Number(e.target.value),
                                }))
                              }
                            />
                          </label>
                          <label>
                            {t('inventory.expires')}
                            <input
                              className={styles.control}
                              type="date"
                              value={draft.expiresAt}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, expiresAt: e.target.value }))
                              }
                            />
                          </label>
                        </div>
                        <div className={styles.addActions}>
                          <button
                            type="button"
                            className="fc-btn fc-btn--amber"
                            disabled={saving}
                            onClick={() => patch.mutate()}
                          >
                            {saving ? t('inventory.saving') : t('inventory.saveStock')}
                          </button>
                          <button
                            type="button"
                            className="fc-btn fc-btn--ghost"
                            onClick={closePanel}
                          >
                            {t('inventory.cancel')}
                          </button>
                        </div>
                        <div className={styles.history}>
                          <strong>{t('inventory.history')}</strong>
                          <ul className={styles.historyList}>
                            {(events.data ?? []).map((event) => (
                              <li key={event.id}>
                                {formatDate(event.createdAt)} ·{' '}
                                {t(
                                  `inventory.event${event.action[0]?.toUpperCase()}${event.action.slice(1)}`,
                                )}
                                {event.after?.quantityGrams
                                  ? ` · ${Number(event.after.quantityGrams).toFixed(1)} g`
                                  : ''}
                              </li>
                            ))}
                            {!events.isLoading && (events.data ?? []).length === 0 ? (
                              <li>{t('inventory.historyEmpty')}</li>
                            ) : null}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!isLoading && visible.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  {items.length === 0 ? t('inventory.empty') : t('inventory.emptyFilter')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {paged.pages > 1 ? (
          <nav className={styles.pager} aria-label={t('inventory.title')}>
            <button
              type="button"
              className="fc-btn fc-btn--ghost"
              disabled={paged.page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('inventory.pagePrev')}
            </button>
            <span>{t('inventory.pageOf', { page: paged.page, pages: paged.pages })}</span>
            <button
              type="button"
              className="fc-btn fc-btn--ghost"
              disabled={paged.page >= paged.pages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('inventory.pageNext')}
            </button>
          </nav>
        ) : null}
      </div>

      <aside className={`fc-card ${styles.restock}`}>
        <h2>{t('inventory.restockTitle')}</h2>
        <p className="fc-muted">
          {t('inventory.restockSummary', {
            count: lowItems.length,
            amount: formatMoney(restockTotal),
          })}
        </p>
        <ul>
          {lowItems.map((i) => (
            <li key={i.id}>
              {t('inventory.restockNeed', {
                name: i.materialName,
                grams: Math.max(0, Number(i.minQuantityGrams) - Number(i.quantityGrams)).toFixed(1),
              })}
            </li>
          ))}
          {lowItems.length === 0 ? <li>{t('inventory.restockNone')}</li> : null}
        </ul>
        <button type="button" className="fc-btn fc-btn--amber" onClick={copyRestock}>
          {copied ? t('inventory.copied') : t('inventory.copyList')}
        </button>
      </aside>

      <MaterialPicker
        open={pickerOpen && !draft.material}
        onClose={() => setPickerOpen(false)}
        onPick={(material) => {
          const existing = normalized.find((i) => i.materialId === material.id);
          setDraft((d) => ({
            ...d,
            material,
            ...(existing
              ? {
                  kind: existing.kind === 'consumable' ? 'consumable' : 'material',
                  location: existing.location ?? d.location,
                  minQuantityGrams: existing.minQuantityGrams,
                  expiresAt: existing.expiresAt ? existing.expiresAt.slice(0, 10) : '',
                }
              : {}),
          }));
          setPickerOpen(true);
        }}
        title={t('inventory.pickTitle')}
      />
    </div>
  );
}
