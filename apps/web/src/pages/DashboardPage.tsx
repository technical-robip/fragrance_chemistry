import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { juiceClassFromConcentration } from '@fc/shared';
import { api } from '@/lib/api-client';
import { capRadarAxes, linePyramidBand, pyramidDrydownDrifts } from '@/lib/formula-viz';
import {
  FormulaSelector,
  useSelectedFormulaId,
  useSelectedFormulaUrlKey,
} from '@/components/FormulaSelector';
import { withLabQuery, withFormulaQuery } from '@/lib/lab-query';
import { FormulaExcelExportDialog } from '@/components/FormulaExcelExportDialog';
import { CompositionInspector, type CompositionLine } from '@/components/viz/CompositionInspector';
import { CompliancePanel, type ComplianceReport } from '@/components/viz/CompliancePanel';
import { CssPerfumeVessel } from '@/components/viz/CssPerfumeVessel';
import { FragrancePyramid } from '@/components/viz/FragrancePyramid';
import { NotesRadar } from '@/components/viz/NotesRadar';
import { ScentLiquidField } from '@/components/viz/ScentLiquidField';
import styles from './DashboardPage.module.css';

type DashboardStats = {
  formulaCount: number;
  catalogSize: number;
  evaluationCount: number;
  lowStockItems: number;
};

type PyramidBlock = {
  top: number;
  middle: number;
  base: number;
  modifier: number;
  unassigned: number;
  source?: 'note' | 'volatility';
};

type DashboardBriefing = {
  formula: {
    id: string;
    name: string;
    status: string;
    concentrationPct: number;
    batchTargetGrams: number;
  };
  pyramid: PyramidBlock;
  pyramidVolatility: PyramidBlock;
  families: Array<{ name: string; percent: number }>;
  lines: CompositionLine[];
  product: {
    concentrationPct: number;
    juiceClass: 'edt' | 'edp' | 'extrait';
    costPer50ml: number | null;
    currency: string;
    concentrateGrams: number;
    finishedJuiceGrams: number;
    diluentGrams: number;
  };
  compliance: ComplianceReport;
  lastEvaluation: {
    rating: number | null;
    macerationDay: number | null;
    createdAt: string;
  } | null;
  openSitting: {
    id: string;
    macerationDay: number;
    nextSlot: string | null;
    complete: boolean;
    nextDay: number | null;
  } | null;
};

type Filter =
  | { kind: 'tier'; id: 'top' | 'middle' | 'base' }
  | { kind: 'family'; id: string }
  | { kind: 'line'; id: string }
  | { kind: 'drift' }
  | null;

