import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  diluentGrams,
  finishedJuiceGrams,
  juiceClassFromConcentration,
  latestProbeMark,
  type EvaluationLineMarkRow,
  type JuiceClass,
} from '@fc/shared';
import { api } from '@/lib/api-client';
import { FcSelect } from '@/components/FcSelect';
import {
  FormulaSelector,
  formulaUrlKey,
  useSelectedFormulaId,
  useSelectedFormulaRouteKey,
  withLabQuery,
  type FormulaSummary,
} from '@/components/FormulaSelector';
import { FormulaExcelExportDialog } from '@/components/FormulaExcelExportDialog';
import { MaterialPicker, type PickedMaterial } from '@/components/MaterialPicker';
import { MaterialAvatar } from '@/components/MaterialAvatar';
import { DecimalCell } from '@/components/DecimalCell';
import { CssPerfumeVessel } from '@/components/viz/CssPerfumeVessel';
import { NotesRadar } from '@/components/viz/NotesRadar';
import { FragrancePyramid } from '@/components/viz/FragrancePyramid';
import { PyramidLayerSummary } from '@/components/viz/PyramidLayerSummary';
import { useFormulaStore } from '@/stores/formula-store';
import { exportFormulaCsv } from '@/lib/formula-export';
import { useCatalogIndex } from '@/lib/catalog-index';
import {
  familyIdsForPyramidLayer,
  pyramidLayerBreakdown,
  pyramidPercents,
  radarFamilyAxes,
  scaleFamilyLinePercents,
} from '@/lib/formula-viz';
import {
  concentrationAfterServerSync,
  juiceClassPresetPct,
  shouldApplyServerLines,
  shouldClearDirtyAfterSave,
} from '@/lib/workbench-draft-sync';
import styles from './WorkbenchPage.module.css';

type FormulaDetail = {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  batchTargetGrams: string;
  concentrationPct: string;
  description: string | null;
  lines: Array<{
    id?: string;
    materialId: string;
    percent: string;
    weighedGrams: string | null;
    pyramidNote: string | null;
    materialName: string;
    manufacturer: string | null;
    olfactoryFamily: string | null;
    costPerGram: string | null;
    sortOrder: number;
  }>;
};

function MenuIcon({ kind }: { kind: 'fork' | 'copy' | 'pdf' | 'csv' | 'xls' }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (kind === 'fork') {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M6 8v2a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V8" />
        <path d="M12 14v2" />
      </svg>
    );
  }
  if (kind === 'copy') {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M4 16V6a2 2 0 0 1 2-2h10" />
      </svg>
    );
  }
  if (kind === 'pdf') {
    return (
      <svg {...common}>
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
        <path d="M9 11h3" />
      </svg>
    );
  }
  if (kind === 'csv') {
    return (
      <svg {...common}>
        <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M14 4v6h6" />
        <path d="M7 14h2.5M7 17h4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 4h10l6 6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M14 4v6h6" />
      <path d="M8 14h8M8 17h5" />
    </svg>
  );
}

type InventoryRow = {
  materialId: string;
  quantityGrams: string;
  minQuantityGrams: string | null;
};

type LocalLine = {
  key: string;
  materialId: string;
  materialName: string;
  manufacturer: string | null;
  olfactoryFamily: string | null;
  pyramidNote: 'top' | 'middle' | 'base' | 'modifier' | null;
  percent: number;
  weighedGrams: number;
  costPerGram: number;
};

type AmountUnit = 'grams' | 'drops' | 'ml';
type PctMode = 'abs' | 'rel';

const DROPS_PER_ML = 20;
const ML_PER_GRAM = 1;
const BOTTLE_ML = 50;
const JUICE_DENSITY_G_PER_ML = 0.9;

function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toLocal(lines: FormulaDetail['lines']): LocalLine[] {
  return lines.map((l, idx) => ({
    key: l.id ?? `${l.materialId}-${idx}`,
    materialId: l.materialId,
    materialName: l.materialName,
    manufacturer: l.manufacturer,
    olfactoryFamily: l.olfactoryFamily,
    pyramidNote: (l.pyramidNote as LocalLine['pyramidNote']) ?? null,
    percent: Number(l.percent),
    weighedGrams: Number(l.weighedGrams ?? 0),
    costPerGram: Number(l.costPerGram ?? 0),
  }));
}

function formatAmount(grams: number, unit: AmountUnit) {
  if (unit === 'ml') return (grams * ML_PER_GRAM).toFixed(3);
  if (unit === 'drops') return (grams * ML_PER_GRAM * DROPS_PER_ML).toFixed(1);
  return grams.toFixed(3);
}

function gramsToDisplay(grams: number, unit: AmountUnit): string {
  if (unit === 'ml') return String(grams * ML_PER_GRAM);
  if (unit === 'drops') return String(grams * ML_PER_GRAM * DROPS_PER_ML);
  return String(grams);
}

function parseDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function displayToGrams(value: number, unit: AmountUnit): number {
  if (unit === 'ml') return value / ML_PER_GRAM;
  if (unit === 'drops') return value / (ML_PER_GRAM * DROPS_PER_ML);
  return value;
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="6" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="18" r="1.8" fill="currentColor" />
    </svg>
  );
}

function LineRowActions({
  className,
  onMoveUp,
  onMoveDown,
  onRemove,
  moveUpLabel,
  moveDownLabel,
  removeLabel,
}: {
  className: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
  removeLabel: string;
}) {
  return (
    <div className={className}>
      <button type="button" className={styles.iconBtn} onClick={onMoveUp} aria-label={moveUpLabel}>
        ↑
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onMoveDown}
        aria-label={moveDownLabel}
      >
        ↓
      </button>
      <button
        type="button"
        className={`${styles.iconBtn} ${styles.removeBtn}`}
        onClick={onRemove}
        aria-label={removeLabel}
      >
        ×
      </button>
    </div>
  );
}

export function WorkbenchPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const setActiveFormulaId = useFormulaStore((s) => s.setActiveFormulaId);
  const formulaId = useSelectedFormulaId();
  const formulaRouteKey = useSelectedFormulaRouteKey();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lines, setLines] = useState<LocalLine[]>([]);
  const [name, setName] = useState('');
  const [batchG, setBatchG] = useState(10);
  const [batchDraft, setBatchDraft] = useState('10');
  const [batchUnit, setBatchUnit] = useState<AmountUnit>('grams');
  const [concPct, setConcPct] = useState(20);
  const concPctRef = useRef(concPct);
  concPctRef.current = concPct;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('grams');
  const [pctMode, setPctMode] = useState<PctMode>('abs');
  const [copyFlash, setCopyFlash] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [excelExportOpen, setExcelExportOpen] = useState(false);
  const [nameFlash, setNameFlash] = useState(false);
  const [normalizeFlash, setNormalizeFlash] = useState(false);
  const [normalizeTipOpen, setNormalizeTipOpen] = useState(false);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);
  const [pyramidTier, setPyramidTier] = useState<string | null>(null);
  const [pyramidHover, setPyramidHover] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const editGeneration = useRef(0);
  const nameFocused = useRef(false);
  const batchFocused = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const normalizeControlRef = useRef<HTMLDivElement>(null);
  const lastServerName = useRef('');
  const syncedFormulaId = useRef<string | null>(null);
  const batchUnitRef = useRef(batchUnit);
  batchUnitRef.current = batchUnit;

  const { data: catalogItems } = useCatalogIndex(true);
  const catalogById = useMemo(
    () => new Map((catalogItems ?? []).map((item) => [item.id, item] as const)),
    [catalogItems],
  );

  const { data: formula, isLoading } = useQuery({
    queryKey: ['formulas', formulaRouteKey],
    queryFn: () => api.get<FormulaDetail>(`/formulas/${formulaRouteKey}`),
    enabled: !!formulaRouteKey,
  });

  const activeId = formula?.id ?? formulaId;

  const { data: evaluations } = useQuery({
    queryKey: ['evaluations', activeId],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          rating: number;
          macerationDay: number | null;
          lineMarks?: EvaluationLineMarkRow[] | null;
        }>
      >(`/evaluations?formulaId=${activeId}`),
    enabled: !!activeId,
  });
  const lastEval = evaluations?.find((row) => row.id === params.get('eval')) ?? evaluations?.[0];

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryRow[]>('/inventory'),
  });

  const stockByMaterial = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of inventory ?? []) {
      map.set(row.materialId, Number(row.quantityGrams));
    }
    return map;
  }, [inventory]);

  useEffect(() => {
    if (!formula) return;
    setActiveFormulaId(formula.id);
    const grams = Number(formula.batchTargetGrams);
    const switched = syncedFormulaId.current !== formula.id;
    syncedFormulaId.current = formula.id;
    const serverConc = Number(formula.concentrationPct);

    if (switched) {
      dirty.current = false;
      editGeneration.current = 0;
      lastServerName.current = formula.name;
      nameFocused.current = false;
      batchFocused.current = false;
      setLines(toLocal(formula.lines));
      setName(formula.name);
      setBatchG(grams);
      setBatchDraft(gramsToDisplay(grams, batchUnitRef.current));
      setConcPct(serverConc);
      setSaveStatus('idle');
      setPyramidTier(null);
      setPyramidHover(null);
      return;
    }

    if (shouldApplyServerLines({ dirty: dirty.current, formulaSwitched: false })) {
      setLines(toLocal(formula.lines));
    }
    if (!nameFocused.current) {
      setName((current) => {
        const hasDraft = current.trim() !== '' && current !== lastServerName.current;
        return hasDraft && current !== formula.name ? current : formula.name;
      });
    }
    if (!batchFocused.current) {
      setBatchG(grams);
      setBatchDraft(gramsToDisplay(grams, batchUnitRef.current));
    }
    setConcPct((localPct) =>
      concentrationAfterServerSync({
        serverPct: serverConc,
        localPct,
        dirty: dirty.current,
        formulaSwitched: false,
      }),
    );
  }, [formula, setActiveFormulaId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!moreRef.current?.contains(target)) setMoreOpen(false);
      if (!normalizeControlRef.current?.contains(target)) setNormalizeTipOpen(false);
      if (!rowMenuRef.current?.contains(target)) setRowMenuKey(null);
    }
    if (moreOpen || normalizeTipOpen || rowMenuKey)
      document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [moreOpen, normalizeTipOpen, rowMenuKey]);

  useEffect(() => {
    if (!normalizeTipOpen && !rowMenuKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNormalizeTipOpen(false);
        setRowMenuKey(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [normalizeTipOpen, rowMenuKey]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeId) {
        return {
          persistName: lastServerName.current,
          editGenerationAtMutateStart: editGeneration.current,
          concentrationPct: concPctRef.current,
          batchTargetGrams: batchG,
        };
      }
      setSaveStatus('saving');
      const editGenerationAtMutateStart = editGeneration.current;
      const persistName = lastServerName.current || name.trim();
      const concentrationPct = concPctRef.current;
      const batchTargetGrams = batchG;
      await api.patch(`/formulas/${activeId}`, {
        name: persistName,
        batchTargetGrams,
        concentrationPct,
      });
      await api.put(`/formulas/${activeId}/lines`, {
        lines: lines.map((l, idx) => ({
          materialId: l.materialId,
          percent: l.percent,
          sortOrder: idx,
          pyramidNote: l.pyramidNote ?? undefined,
          weighedGrams: l.weighedGrams,
          targetGrams: (l.percent / 100) * batchTargetGrams,
        })),
      });
      return {
        persistName,
        editGenerationAtMutateStart,
        concentrationPct,
        batchTargetGrams,
      };
    },
    onSuccess: async (result) => {
      const isLatest = shouldClearDirtyAfterSave({
        editGenerationAtMutateStart: result.editGenerationAtMutateStart,
        currentEditGeneration: editGeneration.current,
      });

      // A newer local edit (e.g. another juice-class chip) landed while this save
      // was in flight — do not write this response into the cache or clear dirty,
      // or the UI snaps back to the previous concentration.
      if (!isLatest) {
        setSaveStatus('saving');
        if (!saveTimer.current) scheduleSave();
        return;
      }

      dirty.current = false;
      if (result.persistName) lastServerName.current = result.persistName;
      setSaveStatus('saved');

      const patchCached = (prev: FormulaDetail | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          name: result.persistName || prev.name,
          batchTargetGrams: String(result.batchTargetGrams),
          concentrationPct: String(result.concentrationPct),
        };
      };
      qc.setQueryData<FormulaDetail>(['formulas', formulaRouteKey], patchCached);
      if (activeId) qc.setQueryData<FormulaDetail>(['formulas', activeId], patchCached);

      await qc.invalidateQueries({ queryKey: ['formulas'] });
      await qc.invalidateQueries({ queryKey: ['formulas', formulaRouteKey] });
      await qc.invalidateQueries({ queryKey: ['formulas', activeId] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
    onError: () => setSaveStatus('error'),
  });

  function scheduleSave() {
    dirty.current = true;
    editGeneration.current += 1;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveMutation.mutateAsync();
    }, 1500);
  }

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === lastServerName.current) return;
    lastServerName.current = trimmed;
    dirty.current = true;
    editGeneration.current += 1;
    void saveMutation.mutateAsync();
  }

  function commitBatch(raw: string = batchDraft) {
    const parsed = parseDecimal(raw);
    if (parsed == null) {
      setBatchDraft(gramsToDisplay(batchG, batchUnit));
      return;
    }
    const grams = displayToGrams(parsed, batchUnit);
    if (Math.abs(grams - batchG) < 0.0001) {
      setBatchDraft(gramsToDisplay(grams, batchUnit));
      return;
    }
    setBatchG(grams);
    setBatchDraft(gramsToDisplay(grams, batchUnit));
    scheduleSave();
  }

  function changeBatchUnit(next: AmountUnit) {
    const parsed = parseDecimal(batchDraft);
    const grams = parsed != null ? displayToGrams(parsed, batchUnit) : batchG;
    setBatchG(grams);
    setBatchUnit(next);
    setBatchDraft(gramsToDisplay(grams, next));
    if (Math.abs(grams - batchG) >= 0.0001) scheduleSave();
  }

  const totalPct = lines.reduce((s, l) => s + l.percent, 0);
  const vizLines = lines.map((l) => ({
    key: l.key,
    name: l.materialName,
    targetPct: l.percent,
    percent: l.percent,
    pyramidNote: l.pyramidNote,
    olfactoryFamily: l.olfactoryFamily,
  }));
  const pyramid = pyramidPercents(vizLines);
  const pyramidLayers = pyramidLayerBreakdown(vizLines);
  const familyOther = t('workbench.familyOther');
  const familyAxes = radarFamilyAxes(vizLines, { otherLabel: familyOther });
  const radarHighlightIds = familyIdsForPyramidLayer(vizLines, pyramidHover ?? pyramidTier, {
    otherLabel: familyOther,
  });

  function displayPct(abs: number) {
    if (pctMode === 'rel' && totalPct > 0) return (abs / totalPct) * 100;
    return abs;
  }

  function addMaterial(m: PickedMaterial) {
    setLines((prev) => {
      if (prev.some((l) => l.materialId === m.id)) return prev;
      return [
        ...prev,
        {
          key: `${m.id}-${Date.now()}`,
          materialId: m.id,
          materialName: m.name,
          manufacturer: m.manufacturer,
          olfactoryFamily: m.olfactoryFamily,
          pyramidNote: (m.pyramidNote as LocalLine['pyramidNote']) ?? 'middle',
          percent: 0,
          weighedGrams: 0,
          costPerGram: Number(m.costPerGram ?? 0),
        },
      ];
    });
    scheduleSave();
  }

  function updateLine(key: string, patch: Partial<LocalLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    scheduleSave();
  }

  function applyFamilyShare(familyId: string, nextPct: number) {
    setLines((prev) =>
      scaleFamilyLinePercents(prev, familyId, nextPct, {
        otherLabel: t('workbench.familyOther'),
      }),
    );
  }

  function onFamilyAxisChange(familyId: string, nextPct: number) {
    if (!dirty.current) {
      dirty.current = true;
      editGeneration.current += 1;
    }
    applyFamilyShare(familyId, nextPct);
  }

  function onFamilyAxisCommit(familyId: string, nextPct: number) {
    applyFamilyShare(familyId, nextPct);
    scheduleSave();
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    scheduleSave();
  }

  function moveLine(key: string, dir: -1 | 1) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
    scheduleSave();
  }

  function showNotice(message: string) {
    setActionNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setActionNotice(null), 2800);
  }

  function buildExportPayload() {
    const unitLabel = amountUnit === 'grams' ? 'g' : amountUnit === 'ml' ? 'ml' : 'drops';
    return {
      name: name || formula?.name || 'Untitled',
      concentrationPct: concPct,
      batchGrams: batchG,
      totalPercent: displayPct(totalPct),
      rows: lines.map((l) => {
        const grams = (l.percent / 100) * batchG;
        return {
          materialName: l.materialName,
          percent: displayPct(l.percent),
          amount: Number(formatAmount(grams, amountUnit)),
          unit: unitLabel,
        };
      }),
    };
  }

  function normalize() {
    if (totalPct <= 0) return;
    setLines((prev) =>
      prev.map((l) => ({ ...l, percent: Number(((l.percent / totalPct) * 100).toFixed(4)) })),
    );
    setNormalizeFlash(true);
    window.setTimeout(() => setNormalizeFlash(false), 1400);
    showNotice(t('workbench.normalizeDone'));
    scheduleSave();
  }

  async function deleteFormula() {
    if (!activeId) return;
    if (!window.confirm(t('workbench.deleteConfirm'))) return;
    await api.delete(`/formulas/${activeId}`);
    setActiveFormulaId(null);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('formula');
      return next;
    });
    await qc.invalidateQueries({ queryKey: ['formulas'] });
  }

  async function forkFormula() {
    if (!activeId || !formula) return;
    setMoreOpen(false);
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    dirty.current = false;

    const created = await api.post<FormulaDetail>('/formulas', {
      name: `Copy of ${name || formula.name}`,
      status: 'draft',
      batchTargetGrams: batchG,
      concentrationPct: concPct,
      description: formula.description ?? undefined,
      lines: lines.map((l, idx) => ({
        materialId: l.materialId,
        percent: l.percent,
        sortOrder: idx,
        pyramidNote: l.pyramidNote ?? undefined,
        weighedGrams: l.weighedGrams,
        targetGrams: (l.percent / 100) * batchG,
      })),
    });

    const routeKey = formulaUrlKey(created) ?? created.id;
    const summary: FormulaSummary = {
      id: created.id,
      name: created.name,
      slug: created.slug,
      status: created.status,
      batchTargetGrams: created.batchTargetGrams,
      concentrationPct: created.concentrationPct,
    };

    qc.setQueryData<FormulaSummary[]>(['formulas'], (prev) => {
      const list = prev ?? [];
      if (list.some((f) => f.id === created.id)) return list;
      return [summary, ...list];
    });
    qc.setQueryData(['formulas', routeKey], created);
    qc.setQueryData(['formulas', created.id], created);

    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('formula', routeKey);
      return next;
    });
    setActiveFormulaId(created.id);
    setNameFlash(true);
    window.setTimeout(() => setNameFlash(false), 2000);
    showNotice(t('workbench.forkSwitched', { name: created.name }));
    await qc.invalidateQueries({ queryKey: ['formulas'] });
  }

  async function copyAsText() {
    setMoreOpen(false);
    const unitLabel = amountUnit === 'grams' ? 'g' : amountUnit === 'ml' ? 'ml' : 'drops';
    const body = [
      `${name || 'Untitled'} · ${concPct}% · batch ${batchG} g`,
      ...lines.map((l) => {
        const grams = (l.percent / 100) * batchG;
        return `${l.materialName}\t${displayPct(l.percent).toFixed(2)}%\t${formatAmount(grams, amountUnit)} ${unitLabel}`;
      }),
      `Total\t${displayPct(totalPct).toFixed(2)}%`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(body);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1600);
      showNotice(t('workbench.copied'));
    } catch {
      showNotice(t('workbench.copyFailed'));
    }
  }

  async function exportPdf() {
    setMoreOpen(false);
    try {
      await api.post('/jobs/pdf-export');
      window.print();
    } catch {
      showNotice(t('workbench.exportPdfDenied'));
    }
  }

  function exportCsv() {
    setMoreOpen(false);
    exportFormulaCsv(buildExportPayload());
    showNotice(t('workbench.exportCsvDone'));
  }

  function exportXls() {
    setMoreOpen(false);
    setExcelExportOpen(true);
  }

  const noteOptions = [
    { value: '', label: '—' },
    { value: 'top', label: t('catalog.top') },
    { value: 'middle', label: t('catalog.heart') },
    { value: 'base', label: t('catalog.base') },
    { value: 'modifier', label: t('catalog.other') },
  ];

  if (!formulaId && !formulaRouteKey) {
    return (
      <div>
        <h1 className="fc-page-title">{t('workbench.title')}</h1>
        <p className="fc-muted">{t('workbench.subtitle')}</p>
        <FormulaSelector />
        <p className="fc-muted">Create a formula to start building on the bench.</p>
      </div>
    );
  }

  if (isLoading || !formula) {
    return (
      <div>
        <h1 className="fc-page-title">{t('workbench.title')}</h1>
        <FormulaSelector />
        <p className="fc-muted">{t('common.loading')}</p>
      </div>
    );
  }

  const amountCol =
    amountUnit === 'grams'
      ? t('workbench.unitGrams')
      : amountUnit === 'ml'
        ? t('workbench.unitMl')
        : t('workbench.unitDrops');

  const juiceClass = juiceClassFromConcentration(concPct);
  const juiceGrams = finishedJuiceGrams(batchG, concPct);
  const alcoholGrams = diluentGrams(batchG, concPct);
  const alcoholPct = Math.max(0, 100 - concPct);
  const oilInBottleG = BOTTLE_ML * JUICE_DENSITY_G_PER_ML * (concPct / 100);
  const concentrateCost = lines.reduce(
    (sum, line) => sum + (line.percent / 100) * batchG * (line.costPerGram || 0),
    0,
  );
  const juiceCost50 =
    batchG > 0 && concentrateCost > 0 ? (concentrateCost / batchG) * oilInBottleG : null;

  function applyJuiceClass(next: JuiceClass) {
    const pct = juiceClassPresetPct(juiceClass, next);
    if (pct == null) return;
    concPctRef.current = pct;
    setConcPct(pct);
    scheduleSave();
  }

  const classChips: Array<{ id: JuiceClass; label: string }> = [
    { id: 'edt', label: t('dashboard.juiceClassEdt') },
    { id: 'edp', label: t('dashboard.juiceClassEdp') },
    { id: 'extrait', label: t('dashboard.juiceClassExtrait') },
  ];

  return (
    <div className={styles.layout}>
      <div className={styles.mainCol}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={`fc-page-title ${styles.pageTitle}`}>{t('workbench.title')}</h1>
            <p className={`fc-muted ${styles.lede}`}>{t('workbench.subtitle')}</p>
          </div>
          <div className={styles.saveCluster}>
            <div className={styles.statusMeta}>
              <span className={`${styles.saveBadge} ${styles[`save_${saveStatus}`] ?? ''}`}>
                {saveStatus === 'saving'
                  ? t('workbench.draftSaving')
                  : saveStatus === 'saved'
                    ? t('workbench.draftSaved')
                    : saveStatus === 'error'
                      ? 'Save failed'
                      : t('workbench.draftIdle')}
              </span>
              {lastEval ? (
                <span className={styles.evalHint}>
                  {t('workbench.lastEvalShort', {
                    rating: lastEval.rating,
                    day: lastEval.macerationDay ?? '—',
                  })}
                </span>
              ) : (
                <span className={styles.evalHint}>{t('workbench.noEvaluations')}</span>
              )}
            </div>
            <div className={styles.headerActions}>
              <Link
                className="fc-btn fc-btn--ghost"
                to={withLabQuery('/evaluation', {
                  formula: formulaUrlKey(formula) ?? formulaId,
                  evalId: lastEval?.id,
                })}
              >
                {t('dashboard.evaluate')}
              </Link>
              <button
                type="button"
                className="fc-btn fc-btn--amber"
                onClick={() => {
                  const trimmed = name.trim();
                  if (trimmed) lastServerName.current = trimmed;
                  void saveMutation.mutateAsync();
                }}
                disabled={!dirty.current && saveStatus !== 'error'}
              >
                {t('workbench.saveNow')}
              </button>
            </div>
          </div>
        </header>

        <FormulaSelector />

        {actionNotice ? (
          <div className={styles.actionNotice} role="status" aria-live="polite">
            {actionNotice}
          </div>
        ) : null}

        <div className={`fc-card ${styles.meta}`}>
          <div className={styles.metaMain}>
            <label className="fc-label" htmlFor="formula-name">
              {t('workbench.formulaName')}
            </label>
            <input
              id="formula-name"
              ref={nameInputRef}
              className={`fc-input ${nameFlash ? styles.nameFlash : ''}`}
              value={name}
              disabled={isLoading}
              onFocus={() => {
                nameFocused.current = true;
              }}
              onChange={(e) => {
                setName(e.target.value);
                dirty.current = true;
              }}
              onBlur={() => {
                nameFocused.current = false;
                commitName();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
            <div className={styles.batchLabel}>
              <label htmlFor="formula-batch">{t('workbench.batch')}</label>
              <div className={styles.batchField}>
                <input
                  id="formula-batch"
                  className={`${styles.batchInput} fc-input`}
                  type="text"
                  inputMode="decimal"
                  value={batchDraft}
                  disabled={isLoading}
                  onFocus={() => {
                    batchFocused.current = true;
                  }}
                  onChange={(e) => {
                    setBatchDraft(e.target.value);
                    dirty.current = true;
                  }}
                  onBlur={() => {
                    batchFocused.current = false;
                    commitBatch();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitBatch((e.currentTarget as HTMLInputElement).value);
                    }
                  }}
                />
                <div
                  className={styles.segmented}
                  role="group"
                  aria-label={t('workbench.batchUnit')}
                >
                  {(
                    [
                      ['grams', 'g'],
                      ['ml', 'ml'],
                      ['drops', t('workbench.unitDrops')],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={batchUnit === id ? styles.segActive : undefined}
                      onClick={() => changeBatchUnit(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.vesselSlot}>
            <p className={styles.vesselLabel}>{t('workbench.concentration')}</p>
            <div className={styles.vesselBody}>
              <CssPerfumeVessel
                levelPct={concPct}
                compact
                editable
                onLevelChange={setConcPct}
                onCommit={(pct) => {
                  setConcPct(pct);
                  scheduleSave();
                }}
              />
              <div className={styles.juiceLive} aria-live="polite">
                <div
                  className={styles.classChips}
                  role="radiogroup"
                  aria-label={t('workbench.juiceClass')}
                >
                  {classChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      role="radio"
                      aria-checked={juiceClass === chip.id}
                      className={juiceClass === chip.id ? styles.classChipOn : styles.classChip}
                      onClick={() => applyJuiceClass(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div
                  className={styles.juiceBar}
                  role="img"
                  aria-label={t('workbench.juiceSplit', {
                    oil: concPct.toFixed(0),
                    alcohol: alcoholPct.toFixed(0),
                  })}
                >
                  <span className={styles.juiceBarOil} style={{ width: `${concPct}%` }} />
                </div>
                <div className={styles.juiceStats}>
                  <p>
                    <strong>
                      {t('workbench.juiceYield', {
                        batch: batchG.toFixed(1),
                        juice: juiceGrams.toFixed(1),
                      })}
                    </strong>
                  </p>
                  <p>
                    {t('workbench.diluentNeeded', {
                      diluent: alcoholGrams.toFixed(1),
                    })}
                  </p>
                  <p>
                    {t('workbench.oilInBottle', {
                      grams: oilInBottleG.toFixed(1),
                    })}
                    {juiceCost50 != null ? (
                      <>
                        {' · '}
                        <Link
                          className={styles.juiceCost}
                          to={withLabQuery('/costing', {
                            formula: formulaUrlKey(formula) ?? formulaId,
                          })}
                        >
                          {t('dashboard.costPerBottle', {
                            amount: formatMoney(juiceCost50),
                          })}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={() => setPickerOpen(true)}
            >
              {t('workbench.addMaterial')}
            </button>
            <div className={styles.normalizeControl} ref={normalizeControlRef}>
              <div
                className={`${styles.normalizeSplit} ${totalPct <= 0 ? styles.normalizeSplitDisabled : ''}`}
              >
                <button
                  type="button"
                  className={styles.normalizeMain}
                  onClick={normalize}
                  disabled={totalPct <= 0}
                  title={t('workbench.normalizeHint')}
                  aria-describedby={normalizeTipOpen ? 'normalize-help' : undefined}
                >
                  {t('workbench.normalize')}
                </button>
                <button
                  type="button"
                  className={styles.normalizeInfoBtn}
                  aria-label={t('workbench.normalizeAbout')}
                  aria-expanded={normalizeTipOpen}
                  aria-controls="normalize-help"
                  onClick={() => {
                    setMoreOpen(false);
                    setNormalizeTipOpen((v) => !v);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M12 10.5v6M12 7.75h.01"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              {normalizeTipOpen ? (
                <div id="normalize-help" role="tooltip" className={styles.normalizeTip}>
                  <strong className={styles.normalizeTipTitle}>{t('workbench.normalize')}</strong>
                  <p>{t('workbench.normalizeHelp')}</p>
                </div>
              ) : null}
            </div>
            <div className={styles.moreWrap} ref={moreRef}>
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setNormalizeTipOpen(false);
                  setMoreOpen((v) => !v);
                }}
              >
                {t('workbench.moreActions')}
              </button>
              {moreOpen ? (
                <div className={styles.moreMenu} role="menu">
                  <button type="button" role="menuitem" onClick={() => void forkFormula()}>
                    <MenuIcon kind="fork" />
                    <span>{t('workbench.fork')}</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => void copyAsText()}>
                    <MenuIcon kind="copy" />
                    <span>{copyFlash ? t('workbench.copied') : t('workbench.copyText')}</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => void exportPdf()}>
                    <MenuIcon kind="pdf" />
                    <span>{t('workbench.exportPdf')}</span>
                  </button>
                  <button type="button" role="menuitem" onClick={exportCsv}>
                    <MenuIcon kind="csv" />
                    <span>{t('workbench.exportCsv')}</span>
                  </button>
                  <button type="button" role="menuitem" onClick={exportXls}>
                    <MenuIcon kind="xls" />
                    <span>{t('workbench.exportXls')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.toggles}>
          <div className={styles.segmented} role="group" aria-label={t('workbench.units')}>
            {(
              [
                ['grams', t('workbench.unitGrams')],
                ['drops', t('workbench.unitDrops')],
                ['ml', t('workbench.unitMl')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={amountUnit === id ? styles.segActive : undefined}
                onClick={() => setAmountUnit(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.segmented} role="group" aria-label={t('workbench.pctMode')}>
            {(
              [
                ['abs', t('workbench.absPct')],
                ['rel', t('workbench.relPct')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={pctMode === id ? styles.segActive : undefined}
                onClick={() => setPctMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`fc-table-wrap ${styles.gridWrap}`}>
          <table className="fc-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Note</th>
                <th>{pctMode === 'rel' ? t('workbench.relPct') : t('workbench.absPct')}</th>
                <th>{amountCol}</th>
                <th>Weighed</th>
                <th>Stock</th>
                <th className={styles.stickyHead} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const grams = (line.percent / 100) * batchG;
                const stock = stockByMaterial.get(line.materialId);
                const low = stock !== undefined && stock < grams;
                const actionProps = {
                  onMoveUp: () => {
                    moveLine(line.key, -1);
                    setRowMenuKey(null);
                  },
                  onMoveDown: () => {
                    moveLine(line.key, 1);
                    setRowMenuKey(null);
                  },
                  onRemove: () => {
                    removeLine(line.key);
                    setRowMenuKey(null);
                  },
                  moveUpLabel: t('workbench.moveUp'),
                  moveDownLabel: t('workbench.moveDown'),
                  removeLabel: t('workbench.removeLine'),
                };
                const menuOpen = rowMenuKey === line.key;
                const catalogItem = catalogById.get(line.materialId);
                const sittingMark = latestProbeMark(
                  evaluations ?? [],
                  line.materialId,
                  /^[0-9a-f-]{36}$/i.test(line.key) ? line.key : undefined,
                  lastEval?.id,
                );
                const markLabel =
                  sittingMark === 'ok'
                    ? t('evaluation.markOk')
                    : sittingMark === 'weak'
                      ? t('evaluation.markWeak')
                      : sittingMark === 'strong'
                        ? t('evaluation.markStrong')
                        : sittingMark === 'harsh'
                          ? t('evaluation.markHarsh')
                          : null;
                return (
                  <tr key={line.key}>
                    <td className={styles.materialCell}>
                      <div className={styles.materialMain}>
                        <div className={styles.materialIdentity}>
                          <MaterialAvatar
                            name={line.materialName}
                            family={line.olfactoryFamily}
                            imageUrl={catalogItem?.imageUrl}
                            size={32}
                          />
                          <div className={styles.materialCopy}>
                            <strong>{line.materialName}</strong>
                            {markLabel ? (
                              <span className={styles.lineMark}>{markLabel}</span>
                            ) : null}
                            <div className={styles.sub}>
                              {[line.manufacturer, line.olfactoryFamily]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </div>
                        <div
                          className={styles.materialActions}
                          ref={menuOpen ? rowMenuRef : undefined}
                        >
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label={t('workbench.rowActions')}
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            onClick={() =>
                              setRowMenuKey((key) => (key === line.key ? null : line.key))
                            }
                          >
                            <KebabIcon />
                          </button>
                          {menuOpen ? (
                            <div className={styles.rowMenu} role="menu">
                              <button type="button" role="menuitem" onClick={actionProps.onMoveUp}>
                                {actionProps.moveUpLabel}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={actionProps.onMoveDown}
                              >
                                {actionProps.moveDownLabel}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.rowMenuDanger}
                                onClick={actionProps.onRemove}
                              >
                                {actionProps.removeLabel}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className={styles.noteCell}>
                      <FcSelect
                        options={noteOptions}
                        value={line.pyramidNote ?? ''}
                        onChange={(v) =>
                          updateLine(line.key, {
                            pyramidNote: (v || null) as LocalLine['pyramidNote'],
                          })
                        }
                        aria-label="Note"
                      />
                    </td>
                    <td>
                      <DecimalCell
                        className={styles.cellInput}
                        aria-label={
                          pctMode === 'rel' ? t('workbench.relPct') : t('workbench.absPct')
                        }
                        value={displayPct(line.percent)}
                        onCommit={(next) => {
                          if (pctMode === 'rel' && totalPct > 0) {
                            updateLine(line.key, { percent: (next / 100) * totalPct });
                          } else {
                            updateLine(line.key, { percent: next });
                          }
                        }}
                      />
                    </td>
                    <td>{formatAmount(grams, amountUnit)}</td>
                    <td>
                      <DecimalCell
                        className={styles.cellInput}
                        aria-label={t('workbench.weighed')}
                        value={line.weighedGrams}
                        onCommit={(next) => updateLine(line.key, { weighedGrams: next })}
                      />
                    </td>
                    <td className={low ? styles.low : undefined}>
                      {stock === undefined ? '—' : `${stock.toFixed(1)} g`}
                    </td>
                    <td className={styles.stickyActions}>
                      <LineRowActions className={styles.rowActions ?? ''} {...actionProps} />
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7}>No materials yet — add from the catalog picker.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className={styles.footer}>
          <span
            className={`${Math.abs(totalPct - 100) < 0.05 ? styles.ok : styles.warn} ${normalizeFlash ? styles.totalFlash : ''}`}
          >
            {t('workbench.totalTarget')}: {displayPct(totalPct).toFixed(2)}%
            {pctMode === 'abs' && Math.abs(totalPct - 100) >= 0.05
              ? ` (${(totalPct - 100).toFixed(2)} vs 100)`
              : ''}
          </span>
          <button type="button" className={styles.deleteBtn} onClick={() => void deleteFormula()}>
            {t('workbench.deleteFormula')}
          </button>
        </footer>
      </div>

      <aside className={styles.sideCol}>
        <div className={`fc-card ${styles.vizCard}`}>
          <h2>{t('workbench.pyramid')}</h2>
          <FragrancePyramid
            showLegend={false}
            showNotes={false}
            activeId={pyramidTier}
            hoverId={pyramidHover === 'modifier' ? null : pyramidHover}
            onSelect={setPyramidTier}
            onHover={(id) => setPyramidHover(id === 'modifier' ? null : id)}
            tiers={[
              {
                id: 'top',
                label: t('catalog.top'),
                percent: pyramid.top,
              },
              {
                id: 'middle',
                label: t('catalog.heart'),
                percent: pyramid.middle,
              },
              {
                id: 'base',
                label: t('catalog.base'),
                percent: pyramid.base,
              },
            ]}
          />
          <PyramidLayerSummary
            activeId={pyramidTier}
            onSelect={setPyramidTier}
            onHover={setPyramidHover}
            emptyLabel={t('workbench.layerEmpty')}
            moreLabel={(count) => t('workbench.layerMore', { count })}
            layers={[
              {
                id: 'top',
                label: t('catalog.top'),
                color: 'var(--fc-note-top)',
                items: pyramidLayers.top,
              },
              {
                id: 'middle',
                label: t('catalog.heart'),
                color: 'var(--fc-note-heart)',
                items: pyramidLayers.middle,
              },
              {
                id: 'base',
                label: t('catalog.base'),
                color: 'var(--fc-note-base)',
                items: pyramidLayers.base,
              },
              {
                id: 'modifier',
                label: t('catalog.other'),
                color: 'var(--fc-text-muted)',
                items: pyramidLayers.modifier,
              },
            ]}
          />
        </div>
        <div className={`fc-card ${styles.vizCard}`}>
          <h2>{t('workbench.notesDistribution')}</h2>
          <NotesRadar
            axes={familyAxes}
            highlightIds={radarHighlightIds}
            emptyLabel={t('dashboard.emptyFamilies')}
            editable
            valueMax={100}
            onAxisChange={onFamilyAxisChange}
            onAxisCommit={onFamilyAxisCommit}
          />
        </div>
      </aside>

      <MaterialPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addMaterial}
        closeOnPick={false}
        selectedIds={lines.map((l) => l.materialId)}
      />
      <FormulaExcelExportDialog
        open={excelExportOpen}
        onClose={() => setExcelExportOpen(false)}
        currentFormulaId={formulaId}
        currentFormulaName={name || formula?.name}
        onExported={showNotice}
      />
    </div>
  );
}
