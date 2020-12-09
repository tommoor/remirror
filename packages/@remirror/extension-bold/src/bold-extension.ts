import {
  ApplySchemaAttributes,
  command,
  CommandFunction,
  extension,
  ExtensionTag,
  FromToParameter,
  InputRule,
  isElementDomNode,
  isString,
  KeyBindings,
  MarkExtension,
  MarkExtensionSpec,
  markInputRule,
  Static,
  toggleMark,
} from '@remirror/core';

import { description, label } from './messages';

type FontWeightProperty =
  | '-moz-initial'
  | 'inherit'
  | 'initial'
  | 'revert'
  | 'unset'
  | 'bold'
  | 'normal'
  | 'bolder'
  | 'lighter'
  | number;

export interface BoldOptions {
  /**
   * Optionally set the font weight property for this extension.
   */
  weight?: Static<FontWeightProperty>;
}

/**
 * When added to your editor it will provide the `bold` command which makes the text under the cursor /
 * or at the provided position range bold.
 */
@extension<BoldOptions>({
  defaultOptions: { weight: undefined },
  staticKeys: ['weight'],
})
export class BoldExtension extends MarkExtension<BoldOptions> {
  get name() {
    return 'bold' as const;
  }

  createTags() {
    return [ExtensionTag.FormattingMark, ExtensionTag.FontStyle];
  }

  createMarkSpec(extra: ApplySchemaAttributes): MarkExtensionSpec {
    return {
      attrs: extra.defaults(),
      parseDOM: [
        {
          tag: 'strong',
          getAttrs: extra.parse,
        },
        // This works around a Google Docs misbehavior where
        // pasted content will be inexplicably wrapped in `<b>`
        // tags with a font-weight normal.
        {
          tag: 'b',
          getAttrs: (node) =>
            isElementDomNode(node) && node.style.fontWeight !== 'normal'
              ? extra.parse(node)
              : false,
        },
        {
          style: 'font-weight',
          getAttrs: (node) =>
            isString(node) && /^(bold(er)?|[5-9]\d{2,})$/.test(node) ? null : false,
        },
      ],
      toDOM: (node) => {
        const { weight } = this.options;

        if (weight) {
          return ['strong', { 'font-weight': weight.toString() }, 0];
        }

        return ['strong', extra.dom(node), 0];
      },
    };
  }

  createKeymap(): KeyBindings {
    return {
      'Mod-b': toggleMark({ type: this.type }),
    };
  }

  createInputRules(): InputRule[] {
    return [
      markInputRule({
        regexp: /(?:\*\*|__)([^*_]+)(?:\*\*|__)$/,
        type: this.type,
        ignoreWhitespace: true,
      }),
    ];
  }

  /**
   * Toggle the bold styling on and off. Remove the formatting if any
   * matching bold formatting within the selection or provided range.
   */
  @command({ icon: 'bold', label, description })
  toggleBold(range?: FromToParameter): CommandFunction {
    return toggleMark({ type: this.type, range });
  }

  /**
   * Set the bold formatting for the provided range.
   */
  @command()
  setBold(range?: FromToParameter): CommandFunction {
    return ({ tr, dispatch }) => {
      const { from, to } = range ?? tr.selection;
      dispatch?.(tr.addMark(from, to, this.type.create()));

      return true;
    };
  }

  /**
   * Remove the bold formatting from the provided range.
   */
  @command()
  removeBold(range?: FromToParameter): CommandFunction {
    return ({ tr, dispatch }) => {
      const { from, to } = range ?? tr.selection;

      if (!tr.doc.rangeHasMark(from, to, this.type)) {
        return false;
      }

      dispatch?.(tr.removeMark(from, to, this.type));

      return true;
    };
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      bold: BoldExtension;
    }
  }
}
