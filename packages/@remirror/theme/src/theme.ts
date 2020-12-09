import { css } from '@linaria/core';
import { kebabCase } from 'case-anything';
import { darken, readableColor, transparentize } from 'polished';

import type { DeepPartial, DeepString } from '@remirror/core-types';

export interface CreateThemeVariablesReturn {
  /**
   * A css string of the variables.
   */
  css: string;

  /**
   * A styles object version of the created css.
   */
  styles: Record<string, string | number>;
}

/**
 * Create the theme variables from the provided theme.
 *
 * This function can't use anything from `@remirror/core-helpers` due to being
 * used in the `themeStyles` css. Babel can't resolve the imported functions in
 * development.
 */
export function createThemeVariables(theme: RemirrorThemeType = {}): CreateThemeVariablesReturn {
  const cssVariableString: string[] = [];
  const cssVariableObject: Record<string, string | number> = {};

  function addCssVariable(keys: string[], value: unknown) {
    if (typeof value === 'string' || typeof value === 'number') {
      cssVariableString.push(`${getCustomPropertyName(keys)}: ${value};`);
      cssVariableObject[getCustomPropertyName(keys)] = value;

      return;
    }

    if (typeof value !== 'object' || !value) {
      return;
    }

    for (const [key, v] of Object.entries(value)) {
      addCssVariable([...keys, key], v);
    }

    return;
  }

  for (const [key, value] of Object.entries(theme)) {
    addCssVariable([key], value);
  }

  return { css: cssVariableString.join('\n'), styles: cssVariableObject };
}

/**
 * Aliased name for the color type. It's just a string.
 */
export type Color = string;

/**
 * A hue is a color split into ten hues.
 */
export type Hue = [Color, Color, Color, Color, Color, Color, Color, Color, Color, Color];

/**
 * The Remirror Theme Type which can be extended by adding properties to the
 * global Remirror.Theme namespace.
 */
export type RemirrorThemeType = DeepPartial<Remirror.Theme>;

/**
 * Get the remirror variable from the keys to access it in the theme object.
 */
function getCustomPropertyName(keys: string[]) {
  return `--rmr-${keys.map(kebabCase).join('-')}`;
}

/**
 * Get the custom property from the keys used to access it in the theme object.
 */
function getVar(keys: string[]) {
  return `var(${getCustomPropertyName(keys)})`;
}

function keyCapturingProxy<Type extends object>(getter: (obj: Type) => string): string[] {
  const keys: string[] = [];

  function createProxy(obj: any): Type {
    /**
     * Track the number of times this has been called. This proxy only supports
     * simple getters which access the keys only without any extra functionality.
     */
    let called = false;

    return new Proxy(obj, {
      get: (_, key) => {
        if (called) {
          throw new Error(`Must only access the key once. ${key.toString()}`);
        }

        called = true;
        keys.push(key as string);
        return createProxy({});
      },

      set: (_, key) => {
        throw new Error(`Setters are not allowed for this object. ${key.toString()}`);
        // invariant(false, { message: `Setters are not allowed for this object. ${key.toString()}` });
      },
    });
  }

  getter(createProxy({}));

  return keys;
}

/**
 * Get the theme custom property.
 */
export function getTheme(getter: (theme: DeepString<Remirror.Theme>) => string): string {
  return getVar(keyCapturingProxy(getter));
}

