import i18next from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18next
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: 'nl',
    fallbackLng: 'nl',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/i18n/{{lng}}.json',
    },
  });

export default i18next;
