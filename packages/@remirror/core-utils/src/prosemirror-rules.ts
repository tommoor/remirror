import { isFunction, isNullOrUndefined } from '@remirror/core-helpers';
import type {
  EditorStateParameter,
  GetAttributesParameter,
  Mark,
  MarkTypeParameter,
  NodeTypeParameter,
  RegExpParameter,
  TransactionParameter,
} from '@remirror/core-types';
import { InputRule } from '@remirror/pm/inputrules';
import { markActiveInRange } from '@remirror/pm/suggest';

export interface BeforeDispatchParameter extends TransactionParameter {
  /**
   * The matches returned by the regex.
   */
  match: string[];

  /**
   * The start position of the most recently typed character.
   */
  start: number;

  /**
   * The end position of the most recently typed character.
   */
  end: number;
}

export interface BaseInputRuleParameter {
  /**
   * A method which can be used to add more steps to the transaction after the
   * input rule update but before the editor has dispatched to update to a new
     state.
   *
   * ```ts
   * import { nodeInputRule } from 'remirror';
   *
   * nodeInputRule({
   *   type,
   *   regexp: /abc/,
   *     beforeDispatch?: (parameter: BeforeDispatchParameter) => void; : (tr)
         => tr.insertText('hello')
   * });
   * ```
   */
  beforeDispatch?: (parameter: BeforeDispatchParameter) => void;
}

export interface NodeInputRuleParameter
  extends Partial<GetAttributesParameter>,
    RegExpParameter,
    NodeTypeParameter,
    BaseInputRuleParameter {}

export interface PlainInputRuleParameter extends RegExpParameter, BaseInputRuleParameter {
  /**
   * A function that transforms the match into the desired value.
   */
  transformMatch: (match: string[]) => string | null | undefined;
}

export interface UpdateCaptureTextParameter {
  /**
   * The first capture group from the matching input rule.
   */
  captureGroup: string;

  /**
   * The text of the full match which was received.
   */
  fullMatch: string;

  /**
   * The starting position of the match relative to the `doc`.
   */
  start: number;

  /**
   * The end position of the match relative to the `doc`.
   */
  end: number;
}

interface MarkInputRuleParameter
  extends Partial<GetAttributesParameter>,
    RegExpParameter,
    MarkTypeParameter,
    BaseInputRuleParameter {
  /**
   * Ignore the match when all characters in the capture group are whitespace.
   *
   * This helps stop situations from occurring where the a capture group matches
   * but you don't want an update if it's all whitespace.
   *
   * @default false
   */
  ignoreWhitespace?: boolean;

  /**
   * Update the capture group. This is needed sometimes because lookbehind regex
   * don't work in some browsers and can't be transpiled or polyfilled. This
   * method allows the developer to update the details of the matching input
   * rule details before it is acted on.
   *
   * The capture group refers to the first match within the matching bracket.
   *
   * ```ts
   * abc.match(/ab(c)/) => ['abc', 'a']
   * ```
   *
   * In the above example the capture group is the first index so in this case
   * the captured text would be `a`.
   *
   * @param captured - All the details about the capture to allow for full
   * customisation.
   * @returns updated details or undefined to leave unchanged.
   *
   * See https://github.com/remirror/remirror/issues/574#issuecomment-678700121
   * for more context.
   */
  updateCaptured?: (captured: UpdateCaptureTextParameter) => Partial<UpdateCaptureTextParameter>;
}

/**
 * Creates an input rule based on the provided regex for the provided mark type.
 */