// defaultRemirrorThemeHue is copied from https://github.com/yeun/open-color/blob/v1.7.0/open-color.json
const defaultRemirrorThemeHue: Remirror.ThemeHue = {
  gray: [
    '#f8f9fa',
    '#f1f3f5',
    '#e9ecef',
    '#dee2e6',
    '#ced4da',
    '#adb5bd',
    '#868e96',
    '#495057',
    '#343a40',
    '#212529',
  ],
  red: [
    '#fff5f5',
    '#ffe3e3',
    '#ffc9c9',
    '#ffa8a8',
    '#ff8787',
    '#ff6b6b',
    '#fa5252',
    '#f03e3e',
    '#e03131',
    '#c92a2a',
  ],
  pink: [
    '#fff0f6',
    '#ffdeeb',
    '#fcc2d7',
    '#faa2c1',
    '#f783ac',
    '#f06595',
    '#e64980',
    '#d6336c',
    '#c2255c',
    '#a61e4d',
  ],
  grape: [
    '#f8f0fc',
    '#f3d9fa',
    '#eebefa',
    '#e599f7',
    '#da77f2',
    '#cc5de8',
    '#be4bdb',
    '#ae3ec9',
    '#9c36b5',
    '#862e9c',
  ],
  violet: [
    '#f3f0ff',
    '#e5dbff',
    '#d0bfff',
    '#b197fc',
    '#9775fa',
    '#845ef7',
    '#7950f2',
    '#7048e8',
    '#6741d9',
    '#5f3dc4',
  ],
  indigo: [
    '#edf2ff',
    '#dbe4ff',
    '#bac8ff',
    '#91a7ff',
    '#748ffc',
    '#5c7cfa',
    '#4c6ef5',
    '#4263eb',
    '#3b5bdb',
    '#364fc7',
  ],
  blue: [
    '#e7f5ff',
    '#d0ebff',
    '#a5d8ff',
    '#74c0fc',
    '#4dabf7',
    '#339af0',
    '#228be6',
    '#1c7ed6',
    '#1971c2',
    '#1864ab',
  ],
  cyan: [
    '#e3fafc',
    '#c5f6fa',
    '#99e9f2',
    '#66d9e8',
    '#3bc9db',
    '#22b8cf',
    '#15aabf',
    '#1098ad',
    '#0c8599',
    '#0b7285',
  ],
  teal: [
    '#e6fcf5',
    '#c3fae8',
    '#96f2d7',
    '#63e6be',
    '#38d9a9',
    '#20c997',
    '#12b886',
    '#0ca678',
    '#099268',
    '#087f5b',
  ],
  green: [
    '#ebfbee',
    '#d3f9d8',
    '#b2f2bb',
    '#8ce99a',
    '#69db7c',
    '#51cf66',
    '#40c057',
    '#37b24d',
    '#2f9e44',
    '#2b8a3e',
  ],
  lime: [
    '#f4fce3',
    '#e9fac8',
    '#d8f5a2',
    '#c0eb75',
    '#a9e34b',
    '#94d82d',
    '#82c91e',
    '#74b816',
    '#66a80f',
    '#5c940d',
  ],
  yellow: [
    '#fff9db',
    '#fff3bf',
    '#ffec99',
    '#ffe066',
    '#ffd43b',
    '#fcc419',
    '#fab005',
    '#f59f00',
    '#f08c00',
    '#e67700',
  ],
  orange: [
    '#fff4e6',
    '#ffe8cc',
    '#ffd8a8',
    '#ffc078',
    '#ffa94d',
    '#ff922b',
    '#fd7e14',
    '#f76707',
    '#e8590c',
    '#d9480f',
  ],
};

const foreground = '#000000';
const background = '#ffffff';
const text = '#252103';
const border = transparentize(0.75, foreground);
const primary = '#7963d2';
const secondary = '#bcd263';
const primaryText = '#fff';
const secondaryText = '#fff';
const muted = defaultRemirrorThemeHue.gray[1];
const shadow1 = 'rgba(10,31,68,0.08)';
const shadow2 = 'rgba(10,31,68,0.10)';
const shadow3 = 'rgba(10,31,68,0.12)';

const baseColorTheme: Remirror.NamedColor = {
  background,
  border,
  foreground,
  muted,
  primary,
  secondary,
  primaryText,
  secondaryText,
  text,
};

const activeColorTheme: Remirror.NamedColor = {
  ...baseColorTheme,
  background: darken(0.1, background),
  border: darken(0.1, border),
  foreground: darken(0.1, foreground),
  muted: darken(0.1, muted),
  primary: darken(0.1, primary),
  secondary: darken(0.1, secondary),
  get text() {
    return readableColor(this.background);
  },
  get primaryText() {
    return readableColor(this.primary);
  },
  get secondaryText() {
    return readableColor(this.secondary);
  },
};

const hoverColorTheme: Remirror.NamedColor = {
  ...baseColorTheme,
  background: darken(0.2, background),
  border: darken(0.2, border),
  foreground: darken(0.2, foreground),
  muted: darken(0.2, muted),
  primary: darken(0.2, primary),
  secondary: darken(0.2, secondary),
  get text() {
    return readableColor(this.background);
  },
  get primaryText() {
    return readableColor(this.primary);
  },
  get secondaryText() {
    return readableColor(this.secondary);
  },
};

/**
 * The default remirror theme. This can be mutated with the
 * `mutateRemirrorTheme`.
 */