function formatMoney(amount: number, currency: string) {
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

function bandLabel(band: 'top' | 'middle' | 'base', t: (k: string) => string) {
  if (band === 'top') return t('catalog.top');
  if (band === 'middle') return t('catalog.heart');
  return t('catalog.base');
}

export function DashboardPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const qc = useQueryClient();
  const formulaId = useSelectedFormulaId();
  const formulaKey = useSelectedFormulaUrlKey();
  const [filter, setFilter] = useState<Filter>(null);
  const [draftPct, setDraftPct] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [excelExportOpen, setExcelExportOpen] = useState(false);

  useEffect(() => {
    setFilter(null);
    setDraftPct(null);
    setSaveStatus('idle');
  }, [formulaId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  });

  const {
    data: briefing,
    isLoading: briefingLoading,
    isError: briefingError,
  } = useQuery({
    queryKey: ['dashboard', 'briefing', formulaId],
    queryFn: () =>
      api.get<DashboardBriefing>(`/dashboard/briefing?formulaId=${encodeURIComponent(formulaId!)}`),
    enabled: !!formulaId,
  });

  useEffect(() => {
    if (briefing && draftPct == null) {
      setDraftPct(briefing.product.concentrationPct);
    }
  }, [briefing, draftPct]);

  const saveConc = useMutation({
    mutationFn: async (pct: number) => {
      if (!formulaId) return;
      await api.patch(`/formulas/${formulaId}`, { concentrationPct: pct });
    },
    onMutate: () => setSaveStatus('saving'),
    onSuccess: async () => {
      setSaveStatus('saved');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['dashboard', 'briefing', formulaId] }),
        qc.invalidateQueries({ queryKey: ['formulas'] }),
        qc.invalidateQueries({ queryKey: ['costing'] }),
      ]);
      window.setTimeout(() => setSaveStatus('idle'), 1600);
    },
    onError: () => setSaveStatus('error'),
  });

  const saveAccord = useMutation({
    mutationFn: async (lineIds: string[]) => {
      if (!formulaId || !briefing) return;
      const picked = briefing.lines.filter((l) => l.id && lineIds.includes(l.id));
      if (picked.length < 2) return;
      const total = picked.reduce((s, l) => s + l.percent, 0) || 1;
      const created = await api.post<{ id: string }>('/formulas', {
        name: `Accord · ${picked
          .map((p) => p.name)
          .slice(0, 2)
          .join(' + ')}`,
        status: 'draft',
        isLibraryAccord: true,
        concentrationPct: briefing.formula.concentrationPct,
        batchTargetGrams: briefing.formula.batchTargetGrams,
        lines: picked.map((p, idx) => ({
          materialId: p.materialId,
          percent: (p.percent / total) * 100,
          sortOrder: idx,
          pyramidNote: p.pyramidNote === 'heart' ? 'middle' : p.pyramidNote,
        })),
      });

      // Replace selected leaf lines with a single accord line in the parent formula.
      const remaining = briefing.lines.filter((l) => !l.id || !lineIds.includes(l.id));
      const anchor = picked[0]!;
      await api.put(`/formulas/${formulaId}/lines`, {
        lines: [
          ...remaining.map((l, idx) => ({
            materialId: l.materialId,
            percent: l.percent,
            sortOrder: idx,
            pyramidNote: l.pyramidNote === 'heart' ? 'middle' : (l.pyramidNote ?? undefined),
            childFormulaId: l.childFormulaId ?? undefined,
            stockConcentrationPct: l.stockConcentrationPct,
            solvent: l.solvent ?? undefined,
          })),
          {
            materialId: anchor.materialId,
            percent: total,
            sortOrder: remaining.length,
            pyramidNote:
              anchor.pyramidNote === 'heart' ? 'middle' : (anchor.pyramidNote ?? undefined),
            childFormulaId: created.id,
          },
        ],
      });
      return created.id;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['formulas'] }),
        qc.invalidateQueries({ queryKey: ['dashboard', 'briefing', formulaId] }),
      ]);
    },
  });

  const stats = data ?? {
    formulaCount: 0,
    catalogSize: 0,
    evaluationCount: 0,
    lowStockItems: 0,
  };

  const lines = briefing?.lines ?? [];
  const drifts = useMemo(
    () =>
      pyramidDrydownDrifts(
        lines.map((l) => ({
          key: l.id ?? l.materialId,
          name: l.name,
          percent: l.percent,
          pyramidNote: l.pyramidNote,
          tenacityHours: l.tenacityHours,
        })),
      ),
    [lines],
  );
  const hasTenacity = lines.some(
    (l) => l.tenacityHours != null && Number.isFinite(l.tenacityHours),
  );
  const filteredLines = useMemo(() => {
    if (!filter) return lines;
    if (filter.kind === 'tier') {
      return lines.filter((l) => linePyramidBand(l, 'note') === filter.id);
    }
    if (filter.kind === 'drift') {
      const keys = new Set(drifts.map((d) => d.key));
      return lines.filter((l) => keys.has(l.id ?? l.materialId));
    }
    if (filter.kind === 'line') {
      return lines.filter((l) => l.id === filter.id || l.materialId === filter.id);
    }
    return lines.filter((l) => (l.olfactoryFamily ?? '') === filter.id);
  }, [drifts, filter, lines]);

  const inspectorTitle = useMemo(() => {
    if (!filter) return t('dashboard.inspectorHintAll');
    if (filter.kind === 'drift') return t('dashboard.inspectorTitleDrift');
    if (filter.kind === 'line') {
      const hit = lines.find((l) => l.id === filter.id || l.materialId === filter.id);
      return hit ? `${t('dashboard.inspectorTitle')} · ${hit.name}` : t('dashboard.inspectorTitle');
    }
    if (filter.kind === 'tier') {
      const label =
        filter.id === 'top'
          ? t('catalog.top')
          : filter.id === 'middle'
            ? t('catalog.heart')
            : t('catalog.base');
      return `${t('dashboard.inspectorTitle')} · ${label}`;
    }
    return `${t('dashboard.inspectorTitle')} · ${filter.id}`;
  }, [filter, lines, t]);

  const displayPct = draftPct ?? briefing?.product.concentrationPct ?? 20;
  const juiceClass = juiceClassFromConcentration(displayPct);
  const juiceClassLabel =
    juiceClass === 'edt'
      ? t('dashboard.juiceClassEdt')
      : juiceClass === 'edp'
        ? t('dashboard.juiceClassEdp')
        : t('dashboard.juiceClassExtrait');

  const draftCost =
    briefing?.product.costPer50ml != null && briefing.product.concentrationPct > 0
      ? briefing.product.costPer50ml * (displayPct / briefing.product.concentrationPct)
      : null;

  const draftDiluent =
    briefing != null
      ? Math.max(
          0,
          briefing.product.concentrateGrams / (displayPct / 100) -
            briefing.product.concentrateGrams,
        )
      : null;

  const q = formulaKey ? `?formula=${encodeURIComponent(formulaKey)}` : '';
  const fromPath = `${location.pathname}${location.search}`;

  const cards = [
    {
      label: t('dashboard.yourFormulas'),
      value: stats.formulaCount,
      to: withFormulaQuery('/workbench', formulaKey),
    },
    {
      label: t('dashboard.catalogMaterials'),
      value: stats.catalogSize,
      to: '/catalog',
    },
    {
      label: t('dashboard.evaluationsLogged'),
      value: stats.evaluationCount,
      // Browse the whole evaluation library, not just the active formula.
      to: '/evaluation',
    },
    {
      label: t('dashboard.lowStockAlerts'),
      value: stats.lowStockItems,
      to: '/inventory?filter=low',
    },
  ] as const;

  return (
    <div className={styles.page}>
      <ScentLiquidField />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={styles.header}>
          <div>
            <h1 className="fc-page-title">{t('dashboard.title')}</h1>
            <p className="fc-muted">{t('dashboard.subtitle')}</p>
          </div>
          <Link to={withFormulaQuery('/workbench', formulaKey)} className="fc-btn fc-btn--amber">
            {t('dashboard.openWorkbench')}
          </Link>
        </header>

        {isError ? <p className={styles.banner}>{t('dashboard.statsError')}</p> : null}

        <div className={styles.grid}>
          {cards.map((card) => (
            <Link key={card.to} to={card.to} className={`fc-card ${styles.stat}`}>
              <span className={styles.statLabel}>{card.label}</span>
              <strong className={styles.statValue}>{isLoading ? '…' : card.value}</strong>
              <span className={styles.statHint}>{t('dashboard.open')}</span>
            </Link>
          ))}
        </div>

        <section className={`fc-card ${styles.cockpit}`}>
          <div className={styles.cockpitHeader}>
            <div>
              <h2 className={styles.cockpitTitle}>{t('dashboard.selectFormula')}</h2>
              {briefing ? (
                <p className={styles.caption}>
                  {t('dashboard.status', { status: briefing.formula.status })}
                  {briefing.lastEvaluation ? (
                    <>
                      {' · '}
                      <Link
                        className={styles.evalLink}
                        to={withLabQuery('/evaluation', {
                          formula: formulaKey,
                          evalId: briefing.openSitting?.id,
                        })}
                      >
                        {t('dashboard.lastEval', {
                          rating: briefing.lastEvaluation.rating ?? '—',
                          day: briefing.lastEvaluation.macerationDay ?? '—',
                        })}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className={styles.caption}>{t('dashboard.activeFormula')}</p>
              )}
              {briefing?.openSitting ? (
                <p className={styles.sittingHint}>
                  {briefing.openSitting.complete
                    ? briefing.openSitting.nextDay
                      ? t('dashboard.sittingNext', { day: briefing.openSitting.nextDay })
                      : t('dashboard.sittingComplete', { day: briefing.openSitting.macerationDay })
                    : briefing.openSitting.nextSlot
                      ? t('dashboard.sittingOpen', {
                          day: briefing.openSitting.macerationDay,
                          slot: t(
                            briefing.openSitting.nextSlot === 't30mNotes'
                              ? 'evaluation.slotT30'
                              : briefing.openSitting.nextSlot === 't4hNotes'
                                ? 'evaluation.slotT4h'
                                : briefing.openSitting.nextSlot === 't24hNotes'
                                  ? 'evaluation.slotT24h'
                                  : 'evaluation.slotT0',
                          ),
                        })
                      : t('dashboard.sittingOpenDay', { day: briefing.openSitting.macerationDay })}
                </p>
              ) : null}
            </div>
            <div className={styles.selectorActions}>
              <div className={styles.selectorWrap}>
                <FormulaSelector
                  onCreated={() => {
                    setFilter(null);
                  }}
                />
              </div>
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                onClick={() => setExcelExportOpen(true)}
              >
                {t('formulaExport.title')}
              </button>
            </div>
          </div>

          {!formulaId ? (
            <div className={styles.empty}>
              <p className="fc-muted">{t('dashboard.emptyLines')}</p>
            </div>
          ) : briefingLoading ? (
            <p className="fc-muted">{t('common.loading')}</p>
          ) : briefingError || !briefing ? (
            <p className={styles.banner}>{t('dashboard.statsError')}</p>
          ) : lines.length === 0 ? (
            <div className={styles.empty}>
              <p className="fc-muted">{t('dashboard.emptyLines')}</p>
              <Link to={`/workbench${q}`} className="fc-btn fc-btn--primary">
                {t('dashboard.editWorkbench')}
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.vizRow}>
                <article className={`${styles.vizCard} ${styles.vizPyramid}`}>
                  <div className={styles.juiceHeader}>
                    <div>
                      <h3>{t('dashboard.scentStructure')}</h3>
                      <p className={styles.caption}>{t('dashboard.pyramidCaption')}</p>
                    </div>
                  </div>
                  <div className={styles.vizFigure}>
                    <FragrancePyramid
                      legendPlacement="beside"
                      activeId={filter?.kind === 'tier' ? filter.id : null}
                      onSelect={(id) => {
                        setFilter(
                          id ? { kind: 'tier', id: id as 'top' | 'middle' | 'base' } : null,
                        );
                      }}
                      tiers={[
                        {
                          id: 'top',
                          label: t('catalog.top'),
                          percent: briefing.pyramid?.top ?? 0,
                          notes: lines
                            .filter((l) => linePyramidBand(l, 'note') === 'top')
                            .sort((a, b) => b.percent - a.percent)
                            .map((l) =>
                              l.tenacityHours != null
                                ? t('dashboard.pyramidNoteWithHours', {
                                    name: l.name,
                                    hours: Number(l.tenacityHours).toFixed(0),
                                  })
                                : l.name,
                            ),
                        },
                        {
                          id: 'middle',
                          label: t('catalog.heart'),
                          percent: briefing.pyramid?.middle ?? 0,
                          notes: lines
                            .filter((l) => linePyramidBand(l, 'note') === 'middle')
                            .sort((a, b) => b.percent - a.percent)
                            .map((l) =>
                              l.tenacityHours != null
                                ? t('dashboard.pyramidNoteWithHours', {
                                    name: l.name,
                                    hours: Number(l.tenacityHours).toFixed(0),
                                  })
                                : l.name,
                            ),
                        },
                        {
                          id: 'base',
                          label: t('catalog.base'),
                          percent: briefing.pyramid?.base ?? 0,
                          notes: lines
                            .filter((l) => linePyramidBand(l, 'note') === 'base')
                            .sort((a, b) => b.percent - a.percent)
                            .map((l) =>
                              l.tenacityHours != null
                                ? t('dashboard.pyramidNoteWithHours', {
                                    name: l.name,
                                    hours: Number(l.tenacityHours).toFixed(0),
                                  })
                                : l.name,
                            ),
                        },
                      ]}
                    />
                  </div>
                  <div className={styles.drydown}>
                    <h4 className={styles.drydownTitle}>{t('dashboard.drydownTitle')}</h4>
                    {!hasTenacity ? (
                      <p className={styles.caption}>{t('dashboard.drydownNone')}</p>
                    ) : drifts.length === 0 ? (
                      <p className={styles.caption}>{t('dashboard.drydownAligned')}</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`${styles.drydownSummary} ${filter?.kind === 'drift' ? styles.drydownSummaryActive : ''}`}
                          onClick={() =>
                            setFilter((f) => (f?.kind === 'drift' ? null : { kind: 'drift' }))
                          }
                          aria-pressed={filter?.kind === 'drift'}
                        >
                          {t('dashboard.drydownSummary', { count: drifts.length })}
                        </button>
                        <ul className={styles.drydownList}>
                          {drifts.map((drift) => {
                            const active = filter?.kind === 'line' && filter.id === drift.key;
                            const copyKey =
                              drift.direction === 'faster'
                                ? 'dashboard.drydownFaster'
                                : 'dashboard.drydownSlower';
                            return (
                              <li key={drift.key}>
                                <button
                                  type="button"
                                  className={`${styles.drydownItem} ${active ? styles.drydownItemActive : ''}`}
                                  aria-pressed={active}
                                  onClick={() =>
                                    setFilter((f) =>
                                      f?.kind === 'line' && f.id === drift.key
                                        ? null
                                        : { kind: 'line', id: drift.key },
                                    )
                                  }
                                >
                                  <span>
                                    {t(copyKey, {
                                      name: drift.name,
                                      tagged: bandLabel(drift.tagged, t),
                                      evaporates: bandLabel(drift.evaporates, t),
                                    })}
                                  </span>
                                  {drift.tenacityHours != null ? (
                                    <span className={styles.drydownMeta}>
                                      {t('dashboard.drydownHours', {
                                        hours: Number(drift.tenacityHours).toFixed(0),
                                      })}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                </article>

                <article className={`${styles.vizCard} ${styles.vizJuice}`}>
                  <div className={styles.juiceHeader}>
                    <div>
                      <h3>{t('dashboard.juiceProfile')}</h3>
                      <p className={styles.caption}>{t('dashboard.concentrationHint')}</p>
                    </div>
                    {saveStatus !== 'idle' ? (
                      <span className={`${styles.saveBadge} ${styles[`save_${saveStatus}`] ?? ''}`}>
                        {saveStatus === 'saving'
                          ? t('dashboard.saving')
                          : saveStatus === 'saved'
                            ? t('dashboard.saved')
                            : 'Save failed'}
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.concentrateStack}>
                    <div className={styles.vizFigure}>
                      <CssPerfumeVessel
                        levelPct={displayPct}
                        editable
                        onLevelChange={setDraftPct}
                        onCommit={(pct) => {
                          setDraftPct(pct);
                          if (Math.abs(pct - briefing.product.concentrationPct) < 0.05) return;
                          void saveConc.mutateAsync(pct);
                        }}
                        juiceClassLabel={t('dashboard.concentrateMeta', {
                          pct: displayPct.toFixed(0),
                          juiceClass: juiceClassLabel,
                        })}
                        costLabel={
                          draftCost != null
                            ? t('dashboard.costPerBottle', {
                                amount: formatMoney(draftCost, briefing.product.currency),
                              })
                            : undefined
                        }
                        costHref={`/costing${q}`}
                      />
                    </div>
                    {draftDiluent != null ? (
                      <p className={styles.diluentLine}>
                        {t('dashboard.diluentHint', {
                          batch: briefing.product.concentrateGrams.toFixed(1),
                          pct: displayPct.toFixed(0),
                          diluent: draftDiluent.toFixed(1),
                        })}
                      </p>
                    ) : null}
                  </div>
                </article>

                <article className={`${styles.vizCard} ${styles.vizRadar}`}>
                  <h3>{t('dashboard.familyCharacter')}</h3>
                  <NotesRadar
                    axes={capRadarAxes(
                      (briefing.families ?? []).map((f) => ({
                        id: f.name,
                        label: f.name,
                        value: f.percent,
                      })),
                      8,
                      t('workbench.familyOther'),
                    )}
                    showLegend={false}
                    emptyLabel={t('dashboard.emptyFamilies')}
                    activeId={filter?.kind === 'family' ? filter.id : null}
                    onSelect={(id) => {
                      setFilter(id ? { kind: 'family', id } : null);
                    }}
                  />
                </article>

                <article className={`${styles.vizCard} ${styles.vizCompliance}`}>
                  <h3>{t('dashboard.complianceTitle')}</h3>
                  <CompliancePanel compliance={briefing.compliance} />
                </article>
              </div>

              <CompositionInspector
                lines={filteredLines}
                title={inspectorTitle}
                emptyHint={t('dashboard.inspectorEmpty')}
                from={fromPath}
                fromLabel={t('dashboard.title')}
                currency={briefing.product.currency}
                onSaveAccord={(ids) => void saveAccord.mutateAsync(ids)}
              />

              <div className={styles.actions}>
                <Link to={`/workbench${q}`} className="fc-btn fc-btn--primary">
                  {t('dashboard.editWorkbench')}
                </Link>
                <Link to={`/costing${q}`} className="fc-btn fc-btn--amber">
                  {t('dashboard.costJuice')}
                </Link>
                <Link
                  to={withLabQuery('/evaluation', {
                    formula: formulaKey,
                    evalId: briefing.openSitting?.id,
                  })}
                  className="fc-btn fc-btn--ghost"
                >
                  {t('dashboard.evaluate')}
                </Link>
                <Link to={`/weighing${q}`} className="fc-btn fc-btn--ghost">
                  {t('dashboard.weigh')}
                </Link>
              </div>
            </>
          )}
        </section>
      </motion.div>
      <FormulaExcelExportDialog
        open={excelExportOpen}
        onClose={() => setExcelExportOpen(false)}
        currentFormulaId={formulaId}
        currentFormulaName={briefing?.formula.name}
      />
    </div>
  );
}
