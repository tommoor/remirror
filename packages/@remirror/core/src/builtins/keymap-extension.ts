import { ExtensionPriority, ExtensionTag, NamedShortcut } from '@remirror/core-constants';
import {
  entries,
  includes,
  isArray,
  isEmptyArray,
  isFunction,
  isString,
  isUndefined,
  object,
  sort,
  values,
} from '@remirror/core-helpers';
import type {
  CommandFunction,
  CustomHandler,
  KeyBindingParameter,
  KeyBindings,
  ProsemirrorPlugin,
  Selection,
  Shape,
  Transaction,
} from '@remirror/core-types';
import {
  convertCommand,
  environment,
  isTextSelection,
  mergeProsemirrorKeyBindings,
} from '@remirror/core-utils';
import {
  baseKeymap,
  chainCommands as pmChainCommands,
  selectParentNode,
} from '@remirror/pm/commands';
import { undoInputRule } from '@remirror/pm/inputrules';
import { keymap } from '@remirror/pm/keymap';

import { extension, PlainExtension } from '../extension';
import type { AddCustomHandler } from '../extension/base-class';
import type { OnSetOptionsParameter } from '../types';
import { keyBinding, KeybindingDecoratorOptions } from './decorators';

export interface KeymapOptions {
  /**
   * The shortcuts to use for named keybindings in the editor.
   *
   * @default 'default'
   */
  shortcuts?: KeyboardShortcuts;

  /**
   * Determines whether a backspace after an input rule has been applied should
   * reverse the effect of the input rule.
   *
   * @default true
   */
  undoInputRuleOnBackspace?: boolean;

  /**
   * Determines whether the escape key selects the current node.
   *
   * @default false
   */
  selectParentNodeOnEscape?: boolean;

  /**
   * When true will exclude the default prosemirror keymap.
   *
   * @remarks
   *
   * You might want to set this to true if you want to fully customise the
   * keyboard mappings for your editor. Otherwise it is advisable to leave it
   * unchanged.
   *
   * @default false
   */
  excludeBaseKeymap?: boolean;

  /**
   * Whether to support exiting marks when the left and right array keys are
   * pressed.
   *
   * Can be set to
   *
   * - `true` - enables exits from both the entrance and the end of the mark
   */
  exitMarksOnArrowPress?: boolean;

  /**
   * The implementation for the extra keybindings added to the settings.
   *
   * @remarks
   *
   * This allows for you to add extra key mappings which will be checked before
   * the default keymaps, if they return false then the default keymaps are
   * still checked.
   *
   * No key mappings are removed in this process.
   *
   * ```ts
   * const extension = BaseKeymapExtension.create({ keymap: {
   *   Enter({ state, dispatch }) {
   *     //... Logic
   *     return true;
   *   },
   * }});
   * ```
   */
  keymap?: CustomHandler<PrioritizedKeyBindings>;
}

/**
 * This extension allows others extension to use the `createKeymaps` method.
 *
 * @remarks
 *
 * Keymaps are the way of controlling how the editor responds to a keypress and
 * different key combinations.
 *
 * Without this extension most of the shortcuts and behaviors we have come to
 * expect from text editors would not be provided.
 *
 * @category Builtin Extension
 */
@extension<KeymapOptions>({
  defaultPriority: ExtensionPriority.Low,
  defaultOptions: {
    shortcuts: 'default',
    undoInputRuleOnBackspace: true,
    selectParentNodeOnEscape: false,
    excludeBaseKeymap: false,
    exitMarksOnArrowPress: true,
  },
  customHandlerKeys: ['keymap'],
})
export class KeymapExtension extends PlainExtension<KeymapOptions> {
  get name() {
    return 'keymap' as const;
  }

  /**
   * The custom keybindings added by the handlers. In react these can be added
   * via `hooks`.
   */
  private extraKeyBindings: PrioritizedKeyBindings[] = [];

  /**
   * Get the shortcut map.
   */
  private get shortcutMap(): ShortcutMap {
    const { shortcuts } = this.options;
    return isString(shortcuts) ? keyboardShortcuts[shortcuts] : shortcuts;
  }

  /**
   * This adds the `createKeymap` method functionality to all extensions.
   */
  onCreate(): void {
    this.store.setExtensionStore('rebuildKeymap', this.rebuildKeymap);
  }

  /** Add the created keymap to the available plugins. */
  createExternalPlugins(): ProsemirrorPlugin[] {
    if (
      // The user doesn't want any keymaps in the editor so don't add the keymap
      // handler.
      this.store.managerSettings.exclude?.keymap
    ) {
      return [];
    }

    return [this.generateKeymap()];
  }

