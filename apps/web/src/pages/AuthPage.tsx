import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Invalid credentials or lab access denied.');
      } else if (err instanceof Error && err.message.includes('VITE_API_URL')) {
        setError('API URL is not configured. Set VITE_API_URL in your environment.');
      } else {
        setError('Could not reach the formulation server.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`fc-card ${styles.card}`}>
        <p className={styles.kicker}>Secure lab access</p>
        <h1 className="fc-page-title">Sign in</h1>
        <p className="fc-muted">
          JWT session against your configured API — no secrets in the client bundle.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className="fc-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="fc-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="fc-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="fc-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className="fc-btn fc-btn--primary" disabled={pending}>
            {pending ? 'Authenticating…' : 'Enter lab'}
          </button>
        </form>
      </div>
    </div>
  );
}
