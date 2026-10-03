import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import { normalizeLanguage, resolveInitialLanguageSync } from '@/i18n/language';

export { normalizeLanguage, resolveInitialLanguageSync, setLanguage } from '@/i18n/language';
export type { AppLanguage } from '@/i18n/language';

const deviceLanguage = normalizeLanguage(getLocales()[0]?.languageCode) ?? 'en';
const initialLanguage = resolveInitialLanguageSync(deviceLanguage);

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