  /**
   * Updates the stored keymap plugin on this extension.
   */
  private generateKeymap() {
    const extensionKeymaps: PrioritizedKeyBindings[] = [];
    const shortcutMap = this.shortcutMap;

    for (const extension of this.store.extensions) {
      const decoratedKeybindings = extension.decoratedKeybindings ?? {};

      for (const [name, options] of entries(decoratedKeybindings)) {
        if (options.isActive && !options.isActive(extension.options, this.store)) {
          continue;
        }

        // Bind the keybinding function to the extension.
        const keyBinding = (extension as Shape)[name].bind(extension);

        // Extract the keypress pattern.
        const key = getKey(
          isString(options.key) ? options.key : options.key(extension.options, this.store),
          shortcutMap,
        );

        // Decide the priority to assign to the keymap.
        const priority = isFunction(options.priority)
          ? options.priority(extension.options, this.store)
          : options.priority ?? ExtensionPriority.Low;

        extensionKeymaps.push([priority, { [key]: keyBinding }]);
      }

      if (
        // The extension doesn't have the `createKeymap` method.
        !extension.createKeymap ||
        // The extension was configured to ignore the keymap.
        extension.options.exclude?.keymap
      ) {
        continue;
      }

      extensionKeymaps.push(updateNamedKeys(extension.createKeymap(), shortcutMap));
    }

    // Sort the keymaps with a priority given to keymaps added via
    // `extension.addHandler` (e.g. in hooks).
    const sortedKeymaps = this.sortKeymaps([...this.extraKeyBindings, ...extensionKeymaps]);
    const mappedCommands = mergeProsemirrorKeyBindings(sortedKeymaps);

    return keymap(mappedCommands);
  }

  /**
   * The method for rebuilding all the extension keymaps.
   *
   * 1. Rebuild keymaps.
   * 2. Replace the old keymap plugin.
   * 3. Update the plugins used in the state (triggers an editor update).
   */
  private readonly rebuildKeymap = () => {
    this.store.updateExtensionPlugins(this);
  };

  /**
   * Handle exiting the mark forwards.
   */
  @keyBinding<KeymapExtension>({
    key: 'ArrowRight',
    isActive: (options) => options.exitMarksOnArrowPress,
  })
  arrowRight(parameter: KeyBindingParameter): boolean {
    const marks = this.store.markTags[ExtensionTag.MarkSupportsExit];
    return exitMarkForwards(marks)(parameter);
  }

  /**
   * Handle exiting the mark forwards.
   */
  @keyBinding<KeymapExtension>({
    key: 'ArrowLeft',
    isActive: (options) => options.exitMarksOnArrowPress,
  })
  arrowLeft(parameter: KeyBindingParameter): boolean {
    const marks = this.store.markTags[ExtensionTag.MarkSupportsExit];
    return exitMarkBackwards(marks)(parameter);
  }

  /**
   * Create the base keymap and give it a low priority so that all other keymaps
   * override it.
   */
  createKeymap(): PrioritizedKeyBindings {
    const { selectParentNodeOnEscape, undoInputRuleOnBackspace, excludeBaseKeymap } = this.options;
    const baseKeyBindings: KeyBindings = object();

    // Only add the base keymap if it is **NOT** excluded.
    if (!excludeBaseKeymap) {
      for (const [key, value] of entries(baseKeymap)) {
        baseKeyBindings[key] = convertCommand(value);
      }
    }

    // Automatically remove the input rule when the option is set to true.
    if (undoInputRuleOnBackspace && baseKeymap.Backspace) {
      baseKeyBindings.Backspace = convertCommand(
        pmChainCommands(undoInputRule, baseKeymap.Backspace),
      );
    }

    // Allow escape to select the parent node when set to true.
    if (selectParentNodeOnEscape) {
      baseKeyBindings.Escape = convertCommand(selectParentNode);
    }

    return [ExtensionPriority.Low, baseKeyBindings];
  }

  /**
   * @internalremarks
   *
   * Think about the case where bindings are disposed of and then added in a
   * different position in the `extraKeyBindings` array. This is especially
   * pertinent when using hooks.
   */
  protected onAddCustomHandler: AddCustomHandler<KeymapOptions> = ({ keymap }) => {
    if (!keymap) {
      return;
    }

    this.extraKeyBindings = [...this.extraKeyBindings, keymap];
    this.store.rebuildKeymap?.();

    return () => {
      this.extraKeyBindings = this.extraKeyBindings.filter((binding) => binding !== keymap);
      this.store.rebuildKeymap?.();
    };
  };

