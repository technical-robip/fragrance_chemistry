import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FEATURE_KEYS, QUOTA_KEYS, type FeatureKey, type QuotaKey } from '@fc/shared';
import { api } from '@/lib/api-client';
import styles from './AdminLayout.module.css';

type PlanDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  reserved: boolean;
  subscriberCount: number;
  quotas: Record<QuotaKey, number | null>;
  features: Record<FeatureKey, boolean>;
};

export function AdminPlanDetailPage() {
  const { t } = useTranslation();
  const { planId } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'plan', planId],
    queryFn: () => api.get<PlanDetail>(`/admin/plans/${planId}`),
    enabled: !!planId,
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [quotas, setQuotas] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setDescription(data.description ?? '');
    setIsActive(data.isActive);
    setQuotas(
      Object.fromEntries(
        QUOTA_KEYS.map((key) => [key, data.quotas[key] == null ? '' : String(data.quotas[key])]),
      ),
    );
    setFeatures(data.features);
  }, [data]);

  const saveMeta = useMutation({
    mutationFn: () => api.patch(`/admin/plans/${planId}`, { name, description, isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plan', planId] }),
  });

  const saveQuotas = useMutation({
    mutationFn: () =>
      api.put(`/admin/plans/${planId}/quotas`, {
        quotas: Object.fromEntries(
          QUOTA_KEYS.map((key) => [key, quotas[key] === '' ? null : Number(quotas[key])]),
        ),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plan', planId] }),
  });

  const saveFeatures = useMutation({
    mutationFn: () => api.put(`/admin/plans/${planId}/features`, { features }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plan', planId] }),
  });

  if (isLoading || !data) return <p className="fc-muted">{t('common.loading')}</p>;

  return (
    <div className={styles.form}>
      <p>
        <Link to="/admin/plans">{t('admin.backPlans')}</Link>
      </p>
      <form
        className={`fc-card ${styles.card} ${styles.form}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          saveMeta.mutate();
        }}
      >
        <h2>{data.name}</h2>
        <p className="fc-muted">
          {data.slug} · {t('admin.subscribers')}: {data.subscriberCount}
        </p>
        <label className="fc-label">
          {t('admin.planName')}
          <input className="fc-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="fc-label">
          {t('admin.description')}
          <textarea
            className="fc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={styles.toggleRow}>
          <span>{t('admin.active')}</span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </label>
        <button type="submit" className="fc-btn fc-btn--primary">
          {t('admin.savePlan')}
        </button>
      </form>

      <form
        className={`fc-card ${styles.card} ${styles.form}`}
        onSubmit={(e) => {
          e.preventDefault();
          saveQuotas.mutate();
        }}
      >
        <h2>{t('admin.quotas')}</h2>
        {QUOTA_KEYS.map((key) => (
          <label key={key} className="fc-label">
            {t(`account.quotas.${key}`)}
            <input
              className="fc-input"
              type="number"
              min={0}
              placeholder={t('account.unlimitedShort')}
              value={quotas[key] ?? ''}
              onChange={(e) => setQuotas((s) => ({ ...s, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" className="fc-btn fc-btn--primary">
          {t('admin.saveQuotas')}
        </button>
      </form>

      <form
        className={`fc-card ${styles.card} ${styles.form}`}
        onSubmit={(e) => {
          e.preventDefault();
          saveFeatures.mutate();
        }}
      >
        <h2>{t('admin.features')}</h2>
        {FEATURE_KEYS.map((key) => (
          <label key={key} className={styles.toggleRow}>
            <span>{t(`account.features.${key}`)}</span>
            <input
              type="checkbox"
              checked={Boolean(features[key])}
              onChange={(e) => setFeatures((s) => ({ ...s, [key]: e.target.checked }))}
            />
          </label>
        ))}
        <button type="submit" className="fc-btn fc-btn--primary">
          {t('admin.saveFeatures')}
        </button>
      </form>
    </div>
  );
}
