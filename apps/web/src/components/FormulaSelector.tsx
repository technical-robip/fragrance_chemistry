import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { components, type GroupBase, type OptionProps } from 'react-select';
import { FcSelect, type FcSelectOption } from '@/components/FcSelect';
import { api } from '@/lib/api-client';
import { formulaOptionLabel, nextFormulaAfterDelete } from '@/lib/formula-select';
import { useFormulaStore } from '@/stores/formula-store';
import { useAuthStore } from '@/stores/auth-store';
import styles from './FormulaSelector.module.css';

export type FormulaSummary = {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  batchTargetGrams: string;
  concentrationPct: string;
  isLibraryAccord?: boolean;
};

type Props = {
  allowEmpty?: boolean;
  onCreated?: (id: string) => void;
  label?: string;
  showCreate?: boolean;
  className?: string;
};

type FormulaMenuCtx = {
  pendingId: string | null;
  busyId: string | null;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  deleteNamed: (name: string) => string;
  confirmDelete: string;
  confirmAction: string;
  cancel: string;
};

const FormulaMenuContext = createContext<FormulaMenuCtx | null>(null);

function stopMenuEvent(event: { preventDefault: () => void; stopPropagation: () => void }) {
  event.preventDefault();
  event.stopPropagation();
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 13h10l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FormulaOption(props: OptionProps<FcSelectOption, false, GroupBase<FcSelectOption>>) {
  const ctx = useContext(FormulaMenuContext);
  if (!ctx) {
    return <components.Option {...props} />;
  }
  const pending = ctx.pendingId === props.data.value;
  const busy = ctx.busyId === props.data.value;

  return (
    <components.Option {...props}>
      {pending ? (
        <div className={styles.confirmRow} onMouseDown={stopMenuEvent} onClick={stopMenuEvent}>
          <span className={styles.confirmPrompt}>{ctx.confirmDelete}</span>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.confirmYes}
              data-testid="formula-option-confirm"
              disabled={busy}
              onMouseDown={stopMenuEvent}
              onClick={(event) => {
                stopMenuEvent(event);
                ctx.onConfirmDelete(props.data.value);
              }}
            >
              {ctx.confirmAction}
            </button>
            <button
              type="button"
              className={styles.confirmNo}
              data-testid="formula-option-cancel"
              disabled={busy}
              onMouseDown={stopMenuEvent}
              onClick={(event) => {
                stopMenuEvent(event);
                ctx.onCancelDelete();
              }}
            >
              {ctx.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>{props.label}</span>
          <button
            type="button"
            className={styles.rowDelete}
            data-testid="formula-option-delete"
            aria-label={ctx.deleteNamed(props.data.name || props.label)}
            onMouseDown={stopMenuEvent}
            onClick={(event) => {
              stopMenuEvent(event);
              ctx.onAskDelete(props.data.value);
            }}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </components.Option>
  );
}

function untitledFormulaName() {
  return `Untitled formula ${new Date().toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Prefer slug in shareable / nav URLs; fall back to UUID. */
export function formulaUrlKey(f: { id: string; slug?: string | null } | null | undefined) {
  if (!f) return null;
  return f.slug || f.id;
}

export { withFormulaQuery, withLabQuery } from '@/lib/lab-query';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve URL/store key → UUID. Non-UUID slugs wait for the formulas list. */
export function resolveFormulaId(key: string | null, formulas: FormulaSummary[]): string | null {
  if (!key) return null;
  const match = formulas.find((f) => f.id === key || f.slug === key);
  if (match) return match.id;
  if (UUID_RE.test(key)) return key;
  return null;
}

export function FormulaSelector({
  allowEmpty = true,
  onCreated,
  label,
  showCreate = true,
  className,
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const activeFormulaId = useFormulaStore((s) => s.activeFormulaId);
  const setActiveFormulaId = useFormulaStore((s) => s.setActiveFormulaId);
  const fieldLabel = label ?? t('dashboard.activeFormula');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
    placeholderData: keepPreviousData,
  });

  const formulas = data ?? [];
  const queryKey = params.get('formula');
  const selectedId = useMemo(() => {
    const fromQuery = resolveFormulaId(queryKey, formulas);
    return fromQuery ?? activeFormulaId ?? formulas[0]?.id ?? null;
  }, [queryKey, activeFormulaId, formulas]);

  const selectedSummary = useMemo(
    () => formulas.find((f) => f.id === selectedId) ?? null,
    [formulas, selectedId],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (selectedId !== activeFormulaId) setActiveFormulaId(selectedId);

    const preferred = formulaUrlKey(selectedSummary) ?? selectedId;
    if (queryKey === preferred) return;
    if (isLoading && !selectedSummary) return;

    // Keep an unknown slug/id in the URL until the list catches up (e.g. after fork).
    if (
      queryKey &&
      !formulas.some((f) => f.id === queryKey || f.slug === queryKey) &&
      (isLoading || formulas.length === 0 || !UUID_RE.test(queryKey))
    ) {
      return;
    }

    setParams(
      (prev) => {
        if (prev.get('formula') === preferred) return prev;
        const next = new URLSearchParams(prev);
        next.set('formula', preferred);
        return next;
      },
      { replace: true },
    );
  }, [
    queryKey,
    selectedId,
    selectedSummary,
    activeFormulaId,
    isLoading,
    formulas,
    setActiveFormulaId,
    setParams,
  ]);

  const options = useMemo(
    () =>
      formulas.map((f) => ({
        value: f.id,
        label: formulaOptionLabel(f),
        name: f.name,
      })),
    [formulas],
  );

  function select(id: string | null) {
    if (!id) return;
    const row = formulas.find((f) => f.id === id);
    setActiveFormulaId(id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('formula', formulaUrlKey(row) ?? id);
      return next;
    });
  }

  function clearSelection() {
    setActiveFormulaId(null);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('formula');
      return next;
    });
  }

  async function createFormula() {
    const created = await api.post<{ id: string; slug?: string | null }>('/formulas', {
      name: untitledFormulaName(),
      status: 'draft',
      lines: [],
      batchTargetGrams: useAuthStore.getState().user?.defaultBatchTargetGrams,
      concentrationPct: useAuthStore.getState().user?.defaultConcentrationPct,
    });
    setActiveFormulaId(created.id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('formula', formulaUrlKey(created) ?? created.id);
      return next;
    });
    await refetch();
    onCreated?.(created.id);
  }

  async function confirmDelete(id: string) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeletingId(id);
    const nextId = nextFormulaAfterDelete(formulas, id, selectedId);
    try {
      await api.delete(`/formulas/${id}`);
      setPendingDeleteId(null);
      if (id === selectedId) {
        if (nextId) select(nextId);
        else clearSelection();
      }
      await qc.invalidateQueries({ queryKey: ['formulas'] });
      await refetch();
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  const menuCtx = useMemo<FormulaMenuCtx>(
    () => ({
      pendingId: pendingDeleteId,
      busyId: deletingId,
      onAskDelete: setPendingDeleteId,
      onCancelDelete: () => setPendingDeleteId(null),
      onConfirmDelete: (id) => void confirmDelete(id),
      deleteNamed: (name) => t('formula.deleteNamed', { name }),
      confirmDelete: t('formula.confirmDelete'),
      confirmAction: t('formula.confirmAction'),
      cancel: t('formula.cancel'),
    }),
    [pendingDeleteId, deletingId, t, formulas, selectedId],
  );

  return (
    <div
      className={[styles.bar, className].filter(Boolean).join(' ')}
      data-testid="formula-selector"
    >
      <label className={styles.label}>
        <span>{fieldLabel}</span>
        <FormulaMenuContext.Provider value={menuCtx}>
          <FcSelect
            options={
              allowEmpty && formulas.length === 0
                ? [{ value: '', label: t('common.loading'), isDisabled: true, name: '' }]
                : options
            }
            value={selectedId}
            onChange={(id) => {
              setPendingDeleteId(null);
              select(id);
            }}
            isSearchable
            isDisabled={isLoading || formulas.length === 0}
            placeholder={t('formula.searchPlaceholder')}
            noOptionsMessage={() => t('formula.noMatches')}
            aria-label={fieldLabel}
            inputId="active-formula-select"
            platform="web"
            closeMenuOnSelect
            onMenuClose={() => setPendingDeleteId(null)}
            components={{ Option: FormulaOption }}
          />
        </FormulaMenuContext.Provider>
      </label>
      {showCreate ? (
        <button
          type="button"
          className="fc-btn fc-btn--primary"
          onClick={() => void createFormula()}
        >
          + New
        </button>
      ) : null}
    </div>
  );
}

/** Resolved UUID for API calls (costing, evaluations, mutations). */
export function useSelectedFormulaId() {
  const [params] = useSearchParams();
  const activeFormulaId = useFormulaStore((s) => s.activeFormulaId);
  const { data } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
  });
  const formulas = data ?? [];
  const key = params.get('formula') ?? activeFormulaId ?? formulas[0]?.id ?? null;
  return resolveFormulaId(key, formulas);
}

/**
 * Slug or UUID from the URL — safe for `GET /formulas/:idOrSlug` before the list resolves.
 */
export function useSelectedFormulaRouteKey() {
  const [params] = useSearchParams();
  const activeFormulaId = useFormulaStore((s) => s.activeFormulaId);
  const { data } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
  });
  const formulas = data ?? [];
  return (
    params.get('formula') ??
    formulaUrlKey(formulas.find((f) => f.id === activeFormulaId) ?? formulas[0]) ??
    activeFormulaId ??
    formulas[0]?.id ??
    null
  );
}

/** Slug (or id) suitable for `?formula=` links while navigating. */
export function useSelectedFormulaUrlKey() {
  const [params] = useSearchParams();
  const id = useSelectedFormulaId();
  const { data } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
  });
  const formulas = data ?? [];
  const row = formulas.find((f) => f.id === id);
  return params.get('formula') ?? formulaUrlKey(row) ?? id;
}
