import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, userHasFeature } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { AuthAtmosphere } from '@/components/viz/AuthAtmosphere';
import { useSelectedFormulaUrlKey } from '@/components/FormulaSelector';
import { withLabQuery } from '@/lib/lab-query';
import { BrandMark } from './BrandMark';
import { LanguageMenu } from './LanguageMenu';
import { NotificationBell } from './NotificationBell';
import { ThemeSwitch } from './ThemeSwitch';
import styles from './AppShell.module.css';

const nav = [
  { to: '/', key: 'dashboard', feature: 'dashboard', end: true, carryFormula: true },
  { to: '/catalog', key: 'catalog', feature: 'catalog' },
  { to: '/workbench', key: 'workbench', feature: 'workbench', carryFormula: true, carryEval: true },
  { to: '/weighing', key: 'weighing', feature: 'weighing', carryFormula: true },
  { to: '/costing', key: 'costing', feature: 'costing', carryFormula: true },
  { to: '/inventory', key: 'inventory', feature: 'inventory' },
  {
    to: '/evaluation',
    key: 'evaluation',
    feature: 'evaluation',
    carryFormula: true,
    carryEval: true,
  },
  { to: '/encyclopedia', key: 'encyclopedia', feature: 'encyclopedia' },
  { to: '/suppliers', key: 'suppliers', feature: 'suppliers' },
] as const;

function navFeatureForPath(pathname: string) {
  const ranked = [...nav].sort((a, b) => b.to.length - a.to.length);
  const match = ranked.find((item) => {
    if (item.to === '/') return pathname === '/';
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  });
  return match?.feature;
}

function initials(name?: string, email?: string) {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function Controls() {
  return (
    <div className={`${styles.settingsCluster} ${styles.controls}`}>
      <ThemeSwitch />
      <LanguageMenu />
    </div>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navOpen = useUiStore((s) => s.navOpen);
  const setNavOpen = useUiStore((s) => s.setNavOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const formulaKey = useSelectedFormulaUrlKey();
  const [params] = useSearchParams();
  const evalId = params.get('eval');

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, setNavOpen]);

  // index.html carries the marketing title for crawlers, which only ever see the
  // public landing route; inside the lab the title is the product name.
  useEffect(() => {
    document.title = `${t('common.appName')} · ${t('common.appTagline')}`;
  }, [t]);

  useEffect(() => {
    const required = navFeatureForPath(location.pathname);
    if (required && !userHasFeature(user, required) && location.pathname !== '/account') {
      navigate('/account', { replace: true });
    }
  }, [location.pathname, navigate, user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setNavOpen]);

  useEffect(() => {
    document.body.classList.toggle('fc-nav-lock', navOpen);
    return () => document.body.classList.remove('fc-nav-lock');
  }, [navOpen]);

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.menuBtn}
          aria-expanded={navOpen}
          aria-controls="app-nav-drawer"
          onClick={() => setNavOpen(!navOpen)}
        >
          <span className={styles.menuBars} aria-hidden />
          <span className="fc-sr-only">{t('common.menu')}</span>
        </button>
        <div className={styles.topBrand}>
          <BrandMark />
          <strong>{t('common.appName')}</strong>
        </div>
        {userHasFeature(user, 'evaluation') ? <NotificationBell placement="down" /> : null}
        <NavLink to="/account" className={styles.topAvatar} aria-label={t('nav.account')}>
          {initials(user?.displayName, user?.email)}
        </NavLink>
      </header>

      {navOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={t('common.closeMenu')}
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        id="app-nav-drawer"
        className={`${styles.sidebar} ${navOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarAtmosphere} aria-hidden>
          <AuthAtmosphere compact />
        </div>
        <div className={styles.brand}>
          <BrandMark />
          <div>
            <strong>{t('common.appName')}</strong>
            <span className={styles.brandSub}>{t('common.appTagline')}</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label={t('nav.primary')}>
          {nav
            .filter((item) => userHasFeature(user, item.feature))
            .map((item) => (
              <NavLink
                key={item.to}
                to={
                  'carryFormula' in item && item.carryFormula
                    ? withLabQuery(item.to, {
                        formula: formulaKey,
                        evalId: 'carryEval' in item && item.carryEval ? evalId : null,
                      })
                    : item.to
                }
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
        </nav>
        <div className={styles.user}>
          <Controls />
          <div className={styles.identity}>
            <NavLink to="/account" className={styles.userChip}>
              <span className={styles.avatar}>{initials(user?.displayName, user?.email)}</span>
              <span className={styles.userMeta}>
                <strong>{user?.displayName ?? user?.email}</strong>
                <em>{user?.plan ?? 'free'}</em>
              </span>
            </NavLink>
            {userHasFeature(user, 'evaluation') ? <NotificationBell placement="up" /> : null}
          </div>
          {user?.role === 'admin' ? (
            <NavLink to="/admin" className={styles.adminLink}>
              {t('nav.admin')}
            </NavLink>
          ) : null}
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            onClick={() => {
              void logout();
            }}
          >
            {t('common.signOut')}
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
