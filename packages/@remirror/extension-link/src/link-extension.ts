import {
  ApplySchemaAttributes,
  CommandFunction,
  CreateExtensionPlugin,
  EditorState,
  extension,
  ExtensionPriority,
  ExtensionTag,
  FromToParameter,
  GetMarkRange,
  getMarkRange,
  getMatchString,
  getSelectedWord,
  Handler,
  isAllSelection,
  isElementDomNode,
  isMarkActive,
  isSelectionEmpty,
  isTextSelection,
  KeyBindings,
  LEAF_NODE_REPLACING_CHARACTER,
  MarkAttributes,
  MarkExtension,
  MarkExtensionSpec,
  omitExtraAttributes,
  OnSetOptionsParameter,
  preserveSelection,
  ProsemirrorNode,
  range as numberRange,
  removeMark,
  Static,
  updateMark,
} from '@remirror/core';
import type { CreateEventHandlers } from '@remirror/extension-events';
import { MarkPasteRule } from '@remirror/pm/paste-rules';
import { TextSelection } from '@remirror/pm/state';
import { isInvalidSplitReason, isRemovedReason, Suggester } from '@remirror/pm/suggest';

const UPDATE_LINK = 'updateLink';

/**
 * Can be an empty string which sets url's to '//google.com'.
 */
export type DefaultProtocol = 'http:' | 'https:' | '';

interface EventMeta {
  selection: TextSelection;
  range: FromToParameter | undefined;
  doc: ProsemirrorNode;
  attrs: LinkAttributes;
}

export interface LinkOptions {
  /**
   * Called when the user activates the keyboard shortcut.
   */
  onActivateLink?: Handler<(selectedText: string) => void>;

  /**
   * Called after the `commands.updateLink` has been called.
   */
  onUpdateLink?: Handler<(selectedText: string, meta: EventMeta) => void>;

  /**
   * Whether whether to select the text of the full active link when clicked.
   */
  selectTextOnClick?: boolean;

  /**
   * Listen to click events for links.
   */
  onClick?: Handler<(event: MouseEvent, data: LinkClickData) => boolean>;

  /**
   * Whether the link is opened when being clicked.
   *
   * @deprecated use `onClick` handler instead.
   */
  openLinkOnClick?: boolean;

  /**
   * Whether automatic links should be created.
   *
   * @default false
   */
  autoLink?: boolean;

  /**
   * The regex matcher for matching against the RegExp. The matcher must capture
   * the URL part of the string as it's first match. Take a look at the default
   * value.
   *
   * @default
   * /((http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[\da-z]+([.-][\da-z]+)*\.[a-z]{2,5}(:\d{1,5})?(\/.*)?)/gi
   */
  autoLinkRegex?: Static<RegExp>;

  /**
   * The default protocol to use when it can't be inferred
   */
  defaultProtocol?: DefaultProtocol;
}

export interface LinkClickData extends GetMarkRange, LinkAttributes {}

export type LinkAttributes = MarkAttributes<{
  /**
   * The link which is required property for the link mark.
   */
  href: string;

  /**
   * True when this was an automatically generated link. False when the link was
   * added specifically by the user.
   *
   * @default false
   */
  auto?: boolean;
}>;

