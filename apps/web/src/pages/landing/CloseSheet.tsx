import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DIVISIONS } from './manual';
import { IconArrowRight, IconManual } from './icons';
import styles from './LandingPage.module.css';
import close from './CloseSheet.module.css';

/** The back cover: the last action, then the colophon strip. */
export function CloseSheet() {
  const { t } = useTranslation();

  return (
    <section className={`${styles.sheet} ${close.sheet}`} aria-labelledby="close-title">
      <div className={close.block}>
        <h2 id="close-title" className={`${styles.heading} ${close.title}`}>
          {t('landing.close.title')}
        </h2>
        <p className={`${styles.body} ${close.body}`}>{t('landing.close.body')}</p>

        <div className={close.actions}>
          <Link to="/auth?mode=register" className={styles.action}>
            {t('landing.close.ctaPrimary')}
            <IconArrowRight />
          </Link>
          <Link to="/auth" className={styles.actionQuiet}>
            {t('landing.close.ctaSecondary')}
          </Link>
        </div>

        <p className={close.beta}>{t('landing.close.beta')}</p>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className={`${styles.sheet} ${close.footer}`}>
      <div className={close.footerBrand}>
        <span className={close.footerMark} aria-hidden>
          <IconManual size={18} />
        </span>
        <div>
          <p className={close.footerName}>{t('common.appName')}</p>
          <p className={close.footerMeta}>{t('landing.footer.license')}</p>
          <p className={close.footerMeta}>{t('landing.footer.builtWith')}</p>
          <p className={close.footerMeta}>{t('landing.footer.beta')}</p>
        </div>
      </div>

      <nav className={close.footerNav} aria-label={t('landing.footer.productSections')}>
        <h2 className={close.footerHeading}>{t('landing.footer.productSections')}</h2>
        <ul>
          {DIVISIONS.map((division) => (
            <li key={division.id}>
              <a href={`#${division.id}`}>{t(`landing.divisions.${division.id}.tab`)}</a>
            </li>
          ))}
        </ul>
      </nav>

      <nav className={close.footerNav} aria-label={t('landing.footer.account')}>
        <h2 className={close.footerHeading}>{t('landing.footer.account')}</h2>
        <ul>
          <li>
            <Link to="/auth?mode=register">{t('landing.header.startFree')}</Link>
          </li>
          <li>
            <Link to="/auth">{t('landing.header.signIn')}</Link>
          </li>
          <li>
            <a href="#plans">{t('landing.plans.label')}</a>
          </li>
        </ul>
      </nav>

      <p className={close.legal}>{t('landing.footer.legalNote')}</p>
    </footer>
  );
}
