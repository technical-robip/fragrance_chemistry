import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import styles from './OpenFormulas.module.css';

export function JoinLabPage() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const acceptInvite = useAuthStore((s) => s.acceptInvite);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token);
      navigate('/');
    } catch {
      setError(t('laboratory.inviteInvalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <p className={styles.kicker}>{t('common.appName')}</p>
      <h1>{t('laboratory.joinTitle')}</h1>
      <p>{t('laboratory.joinBody')}</p>
      {error ? <p>{error}</p> : null}
      <div className={styles.actions}>
        {user ? (
          <button
            type="button"
            className="fc-btn fc-btn--primary"
            disabled={busy}
            onClick={() => void join()}
          >
            {t('laboratory.join')}
          </button>
        ) : (
          <Link className="fc-btn fc-btn--primary" to="/auth" state={{ from: `/join/${token}` }}>
            {t('laboratory.joinSignIn')}
          </Link>
        )}
        <Link className="fc-btn fc-btn--ghost" to="/open">
          {t('openFormula.browse')}
        </Link>
      </div>
    </main>
  );
}