@extension<LinkOptions>({
  defaultOptions: {
    autoLink: false,
    defaultProtocol: '',
    selectTextOnClick: false,
    openLinkOnClick: false,
    autoLinkRegex: /(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[\da-z]+([.-][\da-z]+)*\.[a-z]{2,5}(:\d{1,5})?(\/\S*)?/,
  },
  staticKeys: ['autoLinkRegex'],
  handlerKeyOptions: { onClick: { earlyReturnValue: true } },
  handlerKeys: ['onActivateLink', 'onUpdateLink', 'onClick'],
})
export class LinkExtension extends MarkExtension<LinkOptions> {
  get name() {
    return 'link' as const;
  }

  createTags() {
    return [ExtensionTag.Link];
  }

  createMarkSpec(extra: ApplySchemaAttributes): MarkExtensionSpec {
    const AUTO_ATTRIBUTE = 'data-link-auto';
    return {
      attrs: {
        ...extra.defaults(),
        href: {},
        auto: { default: false },
      },
      inclusive: false,
      spanning: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (node) => {
            if (!isElementDomNode(node)) {
              return false;
            }

            const href = node.getAttribute('href');
            const auto =
              node.hasAttribute(AUTO_ATTRIBUTE) ||
              this.options.autoLinkRegex.test(node.textContent ?? '');
            return { ...extra.parse(node), href, auto };
          },
        },
      ],
      toDOM: (node) => {
        const { auto: _, ...rest } = omitExtraAttributes(node.attrs, extra);
        const auto = node.attrs.auto ? { [AUTO_ATTRIBUTE]: '' } : {};
        const rel = 'noopener noreferrer nofollow';
        const attrs = { ...extra.dom(node), ...rest, rel, ...auto };

        return ['a', attrs, 0];
      },
    };
  }

  onSetOptions(options: OnSetOptionsParameter<LinkOptions>): void {
    if (options.changes.autoLink.changed) {
      const [newSuggester] = this.createSuggesters();

      if (options.changes.autoLink.value === true && newSuggester) {
        this.store.addSuggester(newSuggester);
      }

      if (options.changes.autoLink.value === false) {
        this.store.removeSuggester(this.name);
      }
    }
  }

  createKeymap(): KeyBindings {
    return {
      'Mod-k': ({ state, dispatch }) => {
        // if the selection is empty, expand it
        const range = state.selection.empty ? getSelectedWord(state) : state.selection;

        if (!range) {
          return false;
        }

        const { from, to } = range;
        const tr = state.tr.setSelection(TextSelection.create(state.doc, from, to));

        if (dispatch) {
          dispatch(tr);
        }

        this.options.onActivateLink(tr.doc.textBetween(from, to));

        return true;
      },
    };
  }

  createCommands() {
    return {
      /**
       * Create or update the link if it doesn't currently exist at the current
       * selection or provided range.
       */
      updateLink: (attrs: LinkAttributes, range?: FromToParameter): CommandFunction => {
        return (parameter) => {
          const { tr } = parameter;
          const { selection } = tr;
          const selectionIsValid =
            (isTextSelection(selection) && !isSelectionEmpty(tr.selection)) ||
            isAllSelection(selection) ||
            isMarkActive({ trState: tr, type: this.type });

          if (!selectionIsValid && !range) {
            return false;
          }

          tr.setMeta(this.name, { command: UPDATE_LINK, attrs, range });

          return updateMark({ type: this.type, attrs, range })(parameter);
        };
      },

      /**
       * Remove the link at the current selection
       */
      removeLink: (range?: FromToParameter): CommandFunction => {
        return (parameter) => {
          const { tr } = parameter;

          if (!isMarkActive({ trState: tr, type: this.type, ...range })) {
            return false;
          }

          return removeMark({ type: this.type, expand: true, range })(parameter);
        };
      },
    };
  }

  /**
   * Create the paste rules that can transform a pasted link in the document.
   */
  createPasteRules(): MarkPasteRule[] {
    if (this.options.autoLink) {
      return [];
    }

    return [
      {
        type: 'mark',
        regexp: /https?:\/\/(www\.)?[\w#%+.:=@~-]{2,256}\.[a-z]{2,6}\b([\w#%&+./:=?@~-]*)/gi,
        markType: this.type,
        getAttributes: (url) => ({ href: getMatchString(url), auto: true }),
        // Give this a low priority so that it can be by embedders which respond
        // to url regex.
        priority: ExtensionPriority.Lowest,
      },
    ];
  }

  createSuggesters(): [Suggester] | [] {
    if (!this.options.autoLink) {
      return [];
    }

    // Keep track of this to prevent multiple updates which prevent history from
    // working
    let cachedRange: FromToParameter | undefined;

    const suggester: Suggester = {
      name: this.name,
      matchOffset: 0,
      supportedCharacters: /$/,
      char: this.options.autoLinkRegex,
      priority: ExtensionPriority.Lowest,
      caseInsensitive: true,
      disableDecorations: true,
      appendTransaction: true,

      checkNextValidSelection: ($pos, tr) => {
        const range = getMarkRange($pos, this.type);

        if (!range || (cachedRange?.from === $pos.pos && cachedRange.to === range.to)) {
          return;
        }

        if (!range.mark.attrs.auto) {
          return;
        }

        const { mark, from, to } = range;
        const text = $pos.doc.textBetween(from, to, LEAF_NODE_REPLACING_CHARACTER, ' ');
        const href = extractHref(text, this.options.defaultProtocol);

        if (from === range.from && to === range.to && mark.attrs.href === href) {
          return;
        }

        // The helpers to use here.
        const { getSuggestMethods } = this.store.helpers;

        // Using the chainable commands so that the selection can be preserved
        // for the update.
        const { updateLink, removeLink, custom, restore } = this.store.chain;
        const { findMatchAtPosition } = getSuggestMethods();
        const selection = tr.selection;

        // Keep track of the last removal.
        cachedRange = { from: $pos.pos, to };

        // Set the transaction to update for the chainable commands.
        custom(tr);

        // Remove the link
        removeLink(cachedRange);

        // Make sure the selection gets preserved otherwise the cursor jumps
        // around.
        preserveSelection(selection, tr);

        // Check for active matches from the provided $pos
        const match = findMatchAtPosition($pos, this.name);

        if (match) {
          const { range, text } = match;
          updateLink(
            { href: extractHref(text.full, this.options.defaultProtocol), auto: true },
            range,
          );
        }

        // Make sure to restore the shared transaction to it's default value.
        restore();
      },

      onChange: (details, tr) => {
        const selection = tr.selection;
        const { text, range, exitReason, setMarkRemoved } = details;
        const href = extractHref(text.full, this.options.defaultProtocol);

        // Using the chainable commands so that the selection can be preserved
        // for the update.
        const { updateLink, removeLink, custom, restore } = this.store.chain;
        const { getSuggestMethods } = this.store.helpers;
        const { findMatchAtPosition } = getSuggestMethods();

        /** Remove the link at the provided range. */
        const remove = () => {
          // Call the command to use a custom transaction rather than the current.
          custom(tr);

          let markRange: ReturnType<typeof getMarkRange> | undefined;

          for (const pos of numberRange(range.from, range.to)) {
            markRange = getMarkRange(tr.doc.resolve(pos), this.type);

            if (markRange) {
              break;
            }
          }

          removeLink(markRange ?? range);

          // The mark range for the position after the matched text. If this
          // exists it should be removed to handle cleanup properly.
          let afterMarkRange: ReturnType<typeof getMarkRange> | undefined;

          for (const pos of numberRange(
            tr.selection.to,
            Math.min(tr.selection.$to.end(), tr.doc.nodeSize - 2),
          )) {
            afterMarkRange = getMarkRange(tr.doc.resolve(pos), this.type);

            if (afterMarkRange) {
              break;
            }
          }

          if (afterMarkRange) {
            removeLink(afterMarkRange);
          }

          preserveSelection(selection, tr);
          const match = findMatchAtPosition(
            tr.doc.resolve(Math.min(range.from + 1, tr.doc.nodeSize - 2)),
            this.name,
          );

          if (match) {
            updateLink(
              { href: extractHref(match.text.full, this.options.defaultProtocol), auto: true },
              match.range,
            );
          } else {
            setMarkRemoved();
          }

          restore();
        };

        // Respond when there is an exit.
        if (exitReason) {
          const isInvalid = isInvalidSplitReason(exitReason);
          const isRemoved = isRemovedReason(exitReason);

          if (isInvalid || isRemoved) {
            try {
              remove();
            } catch {
              // Errors here can be ignored since they can be caused by deleting
              // the whole document.
              return;
            }
          }

          return;
        }

        let value: ReturnType<typeof getMarkRange> | undefined;

        for (const pos of numberRange(range.from, range.to)) {
          value = getMarkRange(tr.doc.resolve(pos), this.type);

          if (value?.mark.attrs.auto === false) {
            return;
          }

          if (value) {
            break;
          }
        }

        /** Update the current range with the new link */
        function update() {
          custom(tr);
          updateLink({ href, auto: true }, range);
          preserveSelection(selection, tr);
          restore();
        }

        // Update when there is a value
        if (!value) {
          update();

          return;
        }

        // Do nothing when the current mark is identical to the mark that would be created.
        if (
          value.from === range.from &&
          value.to === range.to &&
          value.mark.attrs.auto &&
          value.mark.attrs.href === href
        ) {
          return;
        }

        update();
      },
    };

    return [suggester];
  }

  /**
   * Track click events passed through to the editor.
   */
  createEventHandlers(): CreateEventHandlers {
    return {
      clickMark: (event, clickState) => {
        const markRange = clickState.getMark(this.type);

        if (!markRange) {
          return;
        }

        const attrs = markRange.mark.attrs as LinkAttributes;
        const data: LinkClickData = { ...attrs, ...markRange };

        // If one of the handlers returns `true` then return early.
        if (this.options.onClick(event, data)) {
          return true;
        }

        let handled = false;

        if (this.options.openLinkOnClick) {
          handled = true;
          const href = attrs.href;
          window.open(href, '_blank');
        }

        if (this.options.selectTextOnClick) {
          handled = true;
          this.store.commands.selectText(markRange);
        }

        return handled;
      },
    };
  }

  /**
   * The plugin for handling click events in the editor.
   *
   * TODO extract this into the events extension and move that extension into
   * core.
   */
  createPlugin(): CreateExtensionPlugin {
    return {
      props: {
        handleClick: (view, pos) => {
          if (!this.options.selectTextOnClick && !this.options.openLinkOnClick) {
            return false;
          }

          const { doc, tr } = view.state;
          const range = getMarkRange(doc.resolve(pos), this.type);

          if (!range) {
            return false;
          }

          if (this.options.openLinkOnClick) {
            const href = range.mark.attrs.href;
            window.open(href, '_blank');
          }

          if (this.options.selectTextOnClick) {
            const $start = doc.resolve(range.from);
            const $end = doc.resolve(range.to);
            const transaction = tr.setSelection(new TextSelection($start, $end));

            view.dispatch(transaction);
          }

          return true;
        },
      },
      appendTransaction: (transactions, _oldState, state: EditorState) => {
        const transactionsWithLinkMeta = transactions.filter((tr) => !!tr.getMeta(this.name));

        if (transactionsWithLinkMeta.length === 0) {
          return;
        }

        transactionsWithLinkMeta.forEach((tr) => {
          const trMeta = tr.getMeta(this.name);

          if (trMeta.command === UPDATE_LINK) {
            const { range, attrs } = trMeta;
            const { selection, doc } = state;
            const meta = { range, selection, doc, attrs };

            const { from, to } = range ?? selection;
            this.options.onUpdateLink(doc.textBetween(from, to), meta);
          }
        });
      },
    };
  }
}

/**
 * Extract the `href` from the provided text.
 */
function extractHref(url: string, defaultProtocol: DefaultProtocol) {
  return url.startsWith('http') || url.startsWith('//') ? url : `${defaultProtocol}//${url}`;
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      link: LinkExtension;
    }
  }
}
