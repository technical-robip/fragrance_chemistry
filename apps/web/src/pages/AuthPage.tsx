import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';
import { AuthAtmosphere } from '@/components/viz/AuthAtmosphere';
import styles from './AuthPage.module.css';

type Mode = 'login' | 'register';

function AuthBar() {
  const { t } = useTranslation();
  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.home}>
        {t('auth.home')}
      </Link>
      <div className={styles.barActions}>
        <ThemeSwitch />
        <LanguageMenu placement="down" />
      </div>
    </header>
  );
}

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  );
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className={styles.wrap}>
        <AuthAtmosphere />
        <AuthBar />
        <p className={`fc-muted ${styles.loading}`}>{t('common.loading')}</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === 'register') {
        await register(displayName, email, password);
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          mode === 'register'
            ? 'Could not register — email may already be in use.'
            : 'Invalid credentials or lab access denied.',
        );
      } else if (err instanceof Error && err.message.includes('VITE_API_URL')) {
        setError('API URL is not configured. Set VITE_API_URL in your environment.');
      } else {
        setError(t('auth.unreachable'));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <AuthAtmosphere />
      <AuthBar />
      <main className={styles.main}>
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path
                  d="M9 2h6v4l3 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10l3-4V2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </span>
            <div>
              <h1 className={styles.brandName}>{t('common.appName')}</h1>
              <p className={styles.brandTag}>{t('common.appTagline')}</p>
            </div>
          </div>
          <p className={styles.kicker}>{t('auth.secureAccess')}</p>

          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? styles.tabActive : styles.tab}
              onClick={() => setMode('login')}
            >
              {t('auth.signIn')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? styles.tabActive : styles.tab}
              onClick={() => setMode('register')}
            >
              {t('auth.register')}
            </button>
          </div>

          <div className={styles.fields}>
            {mode === 'register' ? (
              <label className={styles.field}>
                <span className="fc-label">{t('auth.displayName')}</span>
                <input
                  className="fc-input"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={1}
                />
              </label>
            ) : null}
            <label className={styles.field}>
              <span className="fc-label">{t('auth.email')}</span>
              <input
                className="fc-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span className="fc-label">{t('auth.password')}</span>
              <input
                className="fc-input"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button
            type="submit"
            className={`fc-btn fc-btn--primary ${styles.submit}`}
            disabled={pending}
          >
            {pending
              ? t('auth.authenticating')
              : mode === 'register'
                ? t('auth.createAccount')
                : t('auth.enterLab')}
          </button>
          <p className={styles.hint}>{t('auth.hint')}</p>
        </form>
      </main>
    </div>
  );
}
