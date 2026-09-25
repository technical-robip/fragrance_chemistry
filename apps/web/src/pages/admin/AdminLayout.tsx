import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './AdminLayout.module.css';

const links = [
  { to: '/admin', key: 'overview', end: true },
  { to: '/admin/users', key: 'users' },
  { to: '/admin/plans', key: 'plans' },
] as const;

export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <div>
      <header className={styles.header}>
        <h1 className="fc-page-title">{t('admin.title')}</h1>
        <p className="fc-muted">{t('admin.subtitle')}</p>
      </header>
      <nav className={styles.nav} aria-label={t('admin.navLabel')}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={'end' in link ? link.end : false}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {t(`admin.nav.${link.key}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
