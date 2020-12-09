import {
  ApplySchemaAttributes,
  CommandFunction,
  extension,
  ExtensionTag,
  FromToParameter,
  InputRule,
  KeyBindings,
  MarkExtension,
  MarkExtensionSpec,
  markInputRule,
  toggleMark,
} from '@remirror/core';
import { MarkPasteRule } from '@remirror/pm/paste-rules';

@extension({})
export class ItalicExtension extends MarkExtension {
  get name() {
    return 'italic' as const;
  }

  createTags() {
    return [ExtensionTag.FontStyle];
  }

  createMarkSpec(extra: ApplySchemaAttributes): MarkExtensionSpec {
    return {
      attrs: extra.defaults(),

      parseDOM: [
        { tag: 'i', getAttrs: extra.parse },
        { tag: 'em', getAttrs: extra.parse },
        { style: 'font-style=italic' },
      ],
      toDOM: (mark) => ['em', extra.dom(mark), 0],
    };
  }

  createKeymap(): KeyBindings {
    return {
      'Mod-i': toggleMark({ type: this.type }),
    };
  }

  createCommands() {
    return {
      /**
       * Toggle the italic formatting on the selected text.
       */
      toggleItalic: (range?: FromToParameter): CommandFunction =>
        toggleMark({ type: this.type, range }),
    };
  }

  createInputRules(): InputRule[] {
    return [
      markInputRule({
        regexp: /(?:^|[^*])\*([^*]+)\*$/,
        type: this.type,
        ignoreWhitespace: true,
        updateCaptured: ({ fullMatch, start }) =>
          !fullMatch.startsWith('*') ? { fullMatch: fullMatch.slice(1), start: start + 1 } : {},
      }),
      markInputRule({
        regexp: /(?:^|[^_])_([^_]+)_$/,
        type: this.type,
        ignoreWhitespace: true,
        updateCaptured: ({ fullMatch, start }) => {
          return !fullMatch.startsWith('_')
            ? { fullMatch: fullMatch.slice(1), start: start + 1 }
            : {};
        },
      }),
    ];
  }

  createPasteRules(): MarkPasteRule[] {
    return [
      { type: 'mark', markType: this.type, regexp: /_([^_]+)_/g },
      { type: 'mark', markType: this.type, regexp: /\*([^*]+)\*/g },
    ];
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      italic: ItalicExtension;
    }
  }
}
