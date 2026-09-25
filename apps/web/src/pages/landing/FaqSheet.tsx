import { useTranslation } from 'react-i18next';
import styles from './LandingPage.module.css';
import faq from './FaqSheet.module.css';

export type FaqItem = { q: string; a: string };

export function useFaqItems(): FaqItem[] {
  const { t } = useTranslation();
  return t('landing.faq.items', { returnObjects: true }) as FaqItem[];
}

export function FaqSheet() {
  const { t } = useTranslation();
  const items = useFaqItems();

  return (
    <section className={`${styles.sheet} ${faq.sheet}`} aria-labelledby="faq-title">
      <p className={styles.hangingLabel}>{t('landing.faq.label')}</p>

      <h2 id="faq-title" className={`${styles.heading} ${faq.title}`}>
        {t('landing.faq.title')}
      </h2>

      <div className={faq.list}>
        {items.map((item) => (
          <details key={item.q} className={faq.entry}>
            <summary className={faq.question}>
              <span>{item.q}</span>
              <span className={faq.marker} aria-hidden>
                <svg
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M10 4.5v11M4.5 10h11" className={faq.markerCross} />
                </svg>
              </span>
            </summary>
            <p className={faq.answer}>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
