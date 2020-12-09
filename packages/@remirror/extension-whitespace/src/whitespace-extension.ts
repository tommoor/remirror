/**
 * @module
 *
 * The whitespace extension which adds support for displaying whitespace
 * characters in the editor.
 *
 * This is heavily inspired by
 * [`prosemirror-invisibles`](https://github.com/guardian/prosemirror-invisibles].
 */

import {
  ApplyStateLifecycleParameter,
  command,
  CommandFunction,
  EditorState,
  extension,
  FromToParameter,
  getChangedRanges,
  getDocRange,
  isEmptyObject,
  isNodeOfType,
  isString,
  NodeWithPosition,
  OnSetOptionsParameter,
  PlainExtension,
  ProsemirrorNode,
  Static,
  textBetween,
} from '@remirror/core';
import { Decoration, DecorationSet } from '@remirror/pm/view';

export interface WhitespaceOptions extends WhitespaceDecoratorSettings {
  /**
   * The initial whitespace visibility.
   *
   * @default false
   */
  initialVisibility?: Static<boolean>;

  /**
   * The list of default decorators that are used.
   */
  decorators?: Array<DefaultDecorator | WhitespaceDecorator>;
}

/**
 * Manage whitespace characters within your editor.
 */
@extension<WhitespaceOptions>({
  defaultOptions: {
    initialVisibility: false,
    breakNodes: ['hardBreak'],
    paragraphNodes: ['paragraph'],
    spaceCharacters: [' '],
    decorators: ['hardBreak', 'paragraph', 'space'],
  },
  staticKeys: ['initialVisibility'],
})
export class WhitespaceExtension extends PlainExtension<WhitespaceOptions> {
  private active = this.options.initialVisibility;

  /**
   * Set this to true to force updates to the decorationSet even if the editor
   * doc hasn't been changed. This is set to true when running commands.
   */
  private forcedUpdate = false;

  /**
   * The white space decorations to be applied.
   */
  private decorationSet: DecorationSet = DecorationSet.empty;

  /**
   * The decorator methods which are used to produce the whitespace characters
   * in for the provided ranges.
   */
  private decorators: WhitespaceDecorator[] = [];

  get name() {
    return 'whitespace' as const;
  }

  // Setup the initial decorators.
  protected init(): void {
    this.updateDecorators();
  }

  /**
   * Create the initial decoration state.
   */
  onInitState(state: EditorState): void {
    this.decorationSet = this.createFullDecorationSet(state.doc);
  }

  /**
   * Update the whitespace decorations for each state update.
   */
  onApplyState(parameter: ApplyStateLifecycleParameter): void {
    const { tr } = parameter;

    if (!tr.docChanged && !this.forcedUpdate) {
      return;
    }

    if (this.forcedUpdate) {
      this.forcedUpdate = false;
      this.decorationSet = this.active ? this.createFullDecorationSet(tr.doc) : DecorationSet.empty;

      return;
    }

    const changedRanges = getChangedRanges(tr);
    this.decorationSet = this.decorationSet.map(tr.mapping, tr.doc);

    for (const { from, to } of changedRanges) {
      this.decorationSet = generateDecorations({
        from,
        to,
        doc: tr.doc,
        decorationSet: this.decorationSet,
        decorators: this.decorators,
      });
    }
  }

  createDecorations(): DecorationSet {
    return this.decorationSet;
  }

  /**
   * When the decorators are updated we should update trigger an update to the
   * editor state.
   */
  protected onSetOptions(parameter: OnSetOptionsParameter<WhitespaceOptions>): void {
    const { pickChanged } = parameter;
    const allUpdates = pickChanged([
      'breakNodes',
      'decorators',
      'paragraphNodes',
      'spaceCharacters',
    ]);

    if (isEmptyObject(allUpdates)) {
      return;
    }

    this.updateDecorators();
    this.store.commands.emptyUpdate(() => {
      // Make sure to update the decorations, even though the document hasn't
      // changed.
      this.forcedUpdate = true;
    });
  }

  /**
   * Generate the whitespace decorations for the full .
   */
  private createFullDecorationSet(doc: ProsemirrorNode): DecorationSet {
    const { from, to } = getDocRange(doc);
    return generateDecorations({ from, to, doc, decorators: this.decorators });
  }

  /**
   * Create the decorators array.
   */
  private updateDecorators() {
    const decorators: WhitespaceDecorator[] = [];
    const { breakNodes, paragraphNodes, spaceCharacters } = this.options;
    const defaultDecorators = createDefaultWhitespaceDecorators({
      breakNodes,
      paragraphNodes,
      spaceCharacters,
    });

    for (const decorator of this.options.decorators) {
      decorators.push(isString(decorator) ? defaultDecorators[decorator] : decorator);
    }

    // Store the decorators.
    this.decorators = decorators;
  }

  /**
   * Toggle the visibility of whitespace characters.
   */
  @command()
  toggleWhitespace(): CommandFunction {
    return (parameter) => {
      return this.store.rawCommands.emptyUpdate(() => {
        this.forcedUpdate = true;
        this.active = !this.active;
      })(parameter);
    };
  }

  /**
   * Force the white space characters to be shown.
   */
  @command()
  showWhitespace(): CommandFunction {
    return (parameter) => {
      if (this.active) {
        return false;
      }

      return this.store.rawCommands.emptyUpdate(() => {
        this.forcedUpdate = true;
        this.active = true;
      })(parameter);
    };
  }

