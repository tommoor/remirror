import {
  EditorState,
  extension,
  PlainExtension,
  Static,
  StringHandlerOptions,
} from '@remirror/core';

import { htmlToMarkdown } from './html-to-markdown';
import { markdownToHtml } from './markdown-to-html';
import { htmlSanitizer } from './markdown-utils';

export interface MarkdownOptions {
  /**
   * Converts the provided html to a markdown string.
   *
   * By default this uses
   */
  htmlToMarkdown?: Static<(html: string) => string>;

  /**
   * Takes a markdown string and outputs html. It is up to you to make sure the
   * markdown is sanitized during this function call by providing the
   * `sanitizeHtml` method.
   */
  markdownToHtml?: Static<(markdown: string, sanitizer?: (html: string) => string) => string>;

  /**
   * Provide a sanitizer to prevent XSS attacks.
   *
   * The default sanitizer has **zero** security guarantees so it's recommended
   * that you provide your own html sanitizer here.
   *
   * If you want to sanitize on the backend as well you will need to override
   * this method.
   */
  htmlSanitizer?: Static<(html: string) => string>;
}

/**
 * This extension adds support for markdown editors using remirror.
 *
 * TODO - when presets are removed automatically include all the supported
 * extensions.
 *
 * This extension adds the following to the `ManagerStore`.
 *
 * - `getMarkdown()` - extract the markdown representation from the editor.
 */
@extension<MarkdownOptions>({
  defaultOptions: {
    htmlToMarkdown,
    markdownToHtml,
    htmlSanitizer,
  },
  staticKeys: ['markdownToHtml', 'htmlToMarkdown'],
})
export class MarkdownExtension extends PlainExtension<MarkdownOptions> {
  get name() {
    return 'markdown' as const;
  }

  /**
   * Add the `markdown` string handler and `getMarkdown` state helper method.
   */
  onCreate(): void {
    this.store.setStringHandler('markdown', this.markdownToProsemirrorNode);
    this.store.setManagerGetter('getMarkdown', this.getMarkdown);
  }

  /**
   * Convert the markdown to a prosemirror node.
   */
  private markdownToProsemirrorNode(options: StringHandlerOptions) {
    return this.store.stringHandlers.html({
      ...options,
      content: this.options.markdownToHtml(options.content, this.options.htmlSanitizer),
    });
  }

  /**
   * Get the html from the current state, or provide custom state.
   */
  private getMarkdown(state?: EditorState) {
    return this.options.htmlToMarkdown(this.store.stateHelpers.getHtml());
  }
}

declare global {
  namespace Remirror {
    interface StringHandlers {
      /**
       * Register the markdown string handler..
       */
      markdown: MarkdownExtension;
    }

    interface ManagerGetters {
      /**
       * Get the markdown content from the current document.
       *
       * @param state - the state provided to the `getMarkdown` method.
       */
      getMarkdown: (state?: EditorState) => string;
    }

    interface AllExtensions {
      markdown: MarkdownExtension;
    }
  }
}
