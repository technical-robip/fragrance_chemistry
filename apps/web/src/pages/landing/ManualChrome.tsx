import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch';
import { DIVISIONS, type DivisionId } from './manual';
import styles from './LandingPage.module.css';

/** The bound edge: punch holes and the rotated spine label. */
export function BoundEdge() {
  const { t } = useTranslation();
  return (
    <div className={styles.margin} aria-hidden>
      <div className={styles.holes}>
        <span className={styles.hole} />
        <span className={styles.hole} />
      </div>
      <span className={styles.spine}>{t('landing.spine')}</span>
    </div>
  );
}

/**
 * The fore edge: one tab per division, height proportional to what the division
 * contains, and the current tab extended until it is the board.
 */
export function ForeEdge({ current }: { current: DivisionId | null }) {
  const { t } = useTranslation();
  return (
    <nav className={styles.foreEdge} aria-label={t('landing.header.sections')}>
      {DIVISIONS.map((division) => (
        <a
          key={division.id}
          href={`#${division.id}`}
          className={`${styles.tab} ${current === division.id ? styles.tabCurrent : ''}`}
          style={
            {
              '--tab-hue': division.hue,
              '--tab-extent': division.extent,
            } as React.CSSProperties
          }
          aria-current={current === division.id ? 'true' : undefined}
        >
          {t(`landing.divisions.${division.id}.tab`)}
        </a>
      ))}
    </nav>
  );
}

/** The manual's masthead, sticky above the sheets. */
export function Masthead() {
  const { t } = useTranslation();
  return (
    <header className={styles.masthead}>
      {/* The brand is an identity mark, not a section heading: making it one put
          an h2 above the page's h1 and broke the heading order. */}
      <div className={styles.brand}>
        <span className={styles.brandName}>{t('common.appName')}</span>
        <span className={styles.brandTag}>{t('common.appTagline')}</span>
      </div>

      <nav className={styles.mastheadNav} aria-label={t('landing.header.sections')}>
        {DIVISIONS.map((division) => (
          <a key={division.id} href={`#${division.id}`} className={styles.mastheadLink}>
            {t(`landing.divisions.${division.id}.tab`)}
          </a>
        ))}
        <a href="#plans" className={styles.mastheadLink}>
          {t('landing.plans.label')}
        </a>
      </nav>

      <div className={styles.mastheadActions}>
        <ThemeSwitch />
        <LanguageMenu placement="down" />
        <Link to="/auth" className={styles.actionQuiet}>
          {t('landing.header.signIn')}
        </Link>
        <Link to="/auth?mode=register" className={styles.action}>
          {t('landing.header.startFree')}
        </Link>
      </div>
    </header>
  );
}
