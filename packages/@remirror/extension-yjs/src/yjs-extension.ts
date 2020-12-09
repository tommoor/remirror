import {
  defaultCursorBuilder,
  redo,
  undo,
  yCursorPlugin,
  ySyncPlugin,
  yUndoPlugin,
  yUndoPluginKey,
} from 'y-prosemirror';
import { YSyncOpts } from 'y-prosemirror/dist/src/plugins/sync-plugin';
import type { Doc, UndoManager } from 'yjs';

import {
  AcceptUndefined,
  command,
  convertCommand,
  EditorState,
  environment,
  ErrorConstant,
  extension,
  ExtensionPriority,
  invariant,
  isEmptyObject,
  isFunction,
  keyBinding,
  KeyBindingParameter,
  NamedShortcut,
  nonChainable,
  NonChainableCommandFunction,
  OnSetOptionsParameter,
  PlainExtension,
  PrioritizedKeyBindings,
  ProsemirrorPlugin,
  Selection,
  Shape,
} from '@remirror/core';

/**
 * yjs typings are very rough; so we define here the interface that we require
 * (y-webrtc and y-websocket providers are both compatible with this interface;
 * no other providers have been checked).
 */
interface YjsRealtimeProvider {
  doc: Doc;
  awareness: any;
  destroy: () => void;
  disconnect: () => void;
}

export interface YjsOptions<Provider extends YjsRealtimeProvider = YjsRealtimeProvider> {
  /**
   * Get the provider for this extension.
   */
  getProvider: Provider | (() => Provider);

  /**
   * Remove the active provider. This should only be set at initial construction
   * of the editor.
   */
  destroyProvider?: (provider: Provider) => void;

  /**
   * The options which are passed through to the Yjs sync plugin.
   */
  syncPluginOptions?: AcceptUndefined<YSyncOpts>;

  /**
   * Take the user data and transform it into a html element which is used for
   * the cursor. This is passed into the cursor builder.
   *
   * See https://github.com/yjs/y-prosemirror#remote-cursors
   */
  cursorBuilder?: (user: Shape) => HTMLElement;

  /**
   * By default all editor bindings use the awareness 'cursor' field to
   * propagate cursor information.
   *
   * @default 'cursor'
   */
  cursorStateField?: string;

  /**
   * Get the current editor selection.
   *
   * @default `(state) => state.selection`
   */
  getSelection?: (state: EditorState) => Selection;

  /**
   * Names of nodes in the editor which should be protected.
   *
   * @default `new Set('paragraph')`
   */
  protectedNodes?: Set<string>;
  trackedOrigins?: any[];
}

/**
 * The YJS extension is the recommended extension for creating a collaborative
 * editor.
 */
@extension<YjsOptions>({
  defaultOptions: {
    getProvider: (): never => {
      invariant(false, {
        code: ErrorConstant.EXTENSION,
        message: 'You must provide a YJS Provider to the `YjsExtension`.',
      });
    },
    destroyProvider: defaultDestroyProvider,
    syncPluginOptions: undefined,
    cursorBuilder: defaultCursorBuilder,
    cursorStateField: 'cursor',
    getSelection: (state) => state.selection,
    protectedNodes: new Set('paragraph'),
    trackedOrigins: [],
  },
  defaultPriority: ExtensionPriority.High,
})
export class YjsExtension extends PlainExtension<YjsOptions> {
  get name() {
    return 'yjs' as const;
  }

  private _provider?: YjsRealtimeProvider;

  /**
   * The provider that is being used for the editor.
   */
  get provider(): YjsRealtimeProvider {
    const { getProvider } = this.options;

    return (this._provider ??= getLazyValue(getProvider));
  }

  /**
   * Handle the undo keybinding.
   */
  @keyBinding({ key: NamedShortcut.Undo })
  undoShortcut(parameter: KeyBindingParameter): boolean {
    return convertCommand(undo)(parameter);
  }

  /**
   * Handle the redo keybinding for the editor.
   */
  @keyBinding({ key: NamedShortcut.Redo })
  redoShortcut(parameter: KeyBindingParameter): boolean {
    return convertCommand(redo)(parameter);
  }

  /**
   * Create the yjs plugins.
   */
  createExternalPlugins(): ProsemirrorPlugin[] {
    const {
      syncPluginOptions,
      cursorBuilder,
      getSelection,
      cursorStateField,
      protectedNodes,
      trackedOrigins,
    } = this.options;

    const yDoc = this.provider.doc;
    const type = yDoc.getXmlFragment('prosemirror');

    return [
      ySyncPlugin(type, syncPluginOptions),
      yCursorPlugin(
        this.provider.awareness,
        { cursorBuilder, cursorStateField, getSelection },
        cursorStateField,
      ),
      yUndoPlugin({ protectedNodes, trackedOrigins }),
    ];
  }

  /**
   * Undo within a collaborative editor.
   *
   * This should be used instead of the built in `undo` command.
   *
   * This command does **not** support chaining.
   */
  @command({ disableChaining: true })
  yUndo(): NonChainableCommandFunction {
    return nonChainable((parameter) => {
      const { state, dispatch } = parameter;
      const undoManager: UndoManager = yUndoPluginKey.getState(state).undoManager;

      if (undoManager.undoStack.length === 0) {
        return false;
      }

      if (!dispatch) {
        return true;
      }

      return convertCommand(undo)(parameter);
    });
  }

  /**
   * Redo, within a collaborative editor.
   *
   * This should be used instead of the built in `redo` command.
   *
   * This command does **not** support chaining.
   */
  @command({ disableChaining: true })
  yRedo(): NonChainableCommandFunction {
    return nonChainable((parameter) => {
      const { state, dispatch } = parameter;
      const undoManager: UndoManager = yUndoPluginKey.getState(state).undoManager;

      if (undoManager.redoStack.length === 0) {
        return false;
      }

      if (!dispatch) {
        return true;
      }

      return convertCommand(redo)(parameter);
    });
  }

  /**
   * This managers the updates of the collaboration provider.
   */
  onSetOptions(parameter: OnSetOptionsParameter<YjsOptions>): void {
    const { changes, pickChanged } = parameter;
    const changedPluginOptions = pickChanged([
      'cursorBuilder',
      'cursorStateField',
      'getProvider',
      'getSelection',
      'syncPluginOptions',
      'protectedNodes',
      'trackedOrigins',
    ]);

    if (changes.getProvider.changed) {
      this._provider = undefined;
      const previousProvider = getLazyValue(changes.getProvider.previousValue);

      // Check whether the values have changed.
      if (changes.destroyProvider.changed) {
        changes.destroyProvider.previousValue?.(previousProvider);
      } else {
        this.options.destroyProvider(previousProvider);
      }
    }

    if (!isEmptyObject(changedPluginOptions)) {
      this.store.updateExtensionPlugins(this);
    }
  }

  /**
   * Remove the provider from the manager.
   */
  onDestroy(): void {
    if (!this._provider) {
      return;
    }

    this.options.destroyProvider(this._provider);
    this._provider = undefined;
  }
}

/**
 * The default destroy provider method.
 */
export function defaultDestroyProvider(provider: YjsRealtimeProvider): void {
  const { doc } = provider;
  provider.disconnect();
  provider.destroy();
  doc.destroy();
}

function getLazyValue<Type>(lazyValue: Type | (() => Type)): Type {
  return isFunction(lazyValue) ? lazyValue() : lazyValue;
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      yjs: YjsExtension;
    }
  }
}
