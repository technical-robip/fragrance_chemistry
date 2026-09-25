import { useTranslation } from 'react-i18next';
import styles from './LandingPage.module.css';
import errata from './ErrataSheet.module.css';

type ErrataItem = { term: string; body: string };

export function ErrataSheet() {
  const { t } = useTranslation();
  const items = t('landing.errata.items', { returnObjects: true }) as ErrataItem[];

  return (
    <section className={`${styles.sheet} ${errata.sheet}`}>
      <p className={styles.hangingLabel}>{t('landing.errata.label')}</p>

      <div className={errata.slipWrap}>
        <div className={styles.slip}>
          <span className={styles.slipLabel}>{t('landing.errata.label')}</span>
          <h2 className={`${styles.heading} ${errata.title}`}>{t('landing.errata.title')}</h2>

          <dl className={errata.list}>
            {items.map((item, index) => (
              <div key={item.term} className={errata.entry}>
                <dt className={errata.term}>
                  <span className={errata.index}>{index + 1}</span>
                  {item.term}
                </dt>
                <dd className={errata.body}>{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
