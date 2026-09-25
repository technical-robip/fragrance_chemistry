import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FEATURE_KEYS, QUOTA_KEYS, type QuotaKey } from '@fc/shared';
import { ApiError, api } from '@/lib/api-client';
import { FcSelect } from '@/components/FcSelect';
import styles from './AdminLayout.module.css';

type Detail = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    plan: string;
    status: string;
    createdAt: string;
  };
  entitlements: {
    plan: { id: string; slug: string; name: string };
    subscription: {
      status: string;
      startsAt: string;
      endsAt: string | null;
      note: string | null;
    } | null;
    quotas: Record<QuotaKey, number | null>;
    features: string[];
  };
};

type PlanOption = { id: string; slug: string; name: string };

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyOverrideMap() {
  return Object.fromEntries(QUOTA_KEYS.map((key) => [key, ''])) as Record<QuotaKey, string>;
}

export function AdminUserDetailPage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => api.get<Detail>(`/admin/users/${userId}`),
    enabled: !!userId,
  });
  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get<PlanOption[]>('/admin/plans'),
  });

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('enthusiast');
  const [status, setStatus] = useState('active');
  const [planId, setPlanId] = useState('');
  const [subStatus, setSubStatus] = useState('active');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');
  const [overrides, setOverrides] = useState<Record<QuotaKey, string>>(emptyOverrideMap);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.user.displayName);
    setEmail(data.user.email);
    setRole(data.user.role);
    setStatus(data.user.status);
    setPlanId(data.entitlements.plan.id);
    setSubStatus(data.entitlements.subscription?.status ?? 'active');
    setStartsAt(toLocalInput(data.entitlements.subscription?.startsAt));
    setEndsAt(toLocalInput(data.entitlements.subscription?.endsAt));
    setNote(data.entitlements.subscription?.note ?? '');
    setOverrides(emptyOverrideMap());
  }, [data]);

  const saveUser = useMutation({
    mutationFn: () => api.patch(`/admin/users/${userId}`, { displayName, email, role, status }),
    onSuccess: async () => {
      setMessage(t('account.saved'));
      await qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? t('account.saveFailed') : t('auth.unreachable'));
    },
  });

  const assign = useMutation({
    mutationFn: () => {
      const quotaOverrides = Object.fromEntries(
        QUOTA_KEYS.filter((key) => overrides[key] !== '').map((key) => [
          key,
          Number(overrides[key]),
        ]),
      );
      return api.post(`/admin/users/${userId}/subscription`, {
        planId,
        status: subStatus,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        quotaOverrides,
        note: note.trim() || null,
      });
    },
    onSuccess: async () => {
      setMessage(t('admin.subscriptionUpdated'));
      await qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? t('account.saveFailed') : t('auth.unreachable'));
    },
  });

  const resetPassword = useMutation({
    mutationFn: () => api.post(`/admin/users/${userId}/password`, { password }),
    onSuccess: () => setMessage(t('admin.passwordReset')),
  });

  if (isLoading || !data) return <p className="fc-muted">{t('common.loading')}</p>;

  return (
    <div className={styles.form}>
      <p>
        <Link to="/admin/users">{t('admin.backUsers')}</Link>
      </p>
      {message ? <p className={styles.ok}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <form
        className={`fc-card ${styles.card} ${styles.form}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          saveUser.mutate();
        }}
      >
        <h2>{data.user.displayName}</h2>
        <label className="fc-label">
          {t('auth.displayName')}
          <input
            className="fc-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="fc-label">
          {t('auth.email')}
          <input className="fc-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="fc-label" htmlFor="admin-user-role">
          {t('account.role')}
        </label>
        <FcSelect
          inputId="admin-user-role"
          aria-label={t('account.role')}
          options={[
            { value: 'enthusiast', label: t('account.roleEnthusiast') },
            { value: 'perfumer', label: t('account.rolePerfumer') },
            { value: 'supplier', label: t('account.roleSupplier') },
            { value: 'admin', label: t('account.roleAdmin') },
          ]}
          value={role}
          onChange={(v) => v && setRole(v)}
          platform="web"
        />
        <label className="fc-label" htmlFor="admin-user-status">
          {t('admin.status')}
        </label>
        <FcSelect
          inputId="admin-user-status"
          aria-label={t('admin.status')}
          options={[
            { value: 'active', label: t('admin.active') },
            { value: 'disabled', label: t('admin.inactive') },
          ]}
          value={status}
          onChange={(v) => v && setStatus(v)}
          platform="web"
        />
        <button type="submit" className="fc-btn fc-btn--primary">
          {t('account.saveIdentity')}
        </button>
      </form>

      <form
        className={`fc-card ${styles.card} ${styles.form}`}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          assign.mutate();
        }}
      >
        <h2>{t('account.subscription')}</h2>
        <label className="fc-label" htmlFor="admin-user-plan">
          {t('admin.plan')}
        </label>
        <FcSelect
          inputId="admin-user-plan"
          aria-label={t('admin.plan')}
          isSearchable
          options={(plans ?? []).map((p) => ({ value: p.id, label: p.name }))}
          value={planId || null}
          onChange={(v) => v && setPlanId(v)}
          platform="web"
        />
        <label className="fc-label" htmlFor="admin-user-sub-status">
          {t('admin.subscriptionStatus')}
        </label>
        <FcSelect
          inputId="admin-user-sub-status"
          aria-label={t('admin.subscriptionStatus')}
          options={[
            { value: 'active', label: t('admin.active') },
            { value: 'trialing', label: 'trialing' },
            { value: 'past_due', label: 'past_due' },
            { value: 'canceled', label: 'canceled' },
          ]}
          value={subStatus}
          onChange={(v) => v && setSubStatus(v)}
          platform="web"
        />
        <label className="fc-label">
          {t('admin.startsAt')}
          <input
            className="fc-input"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="fc-label">
          {t('admin.endsAt')}
          <input
            className="fc-input"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
        <label className="fc-label">
          {t('admin.note')}
          <textarea className="fc-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <h3>{t('admin.quotaOverrides')}</h3>
        {QUOTA_KEYS.map((key) => (
          <label key={key} className="fc-label">
            {t(`account.quotas.${key}`)}
            <input
              className="fc-input"
              type="number"
              min={0}
              placeholder={`${t('admin.inherit')} · ${data.entitlements.quotas[key] ?? t('account.unlimitedShort')}`}
              value={overrides[key]}
              onChange={(e) => setOverrides((s) => ({ ...s, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" className="fc-btn fc-btn--primary">
          {t('admin.assignPlan')}
        </button>
        <p className="fc-muted">
          {FEATURE_KEYS.filter((k) => data.entitlements.features.includes(k))
            .map((k) => t(`account.features.${k}`))
            .join(', ')}
        </p>
      </form>

      <form
        className={`fc-card ${styles.card} ${styles.form}`}
        onSubmit={(e) => {
          e.preventDefault();
          resetPassword.mutate();
        }}
      >
        <h2>{t('account.security')}</h2>
        <label className="fc-label">
          {t('account.newPassword')}
          <input
            className="fc-input"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className={styles.filters}>
          <button type="submit" className="fc-btn fc-btn--primary">
            {t('admin.resetPassword')}
          </button>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            onClick={() => void api.post(`/admin/users/${userId}/logout-all`)}
          >
            {t('account.signOutAll')}
          </button>
        </div>
      </form>
    </div>
  );
}
