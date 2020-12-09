import { useContext } from 'react';

import { ErrorConstant, invariant } from '@remirror/core';

import { I18nContext } from '../react-contexts';
import type { I18nContextProps } from '../react-types';

/**
 * Extract the internationalization support from the editor.
 */
export function useI18n(): I18nContextProps {
  const context = useContext(I18nContext);

  // Throw an error if no context exists.
  invariant(context, { code: ErrorConstant.I18N_CONTEXT });

  return context;
}
