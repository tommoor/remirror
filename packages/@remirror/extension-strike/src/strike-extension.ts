import {
  ApplySchemaAttributes,
  CommandFunction,
  extension,
  ExtensionTag,
  InputRule,
  KeyBindings,
  MarkExtension,
  MarkExtensionSpec,
  markInputRule,
  toggleMark,
} from '@remirror/core';
import { MarkPasteRule } from '@remirror/pm/paste-rules';

/**
 * The extension for adding strike-through marks to the editor.
 */
@extension({})
export class StrikeExtension extends MarkExtension {
  get name() {
    return 'strike' as const;
  }

  createTags() {
    return [ExtensionTag.FontStyle];
  }

  createMarkSpec(extra: ApplySchemaAttributes): MarkExtensionSpec {
    return {
      attrs: extra.defaults(),
      parseDOM: [
        {
          tag: 's',
          getAttrs: extra.parse,
        },
        {
          tag: 'del',
          getAttrs: extra.parse,
        },
        {
          tag: 'strike',
          getAttrs: extra.parse,
        },
        {
          style: 'text-decoration',
          getAttrs: (node) => (node === 'line-through' ? {} : false),
        },
      ],
      toDOM: (mark) => ['s', extra.dom(mark), 0],
    };
  }

  createKeymap(): KeyBindings {
    return {
      'Mod-d': toggleMark({ type: this.type }),
    };
  }

  createCommands() {
    return {
      /**
       * Toggle the strike through formatting annotation.
       */
      toggleStrike: (): CommandFunction => toggleMark({ type: this.type }),
    };
  }

  createInputRules(): InputRule[] {
    return [markInputRule({ regexp: /~([^~]+)~$/, type: this.type, ignoreWhitespace: true })];
  }

  createPasteRules(): MarkPasteRule[] {
    return [{ regexp: /~([^~]+)~/g, type: 'mark', markType: this.type }];
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      strike: StrikeExtension;
    }
  }
}
