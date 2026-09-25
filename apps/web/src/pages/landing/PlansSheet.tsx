import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FEATURE_KEYS,
  PLAN_FEATURE_PRESETS,
  PLAN_QUOTA_PRESETS,
  QUOTA_KEYS,
  RESERVED_PLAN_SLUGS,
  type FeatureKey,
  type QuotaKey,
} from '@fc/shared';
import { IconCheck, IconDash } from './icons';
import styles from './LandingPage.module.css';
import plans from './PlansSheet.module.css';

type PlanSlug = (typeof RESERVED_PLAN_SLUGS)[number];

/**
 * The specification table, derived from the same presets the seed and the
 * entitlements service use, so the page cannot drift from what a plan actually
 * grants. No prices: `core.plans` has no price column and billing is a stub.
 */
export function planGrantsFeature(slug: PlanSlug, feature: FeatureKey): boolean {
  return PLAN_FEATURE_PRESETS[slug].includes(feature);
}

export function planQuota(slug: PlanSlug, quota: QuotaKey): number | null {
  return PLAN_QUOTA_PRESETS[slug][quota] ?? null;
}

const CTA: Record<PlanSlug, { key: string; to: string; primary: boolean }> = {
  free: { key: 'landing.plans.ctaFree', to: '/auth?mode=register', primary: true },
  pro: { key: 'landing.plans.ctaPro', to: '/auth?mode=register', primary: true },
  enterprise: { key: 'landing.plans.ctaEnterprise', to: '/auth', primary: false },
};

export function PlansSheet() {
  const { t } = useTranslation();

  return (
    <section id="plans" className={`${styles.sheet} ${plans.sheet}`} aria-labelledby="plans-title">
      <p className={styles.hangingLabel}>{t('landing.plans.label')}</p>

      <div className={plans.intro}>
        <h2 id="plans-title" className={`${styles.heading} ${plans.title}`}>
          {t('landing.plans.title')}
        </h2>
        <p className={styles.body}>{t('landing.plans.intro')}</p>
      </div>

      <div className={plans.tableWrap}>
        <table className={plans.table}>
          <caption className={plans.caption}>{t('landing.plans.title')}</caption>
          <thead>
            <tr>
              <th scope="col" className={plans.rowHead}>
                {t('landing.plans.planColumn')}
              </th>
              {RESERVED_PLAN_SLUGS.map((slug) => (
                <th key={slug} scope="col" className={plans.planHead}>
                  <span className={plans.planName}>{t(`landing.plans.names.${slug}`)}</span>
                  <span className={plans.planTagline}>{t(`landing.plans.taglines.${slug}`)}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {FEATURE_KEYS.map((feature) => (
              <tr key={feature}>
                <th scope="row" className={plans.rowHead}>
                  {t(`landing.plans.features.${feature}`)}
                </th>
                {RESERVED_PLAN_SLUGS.map((slug) => {
                  const granted = planGrantsFeature(slug, feature);
                  return (
                    <td key={slug} className={granted ? plans.yes : plans.no}>
                      {granted ? <IconCheck size={18} /> : <IconDash size={18} />}
                      <span className={plans.srOnly}>
                        {granted ? t('landing.plans.included') : t('landing.plans.notIncluded')}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tbody className={plans.quotaGroup}>
            <tr>
              <th scope="rowgroup" colSpan={4} className={plans.groupHead}>
                {t('landing.plans.quotas')}
              </th>
            </tr>
            {QUOTA_KEYS.map((quota) => (
              <tr key={quota}>
                <th scope="row" className={plans.rowHead}>
                  {t(`landing.plans.quotaLabels.${quota}`)}
                </th>
                {RESERVED_PLAN_SLUGS.map((slug) => {
                  const limit = planQuota(slug, quota);
                  return (
                    <td key={slug} className={plans.quotaCell}>
                      {limit == null ? (
                        <span className={plans.unlimited}>{t('landing.plans.unlimited')}</span>
                      ) : (
                        <span className={styles.rowValue}>{limit}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td className={plans.rowHead} />
              {RESERVED_PLAN_SLUGS.map((slug) => (
                <td key={slug} className={plans.ctaCell}>
                  <Link
                    to={CTA[slug].to}
                    className={CTA[slug].primary ? styles.action : styles.actionQuiet}
                  >
                    {t(CTA[slug].key)}
                  </Link>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