export function markInputRule(parameter: MarkInputRuleParameter): SkippableInputRule {
  const {
    regexp,
    type,
    getAttributes,
    ignoreWhitespace = false,
    beforeDispatch,
    updateCaptured,
  } = parameter;

  const rule: SkippableInputRule = new InputRule(regexp, (state, match, start, end) => {
    const { tr } = state;

    // These are the attributes which are added to the mark and they can be
    // obtained from the match if a function is provided.
    const attributes = isFunction(getAttributes) ? getAttributes(match) : getAttributes;

    const $from = state.doc.resolve(start);
    const $to = state.doc.resolve(end);

    if (rule.invalidMarks && markActiveInRange({ $from, $to }, rule.invalidMarks)) {
      return null;
    }

    // Update the internal values with the user provided method.
    const details =
      updateCaptured?.({ captureGroup: match[1], fullMatch: match[0], start, end }) ?? {};

    // Store the updated values or the original.
    const captureGroup = details.captureGroup ?? match[1];
    const fullMatch = details.fullMatch ?? match[0];
    start = details.start ?? start;
    end = details.end ?? end;

    let markEnd = end;
    let initialStoredMarks: Mark[] = [];

    // This helps prevent matches which are only whitespace from triggering an
    // update.
    if (ignoreWhitespace && captureGroup?.trim() === '') {
      return null;
    }

    if (rule.shouldSkip?.({ state, captureGroup, fullMatch, start, end, ruleType: 'mark' })) {
      return null;
    }

    if (captureGroup) {
      const startSpaces = fullMatch.search(/\S/);
      const textStart = start + fullMatch.indexOf(captureGroup);
      const textEnd = textStart + captureGroup.length;

      initialStoredMarks = tr.storedMarks ?? [];

      if (textEnd < end) {
        tr.delete(textEnd, end);
      }

      if (textStart > start) {
        tr.delete(start + startSpaces, textStart);
      }

      markEnd = start + startSpaces + captureGroup.length;
    }

    tr.addMark(start, markEnd, type.create(attributes));

    // Make sure not to reactivate any marks which had previously been
    // deactivated. By keeping track of the initial stored marks we are able to
    // discard any unintended consequences of deleting text and adding it again.
    tr.setStoredMarks(initialStoredMarks);

    // Allow the caller of this method to update the transaction before it is
    // returned and dispatched by ProseMirror.
    beforeDispatch?.({ tr, match, start, end });

    return tr;
  });

  return rule;
}

/**
 * Creates a node input rule based on the provided regex for the provided node
 * type.
 *
 * Input rules transform content as the user types based on whether a match is
 * found with a sequence of characters.
 */
export function nodeInputRule(parameter: NodeInputRuleParameter): SkippableInputRule {
  const { regexp, type, getAttributes, beforeDispatch } = parameter;

  const rule: SkippableInputRule = new InputRule(regexp, (state, match, start, end) => {
    const attributes = isFunction(getAttributes) ? getAttributes(match) : getAttributes;
    const { tr } = state;
    const captureGroup = match[1];
    const fullMatch = match[0];

    if (rule.shouldSkip?.({ state, captureGroup, fullMatch, start, end, ruleType: 'plain' })) {
      return null;
    }

    tr.replaceWith(start - 1, end, type.create(attributes));

    beforeDispatch?.({ tr, match, start, end });

    return tr;
  });

  return rule;
}

/**
 * Creates a plain rule based on the provided regex. You can see this being used
 * in the `@remirror/extension-emoji` when it is setup to use plain text.
 */
export function plainInputRule(parameter: PlainInputRuleParameter): SkippableInputRule {
  const { regexp, transformMatch, beforeDispatch } = parameter;

  const rule: SkippableInputRule = new InputRule(regexp, (state, match, start, end) => {
    const value = transformMatch(match);

    if (isNullOrUndefined(value)) {
      return null;
    }

    const { tr } = state;
    const captureGroup = match[1];
    const fullMatch = match[0];

    if (rule.shouldSkip?.({ state, captureGroup, fullMatch, start, end, ruleType: 'plain' })) {
      return null;
    }

    if (value === '') {
      tr.delete(start, end);
    } else {
      tr.replaceWith(start, end, state.schema.text(value));
    }

    beforeDispatch?.({ tr, match, start, end });

    return tr;
  });

  return rule;
}

export interface ShouldSkipParameter extends EditorStateParameter, UpdateCaptureTextParameter {
  /** The type of input rule that has been activated */
  ruleType: 'mark' | 'node' | 'plain';
}

interface ShouldSkip {
  /**
   * Every input rule calls this function before deciding whether or not to run.
   *
   * This is run for every successful input rule match to check if there are any
   * reasons to prevent it from running.
   *
   * In particular it is so that the input rule only runs when there are no
   * active checks that prevent it from doing so.
   *
   * - Other extension can register a `shouldSkip` handler
   * - Every time in input rule is running it makes sure it isn't blocked is run it makes sure it can run
   */
  shouldSkip?: ShouldSkipFunction;

  /**
   * A list of marks which if existing in the provided range should invalidate the range.
   */
  invalidMarks?: string[];
}

/**
 * A function which is called to check whether an input rule should be skipped.
 *
 * - When it returns false then it won't be skipped.
 * - When it returns true then it will be skipped.
 */
export type ShouldSkipFunction = (parameter: ShouldSkipParameter) => boolean;

/**
 * An input rule which can have a `shouldSkip` property that returns true when
 * the input rule should be skipped.
 */
export type SkippableInputRule = ShouldSkip & InputRule;
