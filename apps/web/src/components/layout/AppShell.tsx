import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import styles from './AppShell.module.css';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/catalog', label: 'Catalog' },
  { to: '/workbench', label: 'Workbench' },
  { to: '/weighing', label: 'Live weighing' },
  { to: '/costing', label: 'Costing' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/evaluation', label: 'Evaluation' },
  { to: '/encyclopedia', label: 'Encyclopedia' },
  { to: '/suppliers', label: 'Suppliers' },
];

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>Fc</span>
          <div>
            <strong>Fragrance Chemistry</strong>
            <span className={styles.brandSub}>Formulation lab</span>
          </div>
        </div>
        <nav className={styles.nav}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.linkActive}` : styles.link
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.user}>
          <span>{user?.displayName ?? user?.email}</span>
          <button type="button" className="fc-btn fc-btn--ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
