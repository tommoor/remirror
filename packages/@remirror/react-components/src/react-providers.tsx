/**
 * @module
 *
 * The `ThemeProvider` to wrap your editor with when using these components.
 */

import type { CSSProperties, ElementType, ReactElement, ReactNode } from 'react';
import { createContext, useEffect } from 'react';
import { Provider as ReakitProvider } from 'reakit';

import { I18n, i18n } from '@remirror/i18n';
import { RemirrorType } from '@remirror/react-utils';
import type { RemirrorThemeType } from '@remirror/theme';
import { createThemeVariables, Theme } from '@remirror/theme';

import * as system from './system';

const defaultI18nContext = { i18n, locale: 'en' };

/**
 * Create the context for the i18n framework used within remirror.
 */
export const I18nContext = createContext<I18nContextProps>(defaultI18nContext);

export interface I18nContextProps {
  /**
   * Provide your own i18n with all the locales you need for your app.
   *
   * ```ts
   * import { i18n } from '@remirror/i18n';
   * import esLocale from '@remirror/i18n/es';
   * import { SocialEditor } from '@remirror/react-social-editor';
   * import { es } from 'make-plural/plurals';
   *
   * i18n.loadLocaleData('es', { plurals: es });
   *
   * i18n.load({
   *   es: esLocale.messages,
   * });
   *
   * const Editor = () => {
   *   <SocialEditor i18n={i18n} />
   * }
   * ```
   */
  i18n: I18n;

  /**
   * The current locale for this context.
   *
   * @default 'en'
   */
  locale: string;

  /**
   * Supported locales. Defaults to including the locale.
   *
   * @default [locale]
   */
  supportedLocales?: string[];
}

export interface I18nProviderProps extends Partial<I18nContextProps> {
  children: ReactNode;
}

/**
 * A provider component for the remirror i18n helper library.
 *
 * This uses `@lingui/core` in the background. So please star and support the
 * project when you have a moment.
 */
export const I18nProvider = (props: I18nProviderProps): ReactElement<I18nProviderProps> => {
  const { i18n, locale = 'en', supportedLocales, children } = { ...defaultI18nContext, ...props };

  useEffect(() => {
    i18n.activate(locale, supportedLocales ?? [locale]);
  }, [i18n, locale, supportedLocales]);

  return (
    <I18nContext.Provider value={{ i18n, locale, supportedLocales }}>
      {children}
    </I18nContext.Provider>
  );
};

I18nProvider.$$remirrorType = RemirrorType.I18nProvider;

export interface ThemeProviderProps {
  /**
   * The theme to customise the look and feel of your remirror editor.
   */
  theme: RemirrorThemeType;

  /**
   * The custom component to use for rendering this editor.
   *
   * @default 'div'
   */
  as?: ElementType<{ style?: CSSProperties; className?: string }>;

  children: ReactNode;
}

/**
 * This the `ThemeProvider`. Wrap your editor with it to customise the theming
 * of content within your editor.
 *
 * Please be aware that this wraps your component in an extra dom layer.
 */
export const ThemeProvider = (props: ThemeProviderProps): ReactElement<ThemeProviderProps> => {
  const { theme, children, as: Component = 'div' } = props;

  return (
    <ReakitProvider unstable_system={system}>
      <Component style={createThemeVariables(theme).styles} className={Theme.THEME}>
        {children}
      </Component>
    </ReakitProvider>
  );
};

ThemeProvider.$$remirrorType = RemirrorType.ThemeProvider;