  /**
   * Handle changes in the dynamic properties.
   */
  protected onSetOptions(parameter: OnSetOptionsParameter<KeymapOptions>): void {
    const { changes } = parameter;

    if (
      changes.excludeBaseKeymap.changed ||
      changes.selectParentNodeOnEscape.changed ||
      changes.undoInputRuleOnBackspace.changed
    ) {
      this.store.rebuildKeymap?.();
    }
  }

  private sortKeymaps(bindings: PrioritizedKeyBindings[]): KeyBindings[] {
    // Sort the bindings.
    return sort(
      bindings.map((binding) =>
        // Make all bindings prioritized a default priority of
        // `ExtensionPriority.Default`
        isArray(binding) ? binding : ([ExtensionPriority.Default, binding] as const),
      ),
      // Sort from highest binding to the lowest.
      (a, z) => z[0] - a[0],
      // Extract the bindings from the prioritized tuple.
    ).map((binding) => binding[1]);
  }
}

/**
 * Exits the mark forwards when at the end of a block node.
 */
function exitMarkForwards(marks: string[], checkForReverse = true): CommandFunction {
  return (parameter) => {
    if (checkForReverse && shouldReverseDirection(parameter.tr)) {
      return exitMarkForwards(marks, false)(parameter);
    }

    const { tr, dispatch, state } = parameter;

    if (!isEndOfNode(tr.selection)) {
      return false;
    }

    const $pos = tr.selection.$from;
    const types = new Set(marks.map((name) => state.schema.marks[name]));
    const marksToRemove = $pos.marks().filter((mark) => types.has(mark.type));

    if (isEmptyArray(marksToRemove)) {
      return false;
    }

    if (!dispatch) {
      return true;
    }

    for (const mark of marksToRemove) {
      tr.removeStoredMark(mark);
    }

    dispatch(tr.insertText(' ', tr.selection.from));

    return true;
  };
}

/**
 * Exit a mark when at the beginning of a block node.
 */
function exitMarkBackwards(marks: string[], checkForReverse = true): CommandFunction {
  return (parameter) => {
    if (checkForReverse && shouldReverseDirection(parameter.tr)) {
      return exitMarkForwards(marks, false)(parameter);
    }

    const { tr, dispatch, state } = parameter;

    if (!isStartOfNode(tr.selection)) {
      return false;
    }

    const $pos = tr.selection.$from;
    const types = new Set(marks.map((name) => state.schema.marks[name]));

    // Find all the marks to remove
    const marksToRemove = $pos.marks().filter((mark) => types.has(mark.type));

    if (isEmptyArray(marksToRemove)) {
      // There are no marks to remove therefore defer to the empty marks to
      // remove array.
      return false;
    }

    if (!dispatch) {
      return true;
    }

    // Remove all the active marks at the current cursor.
    for (const mark of marksToRemove) {
      tr.removeStoredMark(mark);
    }

    dispatch(tr);
    return true;
  };
}

/**
 * Whether the item should reverse the direction provided.
 */
function shouldReverseDirection(tr: Transaction) {
  return tr.selection.$from.parent.attrs.dir === 'rtl';
}

/**
 * Checks that the selection is an empty text selection at the end of its parent
 * node.
 */
function isEndOfNode(selection: Selection) {
  const $pos = selection.$from;
  return (
    selection.empty &&
    isTextSelection(selection) &&
    $pos.parent.type.isBlock &&
    $pos.after() === $pos.pos + 1
  );
}

/**
 * Checks that the selection is an empty text selection at the start of its
 * parent node.
 */
function isStartOfNode(selection: Selection) {
  const $pos = selection.$from;
  return (
    selection.empty &&
    isTextSelection(selection) &&
    $pos.parent.type.isBlock &&
    $pos.before() === $pos.pos - 1
  );
}

function isNamedShortcut(value: string): value is NamedShortcut {
  return includes(values(NamedShortcut), value);
}

function getKey(value: string, shortcutMap: ShortcutMap) {
  return isNamedShortcut(value) ? shortcutMap[value] : value;
}

function updateNamedKeys(
  prioritizedBindings: PrioritizedKeyBindings,
  shortcutMap: ShortcutMap,
): PrioritizedKeyBindings {
  const updatedBindings: KeyBindings = {};
  let previousBindings: KeyBindings;
  let priority: ExtensionPriority | undefined;

  if (isArray(prioritizedBindings)) {
    [priority, previousBindings] = prioritizedBindings;
  } else {
    previousBindings = prioritizedBindings;
  }

  for (const [shortcutName, commandFunction] of entries(previousBindings)) {
    updatedBindings[getKey(shortcutName, shortcutMap)] = commandFunction;
  }

  return isUndefined(priority) ? updatedBindings : [priority, updatedBindings];
}

