import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import styles from './OpenFormulas.module.css';

type OpenCard = {
  token: string;
  name: string;
  description: string | null;
  authorName: string | null;
  publishedAt: string | null;
};

export function OpenLibraryPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const { data, isLoading } = useQuery({
    queryKey: ['open-formulas'],
    queryFn: () => api.get<OpenCard[]>('/open-formulas'),
  });

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <Link to={user ? '/' : '/'}>
          <strong>{t('common.appName')}</strong>
        </Link>
        <Link className="fc-btn fc-btn--ghost" to={user ? '/' : '/auth'}>
          {user ? t('openFormula.backToLab') : t('openFormula.signIn')}
        </Link>
      </header>
      <p className={styles.kicker}>{t('openFormula.kicker')}</p>
      <h1>{t('openFormula.libraryTitle')}</h1>
      <p>{t('openFormula.libraryLead')}</p>
      {isLoading ? <p>{t('common.loading')}</p> : null}
      {!isLoading && (data?.length ?? 0) === 0 ? <p>{t('openFormula.emptyLibrary')}</p> : null}
      <div className={styles.list}>
        {(data ?? []).map((formula) => (
          <article key={formula.token} className={`fc-card ${styles.card}`}>
            <h2>
              <Link to={`/open/${formula.token}`}>{formula.name}</Link>
            </h2>
            {formula.description ? <p>{formula.description}</p> : null}
            <p className={styles.meta}>
              {formula.authorName ? t('openFormula.by', { name: formula.authorName }) : null}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
