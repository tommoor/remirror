import { AnyExtension } from '@remirror/core';

import { useRemirrorContext } from './use-remirror-context';

type Commands<ExtensionUnion extends AnyExtension = Remirror.AllExtensionUnion> = Pick<
  Remirror.ManagerStore<ExtensionUnion>,
  'commands' | 'chain'
>;

/**
 * A core hook which provides the commands for usage in your editor.
 *
 * ```tsx
 * import { useCommands } from 'remirror/react';
 *
 * const EditorButton = () => {
 *   const commands = useCommands();
 *
 *   return (
 *     <>
 *       <button onClick={() => commands.toggleBold()}>
 *         Click me!
 *       </button>
 *       <button onClick={() => commands.chain.toggleBold().toggleItalic().run()}>
 *         Chain me!
 *       </button>
 *     </>
 *   );
 * }
 * ````
 */
export function useCommands<
  ExtensionUnion extends AnyExtension = Remirror.AllExtensionUnion
>(): Commands<ExtensionUnion> {
  const { commands, chain } = useRemirrorContext<ExtensionUnion>();

  return { commands, chain };
}
