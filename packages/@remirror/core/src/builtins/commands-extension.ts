import { ErrorConstant, ExtensionPriority } from '@remirror/core-constants';
import {
  entries,
  invariant,
  isEmptyArray,
  isEmptyObject,
  isString,
  keys,
  object,
  uniqueArray,
} from '@remirror/core-helpers';
import type {
  AnyFunction,
  CommandFunction,
  CommandFunctionParameter,
  DispatchFunction,
  EditorSchema,
  EmptyShape,
  Fragment,
  FromToParameter,
  Mark,
  NodeAttributes,
  NodeType,
  PrimitiveSelection,
  ProsemirrorAttributes,
  ProsemirrorNode,
  Shape,
  Static,
  Transaction,
} from '@remirror/core-types';
import {
  environment,
  getTextSelection,
  isTextSelection,
  removeMark,
  RemoveMarkParameter,
  setBlockType,
  toggleBlockItem,
  ToggleBlockItemParameter,
  toggleWrap,
  wrapIn,
} from '@remirror/core-utils';
import { TextSelection } from '@remirror/pm/state';
import { EditorView } from '@remirror/pm/view';

import {
  delayedCommand,
  DelayedValue,
  insertText,
  InsertTextOptions,
  isDelayedValue,
} from '../commands';
import {
  AnyExtension,
  ChainedCommandRunParameter,
  ChainedFromExtensions,
  CommandsFromExtensions,
  extension,
  PlainExtension,
} from '../extension';
import { FocusType } from '../framework';
import { throwIfNameNotUnique } from '../helpers';
import type {
  CommandShape,
  CreateExtensionPlugin,
  ExtensionCommandFunction,
  ExtensionCommandReturn,
  StateUpdateLifecycleParameter,
} from '../types';
import { command, CommandDecoratorOptions } from './decorators';

export interface CommandOptions {
  /**
   * The className that is added to all tracker positions
   *
   * '@default 'remirror-tracker-position'
   */
  trackerClassName?: Static<string>;

  /**
   * The default element that is used for all trackers.
   *
   * @default 'span'
   */
  trackerNodeName?: Static<string>;
}

/**
 * Generate chained and unchained commands for making changes to the editor.
 *
 * @remarks
 *
 * Typically actions are used to create interactive menus. For example a menu
 * can use a command to toggle bold formatting or to undo the last action.
 *
 * @category Builtin Extension
 */
@extension<CommandOptions>({
  defaultPriority: ExtensionPriority.Highest,
  defaultOptions: { trackerClassName: 'remirror-tracker-position', trackerNodeName: 'span' },
  staticKeys: ['trackerClassName', 'trackerNodeName'],
})
export class CommandsExtension extends PlainExtension<CommandOptions> {
  get name() {
    return 'commands' as const;
  }

  /**
   * The current transaction which allows for making commands chainable.
   *
   * It is shared by all the commands helpers and can even be used in the
   * [[`KeymapExtension`]].
   */
  get transaction(): Transaction {
    if (this.customTransaction) {
      return this.customTransaction;
    }

    // Make sure we have the most up to date state.
    const state = this.store.getState();

    if (!this._transaction) {
      // Since there is currently no transaction set, make sure to create a new
      // one. Behind the scenes `state.tr` creates a new transaction for us to
      // use.
      this._transaction = state.tr;
    }

    // Check that the current transaction is valid.
    const isValid = this._transaction.before.eq(state.doc);

    // Check whether the current transaction has any already applied to it.
    const hasSteps = !isEmptyArray(this._transaction.steps);

    if (!isValid) {
      // Since the transaction is not valid we create a new one to prevent any
      // `mismatched` transaction errors.
      const tr = state.tr;

      // Now checking if any steps had been added to the previous transaction
      // and adding them to the newly created transaction.
      if (hasSteps) {
        for (const step of this._transaction.steps) {
          tr.step(step);
        }
      }

      // Make sure to store the transaction value to the instance of this
      // extension.
      this._transaction = tr;
    }

    return this._transaction;
  }

  /**
   * This is the holder for the shared transaction which is shared by commands
   * in order to support chaining.
   */
  private _transaction?: Transaction;

  /**
   * This is used to set the transaction being updated to be a custom one, which
   * can be useful if you'd like to use the command chain methods available via
   * remirror on transactions outside of the update lifecycle.
   */
  private customTransaction?: Transaction;

