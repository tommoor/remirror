import {
  ApplySchemaAttributes,
  command,
  CommandFunction,
  extension,
  ExtensionTag,
  InputRule,
  KeyBindings,
  LEAF_NODE_REPLACING_CHARACTER,
  MarkExtension,
  MarkExtensionSpec,
  markInputRule,
  toggleMark,
} from '@remirror/core';
import { MarkPasteRule } from '@remirror/pm/paste-rules';

/**
 * Add a `code` mark to the editor. This is used to mark inline text as a code
 * snippet.
 */
@extension({})
export class CodeExtension extends MarkExtension {
  get name() {
    return 'code' as const;
  }

  createTags() {
    return [ExtensionTag.Code, ExtensionTag.MarkSupportsExit];
  }

  createMarkSpec(extra: ApplySchemaAttributes): MarkExtensionSpec {
    return {
      attrs: extra.defaults(),
      parseDOM: [{ tag: 'code', getAttrs: extra.parse }],
      toDOM: (mark) => ['code', extra.dom(mark), 0],
    };
  }

  createKeymap(): KeyBindings {
    return {
      'Mod-`': toggleMark({ type: this.type }),
    };
  }

  /**
   * Toggle the current selection as a code mark.
   */
  @command({})
  toggleCode(): CommandFunction {
    return toggleMark({ type: this.type });
  }

  createInputRules(): InputRule[] {
    return [
      markInputRule({
        regexp: new RegExp(`(?:\`)([^\`${LEAF_NODE_REPLACING_CHARACTER}]+)(?:\`)$`),
        type: this.type,
        ignoreWhitespace: true,
      }),
    ];
  }

  createPasteRules(): MarkPasteRule[] {
    return [{ type: 'mark', regexp: /`([^`]+)`/g, markType: this.type }];
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      code: CodeExtension;
    }
  }
}
