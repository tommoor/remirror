import {
  extension,
  htmlToProsemirrorNode,
  NULL_CHARACTER,
  PlainExtension,
  prosemirrorNodeToHtml,
  StringHandlerOptions,
} from '@remirror/core';
import { EditorState } from '@remirror/pm/state';

/**
 * This extension provides the `html` string handler and `getHtml`
 * `Remirror.ManagerGetter` property.
 *
 * It also adds the plain text methods for the `text` string handler and
 * `getText` Getter method.
 */
@extension({})
export class HtmlExtension extends PlainExtension {
  get name(): string {
    return 'html' as const;
  }

  /**
   * Add the `html` string handler and `getHtml` manager getter method.
   */
  onCreate(): void {
    this.store.setStringHandler('html', htmlToProsemirrorNode);
    this.store.setStringHandler('text', this.textToProsemirrorNode.bind(this));
    this.store.setManagerGetter('getHtml', this.getHtml.bind(this));
    this.store.setManagerGetter('getText', this.getText.bind(this));
  }

  /**
   * Wrap the content in a pre tag to preserve whitespace and see what the
   * editor does with it.
   */
  private textToProsemirrorNode(options: StringHandlerOptions) {
    const content = `<pre>${options.content}</pre>`;
    return this.store.stringHandlers.html({ ...options, content });
  }

  /**
   * Get the html from the current state, or provide a custom state.
   */
  private getHtml(state?: EditorState) {
    const { getState, schema, document } = this.store;
    const node = (state ?? getState()).doc;

    return prosemirrorNodeToHtml(node, document);
  }

  /**
   * A method to get all the content in the editor as text. Depending on the
   * content in your editor, it is not guaranteed to preserve it 100%, so it's
   * best to test that it meets your needs before consuming.
   */
  private getText(lineBreakDivider = '\n\n') {
    const { doc } = this.store.getState();
    return doc.textBetween(0, doc.content.size, lineBreakDivider, NULL_CHARACTER);
  }
}

declare global {
  namespace Remirror {
    interface StringHandlers {
      /**
       * Register the html string handler, which converts a html string to a
       * prosemirror node.
       */
      html: HtmlExtension;

      /**
       * Register the plain `text` string handler which renders a text string
       * inside a `<pre />` tag and throws it at the html handler.
       */
      text: HtmlExtension;
    }

    interface ManagerGetters {
      /**
       * Get the html from the latest state.
       */
      getHtml: (state?: EditorState) => string;

      /**
       * A method to get all the content in the editor as text. Depending on the
       * content in your editor, it is not guaranteed to preserve it 100%, so it's
       * best to test that it meets your needs before consuming.
       */
      getText: (lineBreakDivider?: string) => string;
    }

    interface AllExtensions {
      html: HtmlExtension;
    }
  }
}
