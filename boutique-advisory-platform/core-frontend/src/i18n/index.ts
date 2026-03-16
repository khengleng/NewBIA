'use client'

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translations
import enTranslations from './locales/en.json';
import kmTranslations from './locales/km.json';
import zhTranslations from './locales/zh.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  km: {
    translation: kmTranslations,
  },
  zh: {
    translation: zhTranslations,
  },
};

// Only initialize if not already initialized
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      debug: false,
      interpolation: {
        escapeValue: false, // React already escapes values
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
