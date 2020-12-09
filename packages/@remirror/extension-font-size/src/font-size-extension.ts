import { extension, PlainExtension } from '@remirror/core';

export interface FontSizeOptions {}

/**
 * Add font size to the selected text, or text within the provided range.
 */
@extension<FontSizeOptions>({})
export class FontSizeExtension extends PlainExtension<FontSizeOptions> {
  get name() {
    return 'fontSize' as const;
  }
}
