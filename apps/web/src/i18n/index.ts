import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import es from './locales/es.json';
import de from './locales/de.json';
import ro from './locales/ro.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      it: { translation: it },
      es: { translation: es },
      de: { translation: de },
      ro: { translation: ro },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'it', 'es', 'de', 'ro'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'fc.locale',
      caches: ['localStorage'],
    },
  });

export default i18n;
