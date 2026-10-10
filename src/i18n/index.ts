import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Lang } from '../core/types';
import en from './en';
import es from './es';
import ht from './ht';

export function deviceLanguage(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === 'es' || code === 'ht' ? code : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es }, ht: { translation: ht } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
