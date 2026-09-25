import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './CompliancePanel.module.css';

export type ComplianceAllergen = {
  name: string;
  gramsInBatch: number;
  percentOfBatch: number;
  limitPercent?: number;
  status: 'green' | 'yellow' | 'red';
};

export type EuLabelHit = {
  inci: string;
  percentOfBatch: number;
  thresholdPercent: number;
  declared: boolean;
};

export type EuAnnexHit = {
  name: string;
  casNumber: string;
  restriction: string;
  status: 'green' | 'yellow' | 'red';
  note: string;
};

export type ComplianceReport = {
  category: number;
  categoryLabel: string;
  overallStatus: 'green' | 'yellow' | 'red';
  allergens: ComplianceAllergen[];
  labelAllergens: string[];
  euLabel?: {
    productStay: 'leave_on' | 'rinse_off';
    thresholdPercent: number;
    coverage: 'subset';
    declared: EuLabelHit[];
  };
  euAnnex?: {
    coverage: 'subset';
    hits: EuAnnexHit[];
  };
};

type Props = {
  compliance: ComplianceReport | null | undefined;
};

export function CompliancePanel({ compliance }: Props) {
  const { t } = useTranslation();
  if (!compliance) {
    return (
      <div className={styles.wrap}>
        <p className={styles.empty}>{t('dashboard.complianceEmpty')}</p>
      </div>
    );
  }

  const statusLabel =
    compliance.overallStatus === 'green'
      ? t('dashboard.complianceOk')
      : compliance.overallStatus === 'yellow'
        ? t('dashboard.complianceWarn')
        : t('dashboard.complianceFail');

  const annexHits = compliance.euAnnex?.hits ?? [];

  return (
    <div className={styles.wrap}>
      <div className={`${styles.banner} ${styles[compliance.overallStatus]}`}>
        <span className={styles.dot} aria-hidden />
        <div>
          <strong>{t('dashboard.ifraStatus')}</strong>
          <p>
            {statusLabel}
            {' · '}
            {t('dashboard.ifraCategory', {
              code: compliance.category,
              label: compliance.categoryLabel,
            })}
          </p>
        </div>
      </div>

      <p className={styles.muted}>{t('dashboard.ifraVsEu')}</p>

      {compliance.labelAllergens.length > 0 ? (
        <div className={styles.block}>
          <h4>{t('dashboard.euLabelStatus')}</h4>
          <p className={styles.muted}>{t('dashboard.euLabelLeaveOn')}</p>
          <ul className={styles.chips}>
            {compliance.labelAllergens.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.muted}>{t('dashboard.noLabelAllergens')}</p>
      )}

      {annexHits.length > 0 ? (
        <div className={styles.block}>
          <h4>{t('dashboard.euAnnexTitle')}</h4>
          <p className={styles.muted}>{t('dashboard.euAnnexSubset')}</p>
          <ul className={styles.limits}>
            {annexHits.map((hit) => (
              <li key={`${hit.casNumber}-${hit.name}`} className={styles[`row_${hit.status}`]}>
                <span>
                  {hit.name} ({hit.restriction})
                </span>
                <em>{hit.casNumber}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : compliance.euAnnex ? (
        <p className={styles.muted}>{t('dashboard.euAnnexEmpty')}</p>
      ) : null}

      {compliance.allergens.length > 0 ? (
        <ul className={styles.limits}>
          {compliance.allergens.map((a) => (
            <li key={a.name} className={styles[`row_${a.status}`]}>
              <span>{a.name}</span>
              <em>
                {a.percentOfBatch.toFixed(2)}%
                {a.limitPercent != null ? ` / ${a.limitPercent}%` : ''}
              </em>
            </li>
          ))}
        </ul>
      ) : null}

      <Link to="/catalog" className={styles.link}>
        {t('dashboard.openCatalogLimits')}
      </Link>
    </div>
  );
}
