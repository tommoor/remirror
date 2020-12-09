import { extension, PlainExtension } from '@remirror/core';

export interface ColumnsOptions {}

/**
 * Add column support to the nodes in your editor.
 */
@extension<ColumnsOptions>({})
export class ColumnsExtension extends PlainExtension<ColumnsOptions> {
  get name() {
    return 'columns' as const;
  }
}
