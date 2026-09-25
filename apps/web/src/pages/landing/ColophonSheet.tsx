import { useTranslation } from 'react-i18next';
import styles from './LandingPage.module.css';
import colophon from './ColophonSheet.module.css';

type Row = { term: string; value: string; note: string };

/**
 * The imprint page: every figure here is checkable in the repository, and there
 * is deliberately no customer count, testimonial or benchmark among them.
 */
export function ColophonSheet() {
  const { t } = useTranslation();
  const rows = t('landing.colophon.rows', { returnObjects: true }) as Row[];

  return (
    <section className={`${styles.sheet} ${colophon.sheet}`} aria-labelledby="colophon-title">
      <p className={styles.hangingLabel}>{t('landing.colophon.label')}</p>

      <h2 id="colophon-title" className={`${styles.heading} ${colophon.title}`}>
        {t('landing.colophon.title')}
      </h2>

      <dl className={colophon.rows}>
        {rows.map((row) => (
          <div key={row.term} className={colophon.row}>
            <dt className={colophon.term}>{row.term}</dt>
            <dd className={colophon.value}>{row.value}</dd>
            <dd className={colophon.note}>{row.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