  onCreate(): void {
    const { setExtensionStore, setStoreKey } = this.store;

    // Support forced updates.
    setExtensionStore('forceUpdate', this.forceUpdateTransaction);
    setStoreKey('getForcedUpdates', this.getForcedUpdates);

    // Enable retrieval of the current transaction.
    setExtensionStore('getTransaction', () => this.transaction);

    // Enable retrieval of the command parameter.
    setExtensionStore('getCommandParameter', () => ({
      tr: this.transaction,
      dispatch: this.store.view.dispatch,
      state: this.store.view.state,
      view: this.store.view,
    }));
  }

  /**
   * Commands are only available after the view is attached.
   *
   * This is where they are attached.
   */
  onView(view: EditorView<EditorSchema>): void {
    const { setStoreKey, setExtensionStore } = this.store;
    const commands: Record<string, CommandShape> = object();
    const names = new Set<string>();
    const chain: Record<string, any> & ChainedCommandRunParameter = object();

    for (const extension of this.store.extensions) {
      const extensionCommands: ExtensionCommandReturn = extension.createCommands?.() ?? {};
      const decoratedCommands = extension.decoratedCommands ?? {};

      for (const commandName of keys(decoratedCommands)) {
        extensionCommands[commandName] = (extension as Shape)[commandName].bind(extension);
      }

      if (isEmptyObject(extensionCommands)) {
        continue;
      }

      // Gather the returned commands object from the extension.
      this.addCommands({
        names,
        chain,
        commands,
        extensionCommands,
        decoratedCommands,
      });
    }

    chain.run = () => view.dispatch(this.transaction);

    setStoreKey('commands', commands);
    setStoreKey('chain', chain as any);

    setExtensionStore('commands', commands as any);
    setExtensionStore('chain', chain as any);
  }

  /**
   * Update the cached transaction whenever the state is updated.
   */
  onStateUpdate({ state }: StateUpdateLifecycleParameter): void {
    this.customTransaction = undefined;
    this._transaction = state.tr;
  }

  /**
   * Enable custom commands to be used within the editor by users.
   *
   * This is preferred to the initial idea of setting commands on the
   * manager or even as a prop. The problem is that there's no typechecking
   * and it should be just fine to add your custom commands here to see the
   * dispatched immediately.
   *
   * To use it, firstly define the command.
   *
   * ```ts
   * import { CommandFunction } from 'remirror';
   *
   * const myCustomCommand: CommandFunction = ({ tr, dispatch }) => {
   *   dispatch?.(tr.insertText('My Custom Command'));
   *
   *   return true;
   * }
   * ```
   *
   * And then use it within the component.
   *
   * ```ts
   * import React, { useCallback } from 'react';
   * import { useRemirror } from 'remirror/react';
   *
   * const MyEditorButton = () => {
   *   const { commands } = useRemirror();
   *   const onClick = useCallback(() => {
   *     commands.customDispatch(myCustomCommand);
   *   }, [commands])
   *
   *   return <button onClick={onClick}>Custom Command</button>
   * }
   * ```
   *
   * An alternative is to use a custom command directly from a
   * `prosemirror-*` library. This can be accomplished in the following way.
   *
   *
   * ```ts
   * import { joinDown } from 'prosemirror-commands';
   * import { convertCommand } from 'remirror';
   *
   * const MyEditorButton = () => {
   *   const { commands } = useRemirror();
   *   const onClick = useCallback(() => {
   *     commands.customDispatch(convertCommand(joinDown));
   *   }, [commands]);
   *
   *   return <button onClick={onClick}>Custom Command</button>;
   * };
   * ```
   */
  @command()
  customDispatch(command: CommandFunction): CommandFunction {
    return command;
  }

  /**
   * Create a custom transaction.
   *
   * Use the command at the beginning of the command chain to override the
   * shared transaction.
   *
   * There are times when you want to be sure of the transaction which is
   * being updated.
   *
   * To restore the previous transaction call the `restore` chained method.
   *
   * @param tr - the transaction to set
   *
   * @remarks
   *
   * This is only intended for use within a chainable command chain.
   *
   * You **MUST** call the `restore` command after using this to prevent
   * cryptic errors.
   */
  @command()
  custom(tr: Transaction): CommandFunction {
    return () => {
      this.customTransaction = tr;
      return true;
    };
  }

  /**
   * Restore the shared transaction for future chained commands.
   */
  @command()
  restore(): CommandFunction {
    return () => {
      this.customTransaction = undefined;
      return true;
    };
  }

