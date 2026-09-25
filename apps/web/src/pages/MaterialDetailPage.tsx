import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { MaterialAvatar } from '@/components/MaterialAvatar';
import { useFormulaStore } from '@/stores/formula-store';
import { useAuthStore } from '@/stores/auth-store';
import styles from './MaterialDetailPage.module.css';

type PhotoCredit = { title: string; creator: string; license: string; source: string };

type MaterialDetail = {
  id: string;
  name: string;
  casNumber: string | null;
  category: string | null;
  description: string | null;
  olfactoryFamily: string | null;
  pyramidNote: string | null;
  manufacturer: string | null;
  costPerGram: string | null;
  tenacityHours: string | null;
  slug: string | null;
  imageUrl: string | null;
  ownedGrams: number;
  minQuantityGrams: number | null;
  stockLocation: string | null;
};

type IfraLimit = {
  id: string;
  maxPercent: string;
  categoryCode: string;
  categoryLabel: string;
};

type IfraStandardLimit = {
  categoryCode: string;
  maxPercent: string | null;
  unrestricted: boolean;
};

type IfraStandardView = {
  id: string;
  code: string;
  name: string;
  amendment: number | null;
  standardType: string;
  riskDrivers: string | null;
  deadlineExisting: string | null;
  deadlineNew: string | null;
  synonyms: string[];
  flavorNote: string | null;
  phototoxicityNote: string | null;
  restrictionNote: string | null;
  specificationNote: string | null;
  otherSources: string | null;
  otherSourcesNote: string | null;
  casNumbers: string[];
  limits: IfraStandardLimit[];
};

type IfraMaterialPayload = {
  limits: IfraLimit[];
  standards: IfraStandardView[];
};

type TabId = 'overview' | 'ifra' | 'stock';

function formatIfraPercent(value: string | null, unrestricted: boolean, unrestrictedLabel: string) {
  if (unrestricted) return unrestrictedLabel;
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  if (numeric !== 0 && Math.abs(numeric) < 0.01) return `${numeric}%`;
  return `${numeric.toFixed(2)}%`;
}

function noteLabel(note: string | null, t: (k: string) => string) {
  if (note === 'middle') return t('catalog.heart');
  if (note === 'top') return t('catalog.top');
  if (note === 'base') return t('catalog.base');
  if (note === 'modifier') return t('catalog.other');
  return note ?? '—';
}

