import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import styles from './AdminLayout.module.css';

type Overview = {
  users: { total: number; active: number; disabled: number };
  byPlan: Array<{ plan: string; count: number }>;
  expiringSubscriptions: Array<{ id: string; email: string; planName: string; endsAt: string }>;
  recentUsers: Array<{ id: string; email: string; displayName: string; plan: string }>;
};

export function AdminOverviewPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<Overview>('/admin/overview'),
  });

  if (isLoading || !data) return <p className="fc-muted">{t('common.loading')}</p>;

  return (
    <div className={styles.grid}>
      <article className={`fc-card ${styles.card}`}>
        <h2>{t('admin.usersTitle')}</h2>
        <p>{t('admin.userCounts', data.users)}</p>
      </article>
      <article className={`fc-card ${styles.card}`}>
        <h2>{t('admin.plansTitle')}</h2>
        <ul>
          {data.byPlan.map((row) => (
            <li key={row.plan}>
              {row.plan}: {row.count}
            </li>
          ))}
        </ul>
      </article>
      <article className={`fc-card ${styles.card}`}>
        <h2>{t('admin.recent')}</h2>
        <ul>
          {data.recentUsers.map((u) => (
            <li key={u.id}>
              <Link to={`/admin/users/${u.id}`}>{u.displayName}</Link> · {u.plan}
            </li>
          ))}
        </ul>
      </article>
      <article className={`fc-card ${styles.card}`}>
        <h2>{t('admin.expiring')}</h2>
        {data.expiringSubscriptions.length === 0 ? (
          <p className="fc-muted">{t('admin.noneExpiring')}</p>
        ) : (
          <ul>
            {data.expiringSubscriptions.map((row) => (
              <li key={row.id}>
                {row.email} · {row.planName}
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