  /**
   * Insert text into the dom at the current location by default. If a
   * promise is provided instead of text the resolved value will be inserted
   * at the tracked position.
   */
  @command()
  insertText(
    text: string | DelayedValue<string>,
    options: InsertTextOptions = {},
  ): CommandFunction {
    if (!isDelayedValue(text)) {
      return insertText(text, options);
    }

    return delayedCommand({
      promise: text,
      immediate: (parameter) => {
        console.log('immediate command');
        return this.store.commands.addPlaceholder.original(text, { type: 'inline', ...options })(
          parameter,
        );
      },

      // Handle completion of the command
      onDone: ({ value }) => {
        const range = this.store.helpers.findPlaceholder(text);

        if (!range) {
          return false;
        }

        this.store.chain.removePlaceholder(text).insertText(value, range).run();

        return true;
      },

      // Cleanup in case of an error.
      onFail: (parameter) => {
        return this.store.commands.removePlaceholder.original(text)(parameter);
      },
    });
  }

  /**
   * Select the text within the provided range.
   *
   * Here are some ways it can be used.
   *
   * ```ts
   * // Set to the end of the document.
   * commands.setSelection('end');
   *
   * // Set the selection to the start of the document.
   * commands.setSelection('start');
   *
   * // Select all the text in the document.
   * commands.setSelection('all')
   *
   * // Select a range of text. It's up to you to make sure the selected
   * // range is valid.
   * commands.setSelection({ from: 10, to: 15 });
   *
   * // Specify the anchor and range in the selection.
   * commands.setSelection({ anchor: 10, head: 15 });
   *
   * // Set to a specific position.
   * commands.setSelection(10);
   *
   * // Use a ProseMirror selection
   * commands.setSelection(new TextSelection(state.doc.resolve(10)))
   * ```
   *
   * Although this is called `selectText` you can provide your own selection
   * option which can be any type of selection.
   */
  @command()
  selectText(selection: PrimitiveSelection): CommandFunction {
    return ({ tr, dispatch }) => {
      const textSelection = getTextSelection(selection, tr.doc);

      // TODO: add some safety checks here. If the selection is out of range
      // perhaps silently fail
      dispatch?.(tr.setSelection(textSelection));

      return true;
    };
  }

  /**
   * Delete the provided range or current selection.
   */
  @command()
  delete(range?: FromToParameter): CommandFunction {
    return ({ tr, dispatch }) => {
      const { from, to } = range ?? tr.selection;
      dispatch?.(tr.delete(from, to));

      return true;
    };
  }

  /**
   * Fire an empty update to trigger an update to all decorations, and state
   * that may not yet have run.
   *
   * This can be used in extensions to trigger updates certain options that
   * affect the editor state have updated.
   *
   * @param action - provide an action which is called just before the empty
   * update is dispatched (only when dispatch is available). This can be used in
   * chainable editor scenarios when you want to lazily invoke an action at the
   * point the update is about to be applied.
   */
  @command()
  emptyUpdate(action?: () => void): CommandFunction {
    return ({ tr, dispatch }) => {
      if (dispatch) {
        action?.();
        dispatch(tr);
      }

      return true;
    };
  }

  /**
   * Force an update of the specific updatable ProseMirror props.
   *
   * This command is always available as a builtin command.
   *
   * @category Builtin Command
   */
  @command()
  forceUpdate(...keys: UpdatableViewProps[]): CommandFunction {
    return ({ tr, dispatch }) => {
      dispatch?.(this.forceUpdateTransaction(tr, ...keys));

      return true;
    };
  }

  /**
   * Update the attributes for the node at the specified `pos` in the
   * editor.
   *
   * @category Builtin Command
   */
  @command()
  updateNodeAttributes<Type extends object>(
    pos: number,
    attrs: ProsemirrorAttributes<Type>,
  ): CommandFunction {
    return ({ tr, dispatch }) => {
      dispatch?.(tr.setNodeMarkup(pos, undefined, attrs));

      return true;
    };
  }

  /**
   * Fire an update to remove the current range selection. The cursor will
   * be placed at the anchor of the current range selection.
   *
   * A range selection is a non-empty text selection.
   *
   * @category Builtin Command
   */
  @command()
  emptySelection(): CommandFunction {
    return ({ tr, dispatch }) => {
      const { selection } = tr;

      if (selection.empty) {
        return false;
      }

      dispatch?.(tr.setSelection(TextSelection.create(tr.doc, tr.selection.anchor)));
      return true;
    };
  }

