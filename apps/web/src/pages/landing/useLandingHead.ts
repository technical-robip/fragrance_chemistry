import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_LOCALES } from '@fc/shared';
import { useFaqItems } from './FaqSheet';

/**
 * `apps/web` is a Vite SPA with no server rendering, so the crawler-visible
 * markup lives in `index.html` and everything locale-dependent is written here
 * at runtime: title, description, canonical, hreflang, and the structured data.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function origin(): string {
  if (SITE_URL) return SITE_URL;
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useLandingHead() {
  const { t, i18n } = useTranslation();
  const faqItems = useFaqItems();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en';

  useEffect(() => {
    const base = origin();
    const title = t('landing.meta.title');
    const description = t('landing.meta.description');
    const image = `${base}/og-landing.png`;

    document.title = title;
    document.documentElement.lang = language;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: `${base}/` });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[property="og:image:alt"]', {
      property: 'og:image:alt',
      content: t('landing.meta.ogAlt'),
    });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: language });
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });

    upsertLink('canonical', `${base}/`);
    for (const locale of APP_LOCALES) {
      upsertLink('alternate', `${base}/?lng=${locale}`, locale);
    }
    upsertLink('alternate', `${base}/`, 'x-default');

    upsertJsonLd('ld-software', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: t('common.appName'),
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web, iOS, Android',
      description,
      url: `${base}/`,
      inLanguage: [...APP_LOCALES],
      license: 'https://opensource.org/licenses/MIT',
      featureList: [
        t('landing.method.title'),
        t('landing.divisions.compose.title'),
        t('landing.divisions.weigh.title'),
        t('landing.divisions.comply.title'),
        t('landing.divisions.cost.title'),
        t('landing.divisions.evaluate.title'),
      ],
      // The Free plan is real and costs nothing; Pro and Enterprise have no
      // price set anywhere in the product, so none is asserted here.
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        name: t('landing.plans.names.free'),
        description: t('landing.plans.taglines.free'),
      },
    });

    upsertJsonLd('ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }, [t, language, faqItems]);
}
