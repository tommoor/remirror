import { i18n } from '@lingui/core';

import { messages as enMessages } from './en/messages';
import { en } from './plurals';

i18n.loadLocaleData('en', { plurals: en });

i18n.load({
  en: enMessages,
});

export type {
  I18n,
  AllLocaleData,
  AllMessages,
  Locale,
  LocaleData,
  Locales,
  MessageDescriptor,
  Messages,
} from '@lingui/core';
export { setupI18n, formats } from '@lingui/core';
export { i18n };