export const defaultRemirrorTheme: Remirror.Theme = {
  color: {
    ...baseColorTheme,
    active: activeColorTheme,
    hover: hoverColorTheme,
    shadow1,
    shadow2,
    shadow3,
    backdrop: transparentize(0.5, foreground),
  },
  hue: defaultRemirrorThemeHue,
  fontFamily: {
    default:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    heading: 'inherit',
    mono: 'Menlo, monospace',
  },
  fontSize: {
    0: '12px',
    1: '14px',
    2: '16px',
    3: '20px',
    4: '24px',
    5: '32px',
    6: '48px',
    7: '64px',
    8: '96px',
    default: '16px',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '16px',
    4: '32px',
    5: '64px',
    6: '128px',
    7: '256px',
    8: '512px',
  },
  fontWeight: {
    bold: '700',
    default: '400',
    heading: '700',
  },
  letterSpacing: {
    tight: '-1px',
    default: 'normal',
    loose: '1px',
    wide: '3px',
  },
  lineHeight: {
    heading: '1.25em',
    default: '1.5em',
  },
};

export interface CreateThemeVariablesReturn {
  /**
   * A css string of the variables.
   */
  css: string;

  /**
   * A styles object version of the created css.
   */
  styles: Record<string, string | number>;
}

/**
 * Create the theme variables from the provided theme.
 * The class name for adding theme styles to the remirror editor.
 *
 * These are the variable names
 */
export const THEME = css`
  ${createThemeVariables(defaultRemirrorTheme).css}

  font-family: ${getTheme((t) => t.fontFamily.default)};
  line-height: ${getTheme((t) => t.lineHeight.default)};
  font-weight: ${getTheme((t) => t.fontWeight.default)};

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: ${getTheme((t) => t.color.text)};
    font-family: ${getTheme((t) => t.fontFamily.heading)};
    line-height: ${getTheme((t) => t.lineHeight.heading)};
    font-weight: ${getTheme((t) => t.fontWeight.heading)};
  }

  h1 {
    font-size: ${getTheme((t) => t.fontSize[5])};
  }

  h2 {
    font-size: ${getTheme((t) => t.fontSize[4])};
  }

  h3 {
    font-size: ${getTheme((t) => t.fontSize[3])};
  }

  h4 {
    font-size: ${getTheme((t) => t.fontSize[2])};
  }

  h5 {
    font-size: ${getTheme((t) => t.fontSize[1])};
  }

  h6 {
    font-size: ${getTheme((t) => t.fontSize[0])};
  }
`;

declare global {
  namespace Remirror {
    /**
     * The interface for the remirror theme. It is declared in the global
     * namespace to allow you to extend and update the theme values that can be
     * provided.
     */
    interface Theme {
      color: ThemeColor;
      hue: ThemeHue;
      fontFamily: ThemeFontFamily;
      fontSize: ThemeFontSize;
      fontWeight: ThemeFontWeight;
      space: ThemeSpace;
      lineHeight: ThemeLineHeight;
      letterSpacing: ThemeLetterSpacing;
    }

    interface ThemeLineHeight {
      default: string | number;
      heading: string | number;
    }

    interface ThemeLetterSpacing {
      tight: string | number;
      default: string | number;
      loose: string | number;
      wide: string | number;
    }

    interface ThemeFontWeight {
      default: string;
      heading: string;
      bold: string;
    }

    interface ThemeFontFamily {
      default: string;
      heading: string;
      mono: string;
    }

    interface ThemeSpace {
      1: string | number;
      2: string | number;
      3: string | number;
      4: string | number;
      5: string | number;
      6: string | number;
      7: string | number;
      8: string | number;
    }

    interface ThemeFontSize {
      0: string | number;
      1: string | number;
      2: string | number;
      3: string | number;
      4: string | number;
      5: string | number;
      6: string | number;
      7: string | number;
      8: string | number;
      default: string | number;
    }

    interface NamedColor {
      foreground: Color;
      background: Color;
      text: Color;
      primary: Color;
      secondary: Color;
      primaryText: Color;
      secondaryText: Color;
      border: Color;
      muted: Color;
    }

    interface ThemeColor extends NamedColor {
      shadow1: Color;
      shadow2: Color;
      shadow3: Color;
      backdrop: Color;
      active: NamedColor;
      hover: NamedColor;
    }

    interface ThemeHue {
      gray: Hue;
      red: Hue;
      pink: Hue;
      grape: Hue;
      violet: Hue;
      indigo: Hue;
      blue: Hue;
      cyan: Hue;
      teal: Hue;
      green: Hue;
      lime: Hue;
      yellow: Hue;
      orange: Hue;
    }
  }
}
