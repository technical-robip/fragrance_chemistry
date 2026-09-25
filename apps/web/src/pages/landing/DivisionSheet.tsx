import { useTranslation } from 'react-i18next';
import { DIVISIONS, type DivisionId } from './manual';
import styles from './LandingPage.module.css';
import division from './DivisionSheet.module.css';

const HUE = Object.fromEntries(DIVISIONS.map((d) => [d.id, d.hue])) as Record<DivisionId, string>;

/**
 * One division of the manual: a board in the division's hue with the prose on
 * it, and the acetate leaf carrying the computed side. `flip` alternates which
 * edge the leaf is hinged from, so the scroll paces like a book rather than a
 * stack of identical bands.
 */
export function DivisionSheet({
  id,
  icon,
  leaf,
  flip = false,
}: {
  id: DivisionId;
  icon: React.ReactNode;
  leaf: React.ReactNode;
  flip?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section
      id={id}
      className={`${styles.sheet} ${division.sheet} ${flip ? division.flip : ''}`}
      style={{ '--division-hue': HUE[id] } as React.CSSProperties}
      aria-labelledby={`${id}-title`}
    >
      <p className={styles.hangingLabel}>
        <span className={division.tabMark}>{icon}</span>
        {t(`landing.divisions.${id}.tab`)}
      </p>

      <div className={division.prose}>
        <h2 id={`${id}-title`} className={`${styles.heading} ${division.title}`}>
          {t(`landing.divisions.${id}.title`)}
        </h2>
        <p className={styles.body}>{t(`landing.divisions.${id}.body`)}</p>
      </div>

      <div className={division.plate}>{leaf}</div>
    </section>
  );
}