  /**
   * Insert a new line into the editor.
   *
   * Depending on editor setup and where the cursor is placed this may have
   * differing impacts.
   *
   * @category Builtin Command
   */
  @command()
  insertNewLine(): CommandFunction {
    return ({ dispatch, tr }) => {
      if (!isTextSelection(tr.selection)) {
        return false;
      }

      dispatch?.(tr.insertText('\n'));

      return true;
    };
  }

  /**
   * Insert a node into the editor with the provided content.
   *
   * @category Builtin Command
   */
  @command()
  insertNode(node: string | NodeType, options: InsertNodeOptions): CommandFunction {
    return ({ dispatch, tr, state }) => {
      const { attrs, marks, range } = options;
      const { from, to } = range ?? tr.selection;
      const nodeType = isString(node) ? state.schema.nodes[node] : node;

      invariant(nodeType, {
        code: ErrorConstant.INVALID_COMMAND_ARGUMENTS,
        message: 'The requested node type does not exist in the schema.',
      });

      const content = nodeType.createAndFill(attrs, options.content, marks);

      if (!content) {
        return false;
      }

      // This should not be treated as a replacement.
      const isReplacement = from !== to;
      dispatch?.(isReplacement ? tr.replaceRangeWith(from, to, content) : tr.insert(from, content));
      return true;
    };
  }

  /**
   * Set the focus for the editor.
   *
   * If using this with chaining this should only be placed at the end of
   * the chain. It can cause hard to debug issues when used in the middle of
   * a chain.
   *
   * ```tsx
   * import { useCallback } from 'react';
   * import { useRemirrorContext } from 'remirror/react';
   *
   * const MenuButton = () => {
   *   const { chain } = useRemirrorContext();
   *   const onClick = useCallback(() => {
   *     chain
   *       .toggleBold()
   *       .focus('end')
   *       .run();
   *   }, [chain])
   *
   *   return <button onClick={onClick}>Bold</button>
   * }
   * ```
   */
  @command()
  focus(position?: FocusType): CommandFunction {
    return (parameter) => {
      const { dispatch, tr } = parameter;
      const { view } = this.store;

      if (position === false) {
        return false;
      }

      if (view.hasFocus() && (position === undefined || position === true)) {
        return false;
      }

      // Keep the current selection when position is `true` or `undefined`.
      if (position === undefined || position === true) {
        const { from = 0, to = from } = tr.selection;
        position = { from, to };
      }

      if (dispatch) {
        // Focus only when dispatch is provided.
        this.delayedFocus();
      }

      return this.selectText(position)(parameter);
    };
  }

  /**
   * Blur focus from the editor and also update the selection at the same
   * time.
   */
  @command()
  blur(position?: PrimitiveSelection): CommandFunction {
    return (parameter) => {
      const { view } = this.store;

      if (!view.hasFocus()) {
        return false;
      }

      requestAnimationFrame(() => {
        (view.dom as HTMLElement).blur();
      });

      return position ? this.selectText(position)(parameter) : true;
    };
  }

  /**
   * Set the block type of the current selection or the provided range.
   */
  @command()
  setBlockNodeType(
    nodeType: string | NodeType,
    attrs?: ProsemirrorAttributes | undefined,
    range?: FromToParameter | undefined,
  ): CommandFunction {
    return setBlockType(nodeType, attrs, range);
  }

  /**
   * Toggle between wrapping an inactive node with the provided node type, and
   * lifting it up into it's parent.
   *
   * @param nodeType - the node type to toggle
   * @param attrs - the attrs to use for the node
   */
  @command()
  toggleWrappingNode(nodeType: string | NodeType, attrs?: ProsemirrorAttributes): CommandFunction {
    return toggleWrap(nodeType, attrs);
  }

  /**
   * Toggle a block between the provided type and toggleType.
   */
  @command()
  toggleBlockNodeItem(toggleParameter: ToggleBlockItemParameter): CommandFunction {
    return toggleBlockItem(toggleParameter);
  }

  /**
   * Wrap the selection or the provided text in a node of the given type with the
   * given attributes.
   */
  @command()
  wrapInNode(
    nodeType: string | NodeType,
    attrs?: NodeAttributes,
    range?: FromToParameter | undefined,
  ): CommandFunction {
    return wrapIn(nodeType, attrs, range);
  }