  /**
   * Force the white space characters to be shown.
   */
  @command()
  hideWhitespace(): CommandFunction {
    return (parameter) => {
      if (!this.active) {
        return false;
      }

      return this.store.rawCommands.emptyUpdate(() => {
        this.forcedUpdate = true;
        this.active = false;
      })(parameter);
    };
  }
}

interface GenerateDecorationsParameter extends FromToParameter {
  /**
   * The starting decoration set.
   *
   * @default DecorationSet.empty
   */
  decorationSet?: DecorationSet;

  /**
   * The document which is being acted on.
   */
  doc: ProsemirrorNode;

  /**
   * A list of the whitespace decorators which are used to create decorations
   * from the provided ranges.
   */
  decorators: WhitespaceDecorator[];
}

/**
 * Generate a decoration set of whitespace characters for the provided range.
 */
function generateDecorations(parameter: GenerateDecorationsParameter) {
  const { from, to, doc, decorators } = parameter;
  let { decorationSet = DecorationSet.empty } = parameter;

  for (const decorator of decorators) {
    decorationSet = decorator({ decorationSet, doc, from, to });
  }

  return decorationSet;
}

/**
 * Create the decoration widget which displays the hidden character.
 */
function createWidget(pos: number, key: string) {
  const span = document.createElement('span');
  span.classList.add('whitespace', `whitespace--${key}`);

  return Decoration.widget(pos, span, {
    marks: [],
    key,
  });
}

interface NodeBuilderParameter {
  key: string;
  calculatePosition: (nodeWithPosition: NodeWithPosition) => number;
  predicate: (node: ProsemirrorNode) => boolean;
}

interface WhitespaceRange extends FromToParameter {
  doc: ProsemirrorNode;
  decorationSet: DecorationSet;
}

/**
 * Create a hidden character creator which responds to different node areas
 * within the editor.
 */
function createNodeBuilder(builderOptions: NodeBuilderParameter) {
  return (details: WhitespaceRange) => {
    const { calculatePosition, key, predicate } = builderOptions;
    const { decorationSet, doc, from, to } = details;

    // The decorations to add.
    const added: Decoration[] = [];

    // The decorations to remove.
    const removed: Decoration[] = [];

    doc.nodesBetween(from, to, (node, pos) => {
      if (predicate(node)) {
        const widgetPos = calculatePosition({ node, pos });

        // Add the new decoration.
        added.push(createWidget(widgetPos, key));

        // Remove any decorations which existed at this position.
        removed.push(...decorationSet.find(widgetPos, widgetPos, (spec) => spec.key === key));
      }
    });

    return decorationSet.remove(removed).add(doc, added);
  };
}

interface CharacterBuilderParameter {
  key: string;
  /**
   * Check the provided character to see if it is an invisible character.
   */
  predicate: (character: string) => boolean;
}

/**
 * Build a hidden character creator which responds to certain characters in the
 * document.
 */
export function createCharacterBuilder(builderOptions: CharacterBuilderParameter) {
  return (details: WhitespaceRange): DecorationSet => {
    const { key, predicate } = builderOptions;
    const { decorationSet, doc, from, to } = details;
    const textRanges = textBetween({ from, to, doc });
    const decorations: Decoration[] = [];

    for (const { pos, text } of textRanges) {
      for (const [index, char] of [...text].entries()) {
        if (!predicate(char)) {
          continue;
        }

        decorations.push(createWidget(pos + index, key));
      }
    }

    return decorationSet.add(doc, decorations);
  };
}

/**
 * The built in whitespace decorations.
 */
export type DefaultDecorator = keyof ReturnType<typeof createDefaultWhitespaceDecorators>;

interface WhitespaceDecoratorSettings {
  /**
   * The nodes that are interpreted as break nodes.
   *
   * @default ['hardBreak']
   */
  breakNodes?: string[];

  /**
   * The nodes that are interpreted as paragraph nodes.
   *
   * @default ['paragraph']
   */
  paragraphNodes?: string[];

  /**
   * The text which should be interpreted as paragraph nodes.
   *
   * @default [' ']
   */
  spaceCharacters?: string[];
}

/**
 * The whitespace decorator function
 */
export type WhitespaceDecorator = (details: WhitespaceRange) => DecorationSet;

function createDefaultWhitespaceDecorators(settings: WhitespaceDecoratorSettings) {
  const {
    breakNodes = ['hardBreak'],
    paragraphNodes = ['paragraph'],
    spaceCharacters = [' '],
  } = settings;

  return {
    // Characters for the hard break character.
    hardBreak: createNodeBuilder({
      calculatePosition: ({ pos }) => pos,
      key: 'br',
      predicate: (node) => isNodeOfType({ node, types: breakNodes }),
    }),

    // Create decorations for paragraphs
    paragraph: createNodeBuilder({
      key: 'p',
      calculatePosition: ({ node, pos }) => pos + node.nodeSize - 1,
      predicate: (node) => isNodeOfType({ node, types: paragraphNodes }),
    }),

    // Create character decorations for space characters
    space: createCharacterBuilder({
      key: 's',
      predicate: (char) => spaceCharacters.includes(char),
    }),
  };
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      whitespace: WhitespaceExtension;
    }
  }
}
