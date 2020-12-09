import { createContext } from 'react';

import type { ReactFrameworkOutput } from './react-types';

/**
 * The `ReactContext` for the Remirror editor.
 */
export const RemirrorContext = createContext<ReactFrameworkOutput<any> | null>(null);