  /**
   * Removes a mark from the current selection or provided range.
   */
  @command()
  removeMark(parameter: RemoveMarkParameter): CommandFunction {
    return removeMark(parameter);
  }

  /**
   * Create a plugin that solely exists to track forced updates via the
   * generated plugin key.
   */
  createPlugin(): CreateExtensionPlugin {
    return {};
  }

  /**
   * Needed on iOS since `requestAnimationFrame` doesn't breaks the focus
   * implementation.
   */
  private handleIosFocus(): void {
    if (!environment.isIos) {
      return;
    }

    (this.store.view.dom as HTMLElement).focus();
  }

  /**
   * Focus the editor after a slight delay.
   */
  private delayedFocus(): void {
    // Manage focus on iOS.
    this.handleIosFocus();

    requestAnimationFrame(() => {
      // Use the built in focus method to refocus the editor.
      this.store.view.focus();

      // This has to be called again in order for Safari to scroll into view
      // after the focus. Perhaps there's a better way though or maybe place
      // behind a flag.
      this.store.view.dispatch(this.transaction.scrollIntoView());
    });
  }

  /**
   * A helper for forcing through updates in the view layer. The view layer can
   * check for the meta data of the transaction with
   * `manager.store.getForcedUpdate(tr)`. If that has a value then it should use
   * the unique symbol to update the key.
   */
  private readonly forceUpdateTransaction = (
    tr: Transaction,
    ...keys: UpdatableViewProps[]
  ): Transaction => {
    const { forcedUpdates } = this.getMeta(tr);

    this.setMeta(tr, { forcedUpdates: uniqueArray([...forcedUpdates, ...keys]) });
    return tr;
  };

  /**
   * Checks if the transaction has meta data which requires a forced update.
   * This can be used for updating:
   *
   * - `nodeViews`
   * - `editable` status of the editor
   * - `attributes` - for the top level node
   */
  private readonly getForcedUpdates = (tr: Transaction): ForcedUpdateMeta => {
    return this.getMeta(tr).forcedUpdates;
  };

  /**
   * Get the command metadata.
   */
  private getMeta(tr: Transaction): Required<CommandExtensionMeta> {
    const meta = tr.getMeta(this.pluginKey) ?? {};
    return { ...DEFAULT_COMMAND_META, ...meta };
  }

  private setMeta(tr: Transaction, update: CommandExtensionMeta) {
    const meta = this.getMeta(tr);
    tr.setMeta(this.pluginKey, { ...meta, ...update });
  }

  /**
   * Add the commands from the provided `commands` property to the `chained`,
   * `original` and `unchained` objects.
   */
  private addCommands(parameter: AddCommandsParameter) {
    const { extensionCommands, chain, commands, names, decoratedCommands } = parameter;

    for (const [name, command] of entries(extensionCommands)) {
      // Command names must be unique.
      throwIfNameNotUnique({ name, set: names, code: ErrorConstant.DUPLICATE_COMMAND_NAMES });

      // Make sure the command name is not forbidden.
      invariant(!forbiddenNames.has(name), {
        code: ErrorConstant.DUPLICATE_COMMAND_NAMES,
        message: 'The command name you chose is forbidden.',
      });

      // Create the unchained command.
      commands[name] = this.createUnchainedCommand(command);

      if (!decoratedCommands[name]?.disableChaining) {
        // Create the chained command.
        chain[name] = this.chainedFactory({ command, chain: chain });
      }
    }
  }

  /**
   * Create an unchained command method.
   */
  private unchainedFactory(parameter: UnchainedFactoryParameter) {
    return (...args: unknown[]) => {
      const { shouldDispatch = true, command } = parameter;
      const { view } = this.store;
      const { state } = view;

      let dispatch: DispatchFunction | undefined;

      if (shouldDispatch) {
        dispatch = view.dispatch;
      }

      return command(...args)({ state, dispatch, view, tr: this.transaction });
    };
  }

  /**
   * Create the unchained command.
   */
  private createUnchainedCommand(command: ExtensionCommandFunction): CommandShape {
    const unchainedCommand: CommandShape = this.unchainedFactory({ command }) as any;
    unchainedCommand.isEnabled = this.unchainedFactory({ command, shouldDispatch: true });
    unchainedCommand.original = command;

    return unchainedCommand;
  }

