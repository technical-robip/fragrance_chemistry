import { useTranslation } from 'react-i18next';
import { IconCheck } from './icons';
import styles from './LandingPage.module.css';
import audience from './AudienceSheet.module.css';

function Column({ which }: { which: 'indie' | 'enthusiast' }) {
  const { t } = useTranslation();
  const points = t(`landing.audience.${which}.points`, { returnObjects: true }) as string[];

  return (
    <div className={audience.column}>
      <h3 className={`${styles.heading} ${audience.title}`}>
        {t(`landing.audience.${which}.title`)}
      </h3>
      <p className={styles.body}>{t(`landing.audience.${which}.body`)}</p>
      <ul className={audience.points}>
        {points.map((point) => (
          <li key={point}>
            <IconCheck size={16} />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AudienceSheet() {
  const { t } = useTranslation();

  return (
    <section className={`${styles.sheet} ${audience.sheet}`} aria-labelledby="audience-label">
      <p id="audience-label" className={styles.hangingLabel}>
        {t('landing.audience.label')}
      </p>

      <div className={audience.spread}>
        <Column which="indie" />
        <Column which="enthusiast" />
      </div>

      {/* The secondary audience, kept subordinate rather than made a third column. */}
      <aside className={audience.secondary}>
        <h3 className={audience.secondaryTitle}>{t('landing.audience.supplier.title')}</h3>
        <p className={audience.secondaryBody}>{t('landing.audience.supplier.body')}</p>
      </aside>
    </section>
  );
}
