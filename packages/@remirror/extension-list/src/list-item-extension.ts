import {
  ApplySchemaAttributes,
  convertCommand,
  extension,
  ExtensionTag,
  KeyBindings,
  NodeExtension,
  NodeExtensionSpec,
} from '@remirror/core';
import { liftListItem, sinkListItem, splitListItem } from '@remirror/pm/schema-list';

/**
 * Creates the node for a list item.
 */
@extension({})
export class ListItemExtension extends NodeExtension {
  get name() {
    return 'listItem' as const;
  }

  createTags() {
    return [ExtensionTag.ListItemNode];
  }

  createNodeSpec(extra: ApplySchemaAttributes): NodeExtensionSpec {
    return {
      attrs: extra.defaults(),
      content: 'paragraph block*',
      defining: true,
      draggable: false,
      parseDOM: [{ tag: 'li', getAttrs: extra.parse }],
      toDOM: (node) => ['li', extra.dom(node), 0],
    };
  }

  createKeymap(): KeyBindings {
    return {
      Enter: convertCommand(splitListItem(this.type)),
      Tab: convertCommand(sinkListItem(this.type)),
      'Shift-Tab': convertCommand(liftListItem(this.type)),
    };
  }
}