  /**
   * Create a chained command method.
   */
  private chainedFactory(parameter: ChainedFactoryParameter) {
    return (...args: unknown[]) => {
      const { chain: chained, command } = parameter;
      const { view } = this.store;
      const { state } = view;

      /**
       * This function is used in place of the `view.dispatch` method which is
       * passed through to all commands.
       *
       * It is responsible for checking that the transaction which was
       * dispatched is the same as the shared transaction which makes chainable
       * commands possible.
       */
      const dispatch: DispatchFunction = (transaction) => {
        // Throw an error if the transaction being dispatched is not the same as
        // the currently stored transaction.
        invariant(transaction === this.transaction, {
          message:
            'Chaining currently only supports `CommandFunction` methods which do not use the `state.tr` property. Instead you should use the provided `tr` property.',
        });
      };

      command(...args)({ state, dispatch, view, tr: this.transaction });

      return chained;
    };
  }
}

export interface InsertNodeOptions {
  attrs?: NodeAttributes;
  marks?: Mark[];
  content?: Fragment | ProsemirrorNode | ProsemirrorNode[];
  range?: FromToParameter;
}

const DEFAULT_COMMAND_META: Required<CommandExtensionMeta> = {
  forcedUpdates: [],
};

/**
 * Provides the list of Prosemirror EditorView props that should be updated/
 */
export type ForcedUpdateMeta = UpdatableViewProps[];
export type UpdatableViewProps = 'attributes' | 'editable';

export interface CommandExtensionMeta {
  forcedUpdates?: UpdatableViewProps[];
}

interface AddCommandsParameter {
  /**
   * The currently amassed command chain to mutate for each extension.
   */
  chain: Record<string, any> & ChainedCommandRunParameter;

  /**
   * The currently amassed commands (unchained) to mutate for each extension.
   */
  commands: Record<string, CommandShape>;

  /**
   * The untransformed commands which need to be added to the extension.
   */
  extensionCommands: ExtensionCommandReturn;

  /**
   * The names of the commands amassed. This allows for a uniqueness test.
   */
  names: Set<string>;

  /**
   * The command decorations with their options which affect runtime settings.
   */
  decoratedCommands: Record<string, CommandDecoratorOptions>;
}

interface UnchainedFactoryParameter {
  /**
   * All the commands.
   */
  command: ExtensionCommandFunction;

  /**
   * When false the dispatch is not provided (making this an `isEnabled` check).
   *
   * @default true
   */
  shouldDispatch?: boolean;
}

interface ChainedFactoryParameter {
  /**
   * All the commands.
   */
  command: ExtensionCommandFunction;

  /**
   * All the chained commands
   */
  chain: Record<string, any>;
}

/**
 * The names that are forbidden from being used as a command name.
 */
const forbiddenNames = new Set(['run', 'chain', 'original', 'raw']);

