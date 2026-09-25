import { Suspense, lazy, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/auth-store';

const LandingPage = lazy(() =>
  import('@/pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
);

/**
 * `/` serves two audiences: the public marketing surface for visitors and the
 * lab shell for authenticated users. Gating the layout rather than the index
 * route keeps every nested route and nav link untouched, and the landing bundle
 * is split out so the authenticated app never downloads it.
 */
export function RootGate() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="fc-auth-loading">
        <p className="fc-muted">Opening lab notebook…</p>
      </div>
    );
  }

  if (user) {
    return <AppShell />;
  }

  if (location.pathname !== '/') {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return (
    <Suspense fallback={<div className="fc-auth-loading" />}>
      <LandingPage />
    </Suspense>
  );
}
