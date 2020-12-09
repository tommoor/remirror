import type { AnyExtension, GetCommands } from '@remirror/core';
import { useRemirrorContext } from '@remirror/react';

/**
 * This is a shorthand method for retrieving the commands available in the
 * editor.
 *
 *
 * import { useCommands } from 'remirror/react';
 */
export function useCommands<
  ExtensionUnion extends AnyExtension = Remirror.AllExtensionUnion
>(): GetCommands<ExtensionUnion> {
  return useRemirrorContext<ExtensionUnion>().commands;
}
