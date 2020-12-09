import { extension, PlainExtension } from '@remirror/core';

export interface TextColorOptions {}

/**
 * Wraps text with a styled span using the color css property. The name of the wrapper tag should be configurable.
 */
@extension<TextColorOptions>({})
export class TextColorExtension extends PlainExtension<TextColorOptions> {
  get name() {
    return 'textColor' as const;
  }
}
