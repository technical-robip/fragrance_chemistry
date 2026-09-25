import { useTranslation } from 'react-i18next';
import styles from './LandingPage.module.css';
import method from './MethodSheet.module.css';

const STEPS = [
  { id: 'compose', href: '#compose' },
  { id: 'weigh', href: '#weigh' },
  { id: 'verify', href: '#comply' },
] as const;

/**
 * The three bench moves, in the order a formula actually travels. Sequence
 * itself is the information, so the steps stay named rather than numbered.
 */
export function MethodSheet() {
  const { t } = useTranslation();

  return (
    <section
      id="method"
      className={`${styles.sheet} ${method.sheet}`}
      aria-labelledby="method-title"
    >
      <p className={styles.hangingLabel}>{t('landing.method.label')}</p>

      <div className={method.intro}>
        <h2 id="method-title" className={`${styles.heading} ${method.title}`}>
          {t('landing.method.title')}
        </h2>
        <p className={styles.body}>{t('landing.method.intro')}</p>
      </div>

      <ol className={method.steps}>
        {STEPS.map((step) => (
          <li key={step.id} className={method.step}>
            <a href={step.href} className={method.link}>
              <h3 className={method.stepTitle}>{t(`landing.method.${step.id}.title`)}</h3>
              <p className={method.stepBody}>{t(`landing.method.${step.id}.body`)}</p>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
