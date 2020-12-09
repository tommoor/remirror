import {
  CreateExtensionPlugin,
  extension,
  isDocNodeEmpty,
  ManagerPhase,
  OnSetOptionsParameter,
  PlainExtension,
  ProsemirrorAttributes,
  Transaction,
} from '@remirror/core';
import type { EditorState } from '@remirror/pm/state';
import { Decoration, DecorationSet } from '@remirror/pm/view';
import { ExtensionPlaceholder } from '@remirror/theme';

export interface PlaceholderOptions {
  /**
   * The placeholder text to use.
   */
  placeholder?: string;

  /**
   * The class to decorate the empty top level node with. If you change this
   * then you will also need to apply your own styles.
   */
  emptyNodeClass?: string;
}

export interface PlaceholderPluginState extends Required<PlaceholderOptions> {
  empty: boolean;
}

/**
 * An extension for the remirror editor. CHANGE ME.
 */
@extension<PlaceholderOptions>({
  defaultOptions: {
    emptyNodeClass: ExtensionPlaceholder.IS_EMPTY,
    placeholder: '',
  },
})
export class PlaceholderExtension extends PlainExtension<PlaceholderOptions> {
  get name() {
    return 'placeholder' as const;
  }

  createAttributes(): ProsemirrorAttributes {
    return { 'aria-placeholder': this.options.placeholder };
  }

  createPlugin(): CreateExtensionPlugin {
    return {
      state: {
        init: (_, state): PlaceholderPluginState => ({
          ...this.options,
          empty: isDocNodeEmpty(state.doc),
        }),
        apply: (tr, pluginState: PlaceholderPluginState, _, state): PlaceholderPluginState => {
          return applyState({ pluginState, tr, extension: this, state });
        },
      },
      props: {
        decorations: (state) => {
          return createDecorationSet({ state, extension: this });
        },
      },
    };
  }

  protected onSetOptions(parameter: OnSetOptionsParameter<PlaceholderOptions>): void {
    const { changes } = parameter;

    if (changes.placeholder.changed && this.store.phase >= ManagerPhase.EditorView) {
      // update the attributes object
      this.store.updateAttributes();
    }
  }
}

interface SharedParameter {
  /**
   * A reference to the extension
   */
  extension: PlaceholderExtension;
  /**
   * The editor state
   */
  state: EditorState;
}

interface ApplyStateParameter extends SharedParameter {
  /**
   * The plugin state passed through to apply
   */
  pluginState: PlaceholderPluginState;
  /**
   * A state transaction
   */
  tr: Transaction;
}

/**
 * Apply state for managing the created placeholder plugin.
 *
 * @param params
 */
function applyState({ pluginState, extension, tr, state }: ApplyStateParameter) {
  if (!tr.docChanged) {
    return pluginState;
  }

  return { ...extension.options, empty: isDocNodeEmpty(state.doc) };
}

/**
 * Creates a decoration set from the passed through state.
 *
 * @param params.extension
 * @param params.state
 */
function createDecorationSet({ extension, state }: SharedParameter) {
  const { empty } = extension.pluginKey.getState(state) as PlaceholderPluginState;
  const { emptyNodeClass, placeholder } = extension.options;

  if (!empty) {
    return;
  }

  const decorations: Decoration[] = [];

  state.doc.descendants((node, pos) => {
    const decoration = Decoration.node(pos, pos + node.nodeSize, {
      class: emptyNodeClass,
      'data-placeholder': placeholder,
    });

    decorations.push(decoration);
  });

  return DecorationSet.create(state.doc, decorations);
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      placeholder: PlaceholderExtension;
    }
  }
}