export function MaterialDetailPage() {
  const { materialId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const setActiveFormulaId = useFormulaStore((s) => s.setActiveFormulaId);
  const [tab, setTab] = useState<TabId>('overview');
  const navState = location.state as { from?: string; fromLabel?: string } | null;
  const backTo = navState?.from ?? '/catalog';
  const backLabel = navState?.fromLabel
    ? t('material.backTo', { target: navState.fromLabel })
    : t('material.back');
  const [photoCredits, setPhotoCredits] = useState<Record<string, PhotoCredit>>({});

  useEffect(() => {
    let cancelled = false;
    void fetch('/media/materials/credits.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, PhotoCredit>) => {
        if (!cancelled) setPhotoCredits(data);
      })
      .catch(() => {
        if (!cancelled) setPhotoCredits({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog', 'material', materialId],
    queryFn: () => api.get<MaterialDetail>(`/catalog/materials/${materialId}`),
    enabled: !!materialId,
  });

  const { data: ifra } = useQuery({
    queryKey: ['ifra', 'limits', data?.id],
    queryFn: () => api.get<IfraMaterialPayload>(`/ifra/materials/${data!.id}/limits`),
    enabled: !!data?.id && tab === 'ifra',
  });

  const addToFormula = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const formulas =
        await api.get<Array<{ id: string; name: string; slug?: string | null }>>('/formulas');
      let formulaId = formulas[0]?.id;
      let formulaSlug = formulas[0]?.slug ?? null;
      if (!formulaId) {
        const created = await api.post<{ id: string; slug?: string | null }>('/formulas', {
          name: `Untitled formula ${new Date().toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          status: 'draft',
          lines: [],
          batchTargetGrams: useAuthStore.getState().user?.defaultBatchTargetGrams,
          concentrationPct: useAuthStore.getState().user?.defaultConcentrationPct,
        });
        formulaId = created.id;
        formulaSlug = created.slug ?? null;
      }
      const detail = await api.get<{
        id: string;
        slug?: string | null;
        lines: Array<{
          materialId: string;
          percent: string;
          sortOrder: number;
          pyramidNote: string | null;
        }>;
      }>(`/formulas/${formulaId}`);
      formulaSlug = detail.slug ?? formulaSlug;
      if (!detail.lines.some((l) => l.materialId === data.id)) {
        await api.put(`/formulas/${formulaId}/lines`, {
          lines: [
            ...detail.lines.map((l, idx) => ({
              materialId: l.materialId,
              percent: Number(l.percent),
              sortOrder: idx,
              pyramidNote: l.pyramidNote ?? undefined,
            })),
            {
              materialId: data.id,
              percent: 0,
              sortOrder: detail.lines.length,
              pyramidNote: data.pyramidNote ?? undefined,
            },
          ],
        });
      }
      return { id: formulaId, slug: formulaSlug };
    },
    onSuccess: async (created) => {
      if (!created) return;
      setActiveFormulaId(created.id);
      await qc.invalidateQueries({ queryKey: ['formulas'] });
      navigate(`/workbench?formula=${encodeURIComponent(created.slug || created.id)}`);
    },
  });

  const metrics = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: t('material.costPerG'),
        value: data.costPerGram != null ? `$${Number(data.costPerGram).toFixed(3)}` : '—',
      },
      { label: t('material.owned'), value: `${data.ownedGrams.toFixed(1)} g` },
      { label: t('catalog.family'), value: data.olfactoryFamily ?? '—' },
      { label: t('catalog.note'), value: noteLabel(data.pyramidNote, t) },
      { label: 'CAS', value: data.casNumber ?? '—' },
      {
        label: t('material.tenacity'),
        value: data.tenacityHours != null ? `${data.tenacityHours} h` : '—',
      },
    ];
  }, [data, t]);

  if (isLoading) {
    return <p className="fc-muted">{t('catalog.loading')}</p>;
  }
  if (isError || !data) {
    return (
      <div>
        <p className="fc-muted">{t('material.notFound')}</p>
        <Link to={backTo}>{backLabel}</Link>
      </div>
    );
  }

  const tags = [
    data.manufacturer,
    data.olfactoryFamily,
    noteLabel(data.pyramidNote, t),
    data.category,
  ].filter(Boolean) as string[];

  const creditKey =
    data.slug ??
    (data.imageUrl?.includes('/photos/')
      ? (data.imageUrl.match(/\/([^/]+)\.jpe?g$/i)?.[1] ?? null)
      : null);
  const credit =
    creditKey && data.imageUrl?.includes('/photos/') ? (photoCredits[creditKey] ?? null) : null;

  return (
    <div className={styles.page}>
      <Link to={backTo} className={styles.back}>
        ← {backLabel}
      </Link>

      <header className={styles.header}>
        <div className={styles.hero}>
          <MaterialAvatar
            name={data.name}
            family={data.olfactoryFamily}
            imageUrl={data.imageUrl}
            size={72}
          />
          <div>
            <p className={styles.eyebrow}>{data.manufacturer ?? t('catalog.title')}</p>
            <h1 className="fc-page-title">{data.name}</h1>
            <div className={styles.tags}>
              {tags.map((tag) => (
                <span key={tag} className="fc-chip">
                  {tag}
                </span>
              ))}
            </div>
            {credit ? (
              <p className={styles.photoCredit}>
                {t('material.photoCredit', {
                  creator: credit.creator || credit.title,
                  license: credit.license,
                })}
              </p>
            ) : null}
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="fc-btn fc-btn--primary"
            disabled={addToFormula.isPending}
            onClick={() => void addToFormula.mutateAsync()}
          >
            {t('material.addToFormula')}
          </button>
          <Link to="/workbench" className="fc-btn fc-btn--ghost">
            {t('material.openWorkbench')}
          </Link>
        </div>
      </header>

      <div className={styles.metrics}>
        {metrics.map((m) => (
          <div key={m.label} className={styles.metric}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ['overview', t('material.tabOverview')],
            ['ifra', t('material.tabIfra')],
            ['stock', t('material.tabStock')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`fc-card ${styles.panel}`} role="tabpanel">
        {tab === 'overview' ? (
          <div className={styles.overview}>
            <p>{data.description?.trim() || t('material.noDescription')}</p>
            <div className={styles.noteViz} data-note={data.pyramidNote ?? 'middle'}>
              <span className={styles.noteTop}>{t('catalog.top')}</span>
              <span className={styles.noteHeart}>{t('catalog.heart')}</span>
              <span className={styles.noteBase}>{t('catalog.base')}</span>
            </div>
          </div>
        ) : null}
        {tab === 'ifra' ? (
          <div className={styles.ifraPanel}>
            {(ifra?.standards ?? []).length === 0 && (ifra?.limits ?? []).length === 0 ? (
              <p className="fc-muted">{t('material.noIfra')}</p>
            ) : null}
            {(ifra?.standards ?? []).map((standard) => (
              <article key={standard.id} className={styles.ifraStandard}>
                {standard.standardType === 'PROHIBITION' ? (
                  <p className={styles.ifraBanner}>{t('material.ifraProhibited')}</p>
                ) : null}
                <header className={styles.ifraHead}>
                  <h3>{standard.code}</h3>
                  <p>
                    {t(`material.ifraType.${standard.standardType}`, {
                      defaultValue: standard.standardType,
                    })}
                    {standard.amendment != null
                      ? ` · ${t('material.ifraAmendment', { amendment: standard.amendment })}`
                      : ''}
                  </p>
                  {standard.riskDrivers ? (
                    <p>
                      {t('material.ifraRisk')}: {standard.riskDrivers}
                    </p>
                  ) : null}
                </header>
                <dl className={styles.ifraMeta}>
                  {standard.casNumbers.length > 0 ? (
                    <div>
                      <dt>{t('material.ifraCas')}</dt>
                      <dd>{standard.casNumbers.join(', ')}</dd>
                    </div>
                  ) : null}
                  {standard.synonyms.length > 0 ? (
                    <div>
                      <dt>{t('material.ifraSynonyms')}</dt>
                      <dd>{standard.synonyms.join(' · ')}</dd>
                    </div>
                  ) : null}
                  {standard.deadlineNew || standard.deadlineExisting ? (
                    <div>
                      <dt>{t('material.ifraDeadlines')}</dt>
                      <dd>
                        {[standard.deadlineNew, standard.deadlineExisting]
                          .filter(Boolean)
                          .join(' · ')}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {standard.standardType !== 'PROHIBITION' && standard.limits.length > 0 ? (
                  <>
                    {standard.limits
                      .filter((row) => row.categoryCode === '4')
                      .map((row) => (
                        <div key="cat4" className={styles.ifraFeatured}>
                          <span>{t('material.ifraCat4Title')}</span>
                          <strong>
                            {formatIfraPercent(
                              row.maxPercent,
                              row.unrestricted,
                              t('material.ifraNoRestriction'),
                            )}
                          </strong>
                          <p>{t('material.ifraCat4Hint')}</p>
                        </div>
                      ))}
                    <ul className={styles.ifraGrid}>
                      {standard.limits.map((row) => (
                        <li
                          key={row.categoryCode}
                          className={row.categoryCode === '4' ? styles.ifraPrimary : undefined}
                        >
                          <span>{row.categoryCode}</span>
                          <strong>
                            {formatIfraPercent(
                              row.maxPercent,
                              row.unrestricted,
                              t('material.ifraNoRestriction'),
                            )}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <div className={styles.ifraNotes}>
                  {(
                    [
                      ['material.ifraFlavor', standard.flavorNote],
                      ['material.ifraPhototoxicity', standard.phototoxicityNote],
                      ['material.ifraRestrictionNote', standard.restrictionNote],
                      ['material.ifraSpecification', standard.specificationNote],
                      ['material.ifraOtherSources', standard.otherSources],
                    ] as const
                  )
                    .filter(([, note]) => note && note.trim())
                    .map(([key, note]) => (
                      <p key={key}>
                        <strong>{t(key)}. </strong>
                        {note}
                      </p>
                    ))}
                </div>
              </article>
            ))}
            {(ifra?.standards ?? []).length === 0 && (ifra?.limits ?? []).length > 0 ? (
              <ul className={styles.ifraList}>
                {(ifra?.limits ?? []).map((row) => (
                  <li key={row.id}>
                    <strong>
                      {row.categoryCode} — {row.categoryLabel}
                    </strong>
                    <span>{formatIfraPercent(row.maxPercent, false, '')}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {tab === 'stock' ? (
          <div className={styles.stock}>
            <p>
              <strong>{t('material.owned')}:</strong> {data.ownedGrams.toFixed(2)} g
            </p>
            <p>
              <strong>{t('material.minStock')}:</strong>{' '}
              {data.minQuantityGrams != null ? `${data.minQuantityGrams.toFixed(2)} g` : '—'}
            </p>
            <p>
              <strong>{t('material.location')}:</strong> {data.stockLocation ?? '—'}
            </p>
            <Link to="/inventory" className="fc-btn fc-btn--ghost">
              {t('material.manageInventory')}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
