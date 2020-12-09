import { extension, PlainExtension } from '@remirror/core';

export interface TextHighlightOptions {}

/**
 * Add a color background to the selected text (or text within a specified range).
 */
@extension<TextHighlightOptions>({})
export class TextHighlightExtension extends PlainExtension<TextHighlightOptions> {
  get name() {
    return 'textHighlight' as const;
  }
}
