import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { FcSelect } from '@/components/FcSelect';
import styles from './AdminLayout.module.css';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  status: string;
  planName: string | null;
};

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (role) search.set('role', role);
    if (plan) search.set('plan', plan);
    if (status) search.set('status', status);
    const qs = search.toString();
    return qs ? `?${qs}` : '';
  }, [q, role, plan, status]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get<{ total: number; items: UserRow[] }>(`/admin/users${params}`),
  });

  return (
    <div>
      <div className={styles.filters}>
        <input
          className="fc-input"
          placeholder={t('admin.searchUsers')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FcSelect
          className={styles.filterSelect}
          aria-label={t('admin.anyRole')}
          options={[
            { value: '', label: t('admin.anyRole') },
            { value: 'enthusiast', label: t('account.roleEnthusiast') },
            { value: 'perfumer', label: t('account.rolePerfumer') },
            { value: 'supplier', label: t('account.roleSupplier') },
            { value: 'admin', label: t('account.roleAdmin') },
          ]}
          value={role}
          onChange={(v) => setRole(v ?? '')}
          platform="web"
        />
        <FcSelect
          className={styles.filterSelect}
          aria-label={t('admin.anyPlan')}
          options={[
            { value: '', label: t('admin.anyPlan') },
            { value: 'free', label: 'Free' },
            { value: 'pro', label: 'Pro' },
            { value: 'enterprise', label: 'Enterprise' },
          ]}
          value={plan}
          onChange={(v) => setPlan(v ?? '')}
          platform="web"
        />
        <FcSelect
          className={styles.filterSelect}
          aria-label={t('admin.anyStatus')}
          options={[
            { value: '', label: t('admin.anyStatus') },
            { value: 'active', label: t('admin.active') },
            { value: 'disabled', label: t('admin.inactive') },
          ]}
          value={status}
          onChange={(v) => setStatus(v ?? '')}
          platform="web"
        />
      </div>
      {isLoading ? <p className="fc-muted">{t('common.loading')}</p> : null}
      <div className={`fc-card ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('auth.displayName')}</th>
              <th>{t('auth.email')}</th>
              <th>{t('account.role')}</th>
              <th>{t('account.subscription')}</th>
              <th>{t('admin.status')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={`/admin/users/${row.id}`}>{row.displayName}</Link>
                </td>
                <td>{row.email}</td>
                <td>{row.role}</td>
                <td>{row.planName ?? row.plan}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
