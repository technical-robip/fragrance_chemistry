import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { activeGrams, totalBatchGrams } from '@fc/formula-engine';
import {
  DEMO_BATCH_GRAMS,
  DEMO_CARRIER_ID,
  DEMO_CONCENTRATION_PCT,
  DEMO_LINES,
  SCALE_RESOLUTION_GRAMS,
} from './demo-formula';
import { grams } from './manual';
import { HeroVessel } from './HeroVessel';
import { IconArrowRight } from './icons';
import styles from './LandingPage.module.css';
import hero from './HeroSheet.module.css';

const HERO_LINES = DEMO_LINES.filter((line) => line.id !== DEMO_CARRIER_ID);

export function HeroSheet() {
  const { t } = useTranslation();
  const batchTotal = totalBatchGrams(DEMO_LINES);
  const carrier = DEMO_LINES.find((line) => line.id === DEMO_CARRIER_ID);

  return (
    <section className={`${styles.sheet} ${hero.sheet}`}>
      <div className={hero.statement}>
        <h1 className={`${styles.heading} ${hero.headline}`}>{t('landing.hero.headline')}</h1>
        <p className={`${styles.body} ${hero.subhead}`}>{t('landing.hero.subhead')}</p>

        <div className={hero.actions}>
          <Link to="/auth?mode=register" className={styles.action}>
            {t('landing.hero.ctaPrimary')}
            <IconArrowRight />
          </Link>
          <a href="#compose" className={styles.actionQuiet}>
            {t('landing.hero.ctaSecondary')}
          </a>
        </div>

        <p className={hero.beta}>{t('landing.hero.beta')}</p>
        <HeroVessel />
      </div>

      <figure className={hero.plate}>
        {/* The board: the material lines as weighed. */}
        <div className={`${styles.board} ${hero.board}`}>
          <div className={hero.boardHead}>
            <span className={styles.leafLabel}>{t('landing.hero.sheetLabel')}</span>
            <strong className={hero.formulaName}>{t('landing.hero.formulaName')}</strong>
            <dl className={hero.specs}>
              <div>
                <dt>{t('landing.hero.batch')}</dt>
                <dd className={styles.rowValue}>{grams(DEMO_BATCH_GRAMS, 1)} g</dd>
              </div>
              <div>
                <dt>{t('landing.hero.concentration')}</dt>
                <dd className={styles.rowValue}>{DEMO_CONCENTRATION_PCT} %</dd>
              </div>
              <div>
                <dt>{t('landing.hero.category')}</dt>
                <dd className={styles.rowValue}>{t('landing.hero.categoryValue')}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* The acetate leaf: computed values only, hinged at its punched edge. */}
        <div className={`${styles.leaf} ${hero.leaf} ${styles.hinge}`}>
          <span className={styles.leafHoles} aria-hidden>
            <span className={styles.leafHole} />
            <span className={styles.leafHole} />
          </span>
          <span className={styles.leafLabel}>{t('landing.hero.leafLabel')}</span>

          <table className={hero.table}>
            <thead>
              <tr>
                <th scope="col">{t('landing.hero.columns.material')}</th>
                <th scope="col">{t('landing.hero.columns.stock')}</th>
                <th scope="col">{t('landing.hero.columns.computed')}</th>
              </tr>
            </thead>
            <tbody>
              {HERO_LINES.map((line) => {
                const neat = activeGrams(line);
                const unweighable = neat > 0 && neat < SCALE_RESOLUTION_GRAMS;
                return (
                  <tr key={line.id}>
                    <th scope="row">
                      {line.label}
                      {line.concentrationKind === 'dilution' ? (
                        <span className={hero.dilution}>{(line.activeFraction ?? 0) * 100} %</span>
                      ) : null}
                    </th>
                    <td className={styles.rowValue}>{grams(line.amountGrams)}</td>
                    <td className={unweighable ? hero.flagged : styles.rowValue}>
                      {grams(neat, 4)}
                    </td>
                  </tr>
                );
              })}
              {/* Absence is drawn, not left blank. */}
              <tr>
                <th scope="row" className={styles.rowMuted}>
                  {t('landing.hero.remainder')}
                </th>
                <td className={styles.rowValue}>{grams(carrier?.amountGrams ?? 0)}</td>
                <td className={styles.ghost}>0.0000</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t('landing.hero.batch')}</th>
                <td className={styles.rowValue}>{grams(batchTotal)}</td>
                <td className={styles.rowValue}>
                  {grams(
                    DEMO_LINES.reduce((sum, line) => sum + activeGrams(line), 0),
                    4,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className={hero.ghostHint}>{t('landing.hero.ghostHint')}</p>
        </div>

        <figcaption className={hero.caption}>{t('landing.hero.sheetCaption')}</figcaption>
      </figure>
    </section>
  );
}