/**
 * A shortcut map which is used by the `KeymapExtension`.
 */
export type ShortcutMap = Record<NamedShortcut, string>;

const defaultShortcuts: ShortcutMap = {
  [NamedShortcut.Undo]: 'Mod-z',
  [NamedShortcut.Redo]: environment.isMac ? 'Shift-Mod-z' : 'Mod-y',
  [NamedShortcut.Bold]: 'Mod-b',
  [NamedShortcut.Italic]: 'Mod-i',
  [NamedShortcut.Underline]: 'Mod-u',
  [NamedShortcut.Strike]: 'Mod-d',
  [NamedShortcut.Code]: 'Mod-`',
  [NamedShortcut.Paragraph]: 'Mod-Alt-0',
  [NamedShortcut.H1]: 'Mod-Shift-1',
  [NamedShortcut.H2]: 'Mod-Shift-2',
  [NamedShortcut.H3]: 'Mod-Shift-3',
  [NamedShortcut.H4]: 'Mod-Shift-4',
  [NamedShortcut.H5]: 'Mod-Shift-5',
  [NamedShortcut.H6]: 'Mod-Shift-6',
  [NamedShortcut.NumberList]: 'Mod-Shift-9',
  [NamedShortcut.BulletList]: 'Mod-Shift-8',
  [NamedShortcut.Quote]: 'Mod->',
  [NamedShortcut.Divider]: 'Mod-Shift-|',
  [NamedShortcut.Codeblock]: 'Mod-Shift-~',
  [NamedShortcut.ClearFormatting]: 'Mod-Shift-C',
};

const googleDocShortcuts: ShortcutMap = {
  ...defaultShortcuts,
  [NamedShortcut.Strike]: 'Mod-Shift-S',
  [NamedShortcut.Code]: 'Mod-Shift-M',
  [NamedShortcut.Paragraph]: 'Mod-Alt-0',
  [NamedShortcut.H1]: 'Mod-Alt-1',
  [NamedShortcut.H2]: 'Mod-Alt-2',
  [NamedShortcut.H3]: 'Mod-Alt-3',
  [NamedShortcut.H4]: 'Mod-Alt-4',
  [NamedShortcut.H5]: 'Mod-Alt-5',
  [NamedShortcut.H6]: 'Mod-Alt-6',
  [NamedShortcut.NumberList]: 'Mod-Alt-7',
  [NamedShortcut.BulletList]: 'Mod-Alt-8',
  [NamedShortcut.Quote]: 'Mod-Alt-9',
  [NamedShortcut.ClearFormatting]: 'Mod-\\',
};

export const keyboardShortcuts = {
  default: defaultShortcuts,
  googleDoc: googleDocShortcuts,
};

export type KeyboardShortcuts = keyof typeof keyboardShortcuts | ShortcutMap;

/**
 * KeyBindings as a tuple with priority and the keymap.
 */
export type KeyBindingsTuple = [priority: ExtensionPriority, bindings: KeyBindings];

/**
 * `KeyBindings` with as an object or optionally a tuple with a priority.
 */
export type PrioritizedKeyBindings =
  | KeyBindings
  | [priority: ExtensionPriority, bindings: KeyBindings];

declare global {
  namespace Remirror {
    interface ExcludeOptions {
      /**
       * Whether to exclude keybindings support. This is not a recommended
       * action and can break functionality.
       *
       * @default undefined
       */
      keymap?: boolean;
    }

    interface ExtensionStore {
      /**
       * When called this will run through every `createKeymap` method on every
       * extension to recreate the keyboard bindings.
       *
       * @remarks
       *
       * Under the hood it updates the plugin which is used to insert the
       * keybindings into the editor. This causes the state to be updated and
       * will cause a rerender in your ui framework.
       *
       * **NOTE** - This will not update keybinding for extensions that
       * implement their own keybinding functionality (e.g. any plugin using
       * Suggestions)
       */
      rebuildKeymap: () => void;
    }

    interface BaseExtension {
      /**
       * Stores all the keybinding names and options for this decoration that
       * have been added as decorators to the extension instance. This is used
       * by the `KeymapExtension` to pick the commands and store metadata
       * attached to each command.
       *
       * @internal
       */
      decoratedKeybindings?: Record<string, KeybindingDecoratorOptions>;

      /**
       * Add keymap bindings for this extension.
       *
       * @param parameter - schema parameter with type included
       */
      createKeymap?(): PrioritizedKeyBindings;
    }

    interface AllExtensions {
      keymap: KeymapExtension;
    }
  }
}
