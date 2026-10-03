import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import styles from './OpenFormulas.module.css';

type OpenLine = {
  materialId: string;
  materialName: string;
  percent: number;
  pyramidNote: string | null;
};

type OpenView =
  | { state: 'withdrawn'; canRepublish: boolean }
  | {
      state: 'published';
      token: string;
      name: string;
      description: string | null;
      authorName: string | null;
      publishedAt: string | null;
      stale: boolean;
      lines: OpenLine[];
      canRepublish: boolean;
    };

export function OpenFormulaPage() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['open-formula', token],
    queryFn: () => api.get<OpenView>(`/open-formulas/${token}`),
    enabled: Boolean(token),
  });

  async function cloneFormula() {
    setError(null);
    setBusy(true);
    try {
      const created = await api.post<{ id: string; slug: string }>(
        `/open-formulas/${token}/clone`,
        {},
      );
      await queryClient.invalidateQueries({ queryKey: ['formulas'] });
      navigate(`/workbench?formula=${created.slug || created.id}`);
    } catch {
      setError(t('openFormula.cloneFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <Link to="/open">
          <strong>{t('common.appName')}</strong>
        </Link>
        <Link className="fc-btn fc-btn--ghost" to={user ? '/' : '/auth'}>
          {user ? t('openFormula.backToLab') : t('openFormula.signIn')}
        </Link>
      </header>
      {isLoading ? <p>{t('common.loading')}</p> : null}
      {isError ? <p>{t('openFormula.missing')}</p> : null}
      {data?.state === 'withdrawn' ? (
        <section className={styles.withdrawn}>
          <p className={styles.kicker}>{t('openFormula.kicker')}</p>
          <h1>{t('openFormula.withdrawnTitle')}</h1>
          <p>{t('openFormula.withdrawnBody')}</p>
          <div className={styles.actions}>
            <Link className="fc-btn fc-btn--primary" to="/open">
              {t('openFormula.browse')}
            </Link>
            <Link className="fc-btn fc-btn--ghost" to={user ? '/workbench' : '/auth'}>
              {user ? t('openFormula.startFormula') : t('openFormula.createAccount')}
            </Link>
            {data.canRepublish ? (
              <Link className="fc-btn" to="/workbench">
                {t('openFormula.republish')}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
      {data?.state === 'published' ? (
        <article>
          <p className={styles.kicker}>{t('openFormula.kicker')}</p>
          <h1>{data.name}</h1>
          {data.description ? <p>{data.description}</p> : null}
          <p className={styles.meta}>
            {data.authorName ? t('openFormula.by', { name: data.authorName }) : null}
          </p>
          {data.stale ? <p>{t('openFormula.stalePublic')}</p> : null}
          <table className={styles.lines}>
            <thead>
              <tr>
                <th>{t('openFormula.material')}</th>
                <th>{t('openFormula.percent')}</th>
                <th>{t('openFormula.note')}</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={`${line.materialId}-${line.percent}-${line.materialName}`}>
                  <td>{line.materialName}</td>
                  <td>{line.percent.toFixed(2)}</td>
                  <td>{line.pyramidNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.actions}>
            {user ? (
              <button
                type="button"
                className="fc-btn fc-btn--primary"
                disabled={busy}
                onClick={() => void cloneFormula()}
              >
                {t('openFormula.clone')}
              </button>
            ) : (
              <Link
                className="fc-btn fc-btn--primary"
                to="/auth"
                state={{ from: `/open/${token}` }}
              >
                {t('openFormula.cloneSignIn')}
              </Link>
            )}
            <Link className="fc-btn fc-btn--ghost" to="/open">
              {t('openFormula.browse')}
            </Link>
          </div>
          {error ? <p>{error}</p> : null}
        </article>
      ) : null}
      {error && data?.state === 'withdrawn' ? <p>{error}</p> : null}
    </main>
  );
}