declare global {
  namespace Remirror {
    interface ManagerStore<ExtensionUnion extends AnyExtension> {
      /**
       * Enables the use of custom commands created by extensions which extend
       * the functionality of your editor in an expressive way.
       *
       * @remarks
       *
       * Commands are synchronous and immediately dispatched. This means that
       * they can be used to create menu items when the functionality you need
       * is already available by the commands.
       *
       * ```ts
       * if (commands.toggleBold.isEnabled()) {
       *   commands.toggleBold();
       * }
       * ```
       */
      commands: CommandsFromExtensions<ExtensionUnion>;

      /**
       * Chainable commands for composing functionality together in quaint and
       * beautiful ways
       *
       * @remarks
       *
       * You can use this property to create expressive and complex commands
       * that build up the transaction until it can be run.
       *
       * The way chainable commands work is by adding multiple steps to a shared
       * transaction which is then dispatched when the `run` command is called.
       * This requires making sure that commands within your code use the `tr`
       * that is provided rather than the `state.tr` property. `state.tr`
       * creates a new transaction which is not shared by the other steps in a
       * chainable command.
       *
       * The aim is to make as many commands as possible chainable as explained
       * [here](https://github.com/remirror/remirror/issues/418#issuecomment-666922209).
       *
       * There are certain commands that can't be made chainable.
       *
       * - undo
       * - redo
       *
       * ```ts
       * chain
       *   .toggleBold()
       *   .insertText('Hi')
       *   .setSelection('all')
       *   .run();
       * ```
       *
       * The `run()` method ends the chain and dispatches the command.
       */
      chain: ChainedFromExtensions<ExtensionUnion>;

      /**
       * Check for a forced update in the transaction. This pulls the meta data
       * from the transaction and if it is true then it was a forced update.
       *
       * ```ts
       * const forcedUpdates = this.manager.store.getForcedUpdates(tr);
       *
       * if (forcedUpdates) {
       *   // React updates when the state is updated.
       *   setState({ key: Symbol() })
       * }
       * ```
       */
      getForcedUpdates: (tr: Transaction) => UpdatableViewProps[];
    }

    interface BaseExtension {
      /**
       * `ExtensionCommands`
       *
       * This pseudo property makes it easier to infer Generic types of this
       * class.
       *
       * @internal
       */
      ['~C']: this['createCommands'] extends AnyFunction
        ? ReturnType<this['createCommands']>
        : EmptyShape;

      /**
       * @experimental
       *
       * Stores all the command names for this decoration that have been added
       * as decorators to the extension instance. This is used by the
       * `CommandsExtension` to pick the commands and store meta data attached
       * to each command.
       *
       * @internal
       */
      decoratedCommands?: Record<string, CommandDecoratorOptions>;

      /**
       * Create and register commands for that can be called within the editor.
       *
       * These are typically used to create menu's actions and as a direct
       * response to user actions.
       *
       * @remarks
       *
       * The `createCommands` method should return an object with each key being
       * unique within the editor. To ensure that this is the case it is
       * recommended that the keys of the command are namespaced with the name
       * of the extension.
       *
       * ```ts
       * import { ExtensionFactory } from '@remirror/core';
       *
       * const MyExtension = ExtensionFactory.plain({
       *   name: 'myExtension',
       *   version: '1.0.0',
       *   createCommands() {
       *     return {
       *       haveFun() {
       *         return ({ state, dispatch }) => {
       *           if (dispatch) {
       *             dispatch(tr.insertText('Have fun!'));
       *           }
       *
       *           return true; // True return signifies that this command is enabled.
       *         }
       *       },
       *     }
       *   }
       * })
       * ```
       *
       * The actions available in this case would be `undoHistory` and
       * `redoHistory`. It is unlikely that any other extension would override
       * these commands.
       *
       * Another benefit of commands is that they are picked up by typescript
       * and can provide code completion for consumers of the extension.
       */
      createCommands?(): ExtensionCommandReturn;
    }

    interface ExtensionStore {
      /**
       * Updates the meta information of a transaction to cause that transaction
       * to force through an update.
       */
      forceUpdate: (tr: Transaction, ...keys: UpdatableViewProps[]) => Transaction;

      /**
       * Get the shared transaction for all commands in the editor.
       *
       * This transaction makes chainable commands possible.
       */
      getTransaction: () => Transaction;

      /**
       * A short hand way of getting the `view`, `state`, `tr` and `dispatch`
       * methods.
       */
      getCommandParameter: () => Required<CommandFunctionParameter>;

      /**
       * A property containing all the available commands in the editor.
       *
       * This should only be accessed after the `onView` lifecycle method
       * otherwise it will throw an error. If you want to use it in the
       * `createCommands` function then make sure it is used within the returned
       * function scope and not in the outer scope.
       */
      commands: CommandsFromExtensions<AllExtensionUnion | (AnyExtension & { _T: false })>;

      /**
       * A method that returns an object with all the chainable commands
       * available to be run.
       *
       * @remarks
       *
       * Each chainable command mutates the states transaction so after running
       * all your commands. you should dispatch the desired transaction.
       *
       * This should only be called when the view has been initialized (i.e.)
       * within the `createCommands` method calls.
       *
       * ```ts
       * import { ExtensionFactory } from '@remirror/core';
       *
       * const MyExtension = ExtensionFactory.plain({
       *   name: 'myExtension',
       *   version: '1.0.0',
       *   createCommands: () => {
       *     // This will throw since it can only be called within the returned methods.
       *     const chain = this.store.chain; // ❌
       *
       *     return {
       *       // This is good 😋
       *       haveFun() {
       *         return ({ state, dispatch }) => this.store.chain.insertText('fun!').run(); ✅
       *       },
       *     }
       *   }
       * })
       * ```
       *
       * This should only be accessed after the `onView` lifecycle method
       * otherwise it will throw an error.
       */
      chain: ChainedFromExtensions<AllExtensionUnion | (AnyExtension & { _T: false })>;
    }

    interface AllExtensions {
      commands: CommandsExtension;
    }
  }
}
