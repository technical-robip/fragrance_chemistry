import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import styles from './AdminLayout.module.css';

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  subscriberCount: number;
  reserved: boolean;
};

export function AdminPlansPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get<PlanRow[]>('/admin/plans'),
  });
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/admin/plans', { name, slug }),
    onSuccess: async () => {
      setName('');
      setSlug('');
      await qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });

  return (
    <div>
      <form
        className={`${styles.filters} fc-card ${styles.card}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="fc-input"
          placeholder={t('admin.planName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="fc-input"
          placeholder={t('admin.planSlug')}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button type="submit" className="fc-btn fc-btn--primary">
          {t('admin.createPlan')}
        </button>
      </form>
      {isLoading ? <p className="fc-muted">{t('common.loading')}</p> : null}
      <div className={`fc-card ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('admin.planName')}</th>
              <th>slug</th>
              <th>{t('admin.subscribers')}</th>
              <th>{t('admin.status')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={`/admin/plans/${row.id}`}>{row.name}</Link>
                </td>
                <td>{row.slug}</td>
                <td>{row.subscriberCount}</td>
                <td>{row.isActive ? t('admin.active') : t('admin.inactive')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
