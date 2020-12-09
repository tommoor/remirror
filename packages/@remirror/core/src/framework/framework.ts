import { cx } from '@linaria/core';
import { createNanoEvents } from 'nanoevents';

import { ErrorConstant } from '@remirror/core-constants';
import {
  invariant,
  isEmptyArray,
  isFunction,
  isNumber,
  object,
  pick,
  uniqueId,
} from '@remirror/core-helpers';
import type {
  EditorState,
  EditorView,
  PrimitiveSelection,
  RemirrorContentType,
  RemirrorJSON,
  Shape,
  StateJSON,
  Transaction,
} from '@remirror/core-types';
import { getDocument, prosemirrorNodeToHtml } from '@remirror/core-utils';
import { Core } from '@remirror/theme';

import type { BuiltinPreset, UpdatableViewProps } from '../builtins';
import type { AnyExtension, CommandsFromExtensions, GetSchema } from '../extension';
import type { RemirrorManager } from '../manager';
import type { StateUpdateLifecycleParameter } from '../types';
import type {
  AddFrameworkHandler,
  BaseFramework,
  BaseListenerParameter,
  CreateStateFromContent,
  FocusType,
  FrameworkEvents,
  FrameworkOutput,
  FrameworkParameter,
  FrameworkProps,
  ListenerParameter,
  RemirrorEventListenerParameter,
  TriggerChangeParameter,
  UpdatableViewPropsObject,
  UpdateStateParameter,
} from './base-framework';

/**
 * This is the `Framework` class which is used to create an abstract class for
 * implementing `Remirror` into the framework of your choice.
 *
 * The best way to learn how to use it is to take a look at the [[`DomFramework`]]
 * and [[`ReactFramework`]] implementations.
 *
 * @remarks
 *
 * There are two methods and one getter property which must be implemented for this
 */
export abstract class Framework<
  ExtensionUnion extends AnyExtension = BuiltinPreset,
  Props extends FrameworkProps<ExtensionUnion> = FrameworkProps<ExtensionUnion>,
  Output extends FrameworkOutput<ExtensionUnion> = FrameworkOutput<ExtensionUnion>
> implements BaseFramework<ExtensionUnion> {
  /**
   * A unique ID for the editor which can also be used as a key in frameworks
   * that need it.
   */
  readonly #uid = uniqueId();

  /**
   * A method which enables retrieving the props from the editor.
   */
  #getProps: () => Props;

  /**
   * The private reference to the previous state.
   */
  #previousState: EditorState<GetSchema<ExtensionUnion>> | undefined;

  /**
   * A previous state that can be overridden by the framework implementation.
   */
  protected previousStateOverride?: EditorState<GetSchema<ExtensionUnion>>;

  /**
   * True when this is the first render.
   */
  #firstRender = true;

  /**
   * The event listener which allows consumers to subscribe to the different
   * events taking place in the editor. Events currently supported are:
   *
   * - `destroy`
   * - `focus`
   * - `blur`
   * - `updated`
   */
  #events = createNanoEvents<FrameworkEvents<ExtensionUnion>>();

  /**
   * The event listener which allows consumers to subscribe to the different
   * events taking place in the editor. Events currently supported are:
   *
   * - `destroy`
   * - `focus`
   * - `blur`
   * - `updated`
   */
  protected get addHandler(): AddFrameworkHandler<ExtensionUnion> {
    return (this.#addHandler ??= this.#events.on.bind(this.#events));
  }

  /**
   * The handler which is bound to the events listener object.
   */
  #addHandler?: AddFrameworkHandler<ExtensionUnion>;

  /**
   * The updatable view props.
   */
  protected get updatableViewProps(): UpdatableViewPropsObject {
    return {
      attributes: () => this.getAttributes(),
      editable: () => this.props.editable ?? true,
    };
  }

  /**
   * True when this is the first render of the editor.
   */
  protected get firstRender(): boolean {
    return this.#firstRender;
  }

  /**
   * Store the name of the framework.
   */
  abstract get name(): string;

  /**
   * The props passed in when creating or updating the `Framework` instance.
   */
  get props(): Props {
    return this.#getProps();
  }

  /**
   * Returns the previous editor state. On the first render it defaults to
   * returning the current state. For the first render the previous state and
   * current state will always be equal.
   */
  protected get previousState(): EditorState<GetSchema<ExtensionUnion>> {
    return this.previousStateOverride ?? this.#previousState ?? this.initialEditorState;
  }

  /**
   * Create the editor state from a `remirror` content type. This should be
   * passed in during initialization.
   */
  private createStateFromContent: CreateStateFromContent<ExtensionUnion>;

  /**
   * The instance of the [[`RemirrorManager`]].
   */
  protected get manager(): RemirrorManager<ExtensionUnion> {
    return this.props.manager;
  }

  /**
   * The ProseMirror [[`EditorView`]].
   */
  protected get view(): EditorView<GetSchema<ExtensionUnion>> {
    return this.manager.view;
  }

  /**
   * The document to use for rendering and outputting HTML.
   */
  get document(): Document {
    return getDocument(this.props.forceEnvironment);
  }

  /**
   * A unique id for the editor. Can be used to differentiate between editors.
   *
   * Please note that this ID is only locally unique, it should not be used as a
   * database key.
   */
  protected get uid(): string {
    return this.#uid;
  }

  #initialEditorState: EditorState<GetSchema<ExtensionUnion>>;

  /**
   * The initial editor state from when the editor was first created.
   */
  get initialEditorState(): EditorState<GetSchema<ExtensionUnion>> {
    return this.#initialEditorState;
  }

  constructor(parameter: FrameworkParameter<ExtensionUnion, Props>) {
    const { getProps, createStateFromContent, initialEditorState, element } = parameter;

    this.#getProps = getProps;
    this.createStateFromContent = createStateFromContent;
    this.#initialEditorState = initialEditorState;

    // Attach the framework instance to the manager. The manager will set up the
    // update listener and manage updates to the instance of the framework
    // automatically.
    this.manager.attachFramework(this, this.updateListener.bind(this));

    if (this.manager.view) {
      return;
    }

    // Create the ProsemirrorView and initialize our editor manager with it.
    const view = this.createView(initialEditorState, element);
    this.manager.addView(view);
  }

  /**
   * Setup the manager event listeners which are disposed of when the manager is
   * destroyed.
   */
  private updateListener(parameter: StateUpdateLifecycleParameter) {
    const { state, tr } = parameter;
    return this.#events.emit('updated', this.eventListenerParameter({ state, tr }));
  }

  /**
   * Update the constructor props passed in. Useful for frameworks like react
   * where props are constantly changing and when using hooks function closures
   * can become stale.
   *
   * You can call the update method with the new `props` to update the internal
   * state of this instance.
   */
  update(parameter: FrameworkParameter<ExtensionUnion, Props>): this {
    const { getProps, createStateFromContent } = parameter;
    this.#getProps = getProps;
    this.createStateFromContent = createStateFromContent;

    return this;
  }

  /**
   * Retrieve the editor state.
   */
  protected readonly getState = (): EditorState<GetSchema<ExtensionUnion>> =>
    this.view.state ?? this.initialEditorState;

  /**
   * Retrieve the previous editor state.
   */
  protected readonly getPreviousState = (): EditorState<GetSchema<ExtensionUnion>> =>
    this.previousState;

  /**
   * This method must be implement by the extending framework class. It returns
   * an [[`EditorView`]] which is added to the [[`RemirrorManager`]].
   */
  protected abstract createView(
    state: EditorState<GetSchema<ExtensionUnion>>,
    element?: Element,
  ): EditorView<GetSchema<ExtensionUnion>>;

  /**
   * This is used to implement how the state updates are used within your
   * application instance.
   *
   * It must be implemented.
   */
  protected abstract updateState(parameter: UpdateStateParameter<GetSchema<ExtensionUnion>>): void;

  /**
   * Update the view props.
   */
  protected updateViewProps(...keys: UpdatableViewProps[]): void {
    const props = pick(this.updatableViewProps, keys);

    this.view.setProps({ ...this.view.props, ...props });
  }

  /**
   * This sets the attributes for the ProseMirror Dom node.
   */
  protected getAttributes(ssr?: false): Record<string, string>;
  protected getAttributes(ssr: true): Shape;
  protected getAttributes(ssr?: boolean): Shape {
    const { attributes, autoFocus } = this.props;
    const managerAttributes = this.manager.store?.attributes;

    // The attributes which were passed in as props.
    const propAttributes = isFunction(attributes)
      ? attributes(this.eventListenerParameter())
      : attributes;

    // Whether or not the editor is focused.
    let focus: Shape = {};

    // In Chrome 84 when autofocus is set to any value including `"false"` it
    // will actually trigger the autofocus. This check makes sure there is no
    // `autofocus` attribute attached unless `autoFocus` is expressly a truthy
    // value.
    if (autoFocus || isNumber(autoFocus)) {
      focus = ssr ? { autoFocus: true } : { autofocus: 'true' };
    }

    const defaultAttributes = {
      role: 'textbox',
      ...focus,
      'aria-multiline': 'true',
      ...(!(this.props.editable ?? true) ? { 'aria-readonly': 'true' } : {}),
      'aria-label': this.props.label ?? '',
      ...managerAttributes,
      class: cx(ssr && 'Prosemirror', Core.EDITOR, managerAttributes?.class),
    };

    return { ...defaultAttributes, ...propAttributes } as Shape;
  }

  /**
   * Part of the Prosemirror API and is called whenever there is state change in
   * the editor.
   *
   * @internalremarks
   * How does it work when transactions are dispatched one after the other.
   */
  protected readonly dispatchTransaction = (tr: Transaction): void => {
    // This should never happen, but it may have slipped through in the certain places.
    invariant(!this.manager.destroyed, {
      code: ErrorConstant.MANAGER_PHASE_ERROR,
      message:
        'A transaction was dispatched to a manager that has already been destroyed. Please check your set up, or open an issue.',
    });

    tr = this.props.onDispatchTransaction?.(tr, this.getState()) ?? tr;

    const previousState = this.getState();
    const { state, transactions } = previousState.applyTransaction(tr);

    this.#previousState = previousState;

    // Use the abstract method to update the state.
    this.updateState({ state, tr, transactions });

    // Update the view props when an update is requested
    const forcedUpdates = this.manager.store.getForcedUpdates(tr);

    if (!isEmptyArray(forcedUpdates)) {
      this.updateViewProps(...forcedUpdates);
    }
  };

  /**
   * Adds `onBlur` and `onFocus` listeners.
   *
   * When extending this class make sure to call this method once
   * `ProsemirrorView` has been added to the dom.
   */
  protected addFocusListeners(): void {
    this.view.dom.addEventListener('blur', this.onBlur);
    this.view.dom.addEventListener('focus', this.onFocus);
  }

  /**
   * Remove `onBlur` and `onFocus` listeners.
   *
   * When extending this class in your framework, make sure to call this just
   * before the view is destroyed.
   */
  protected removeFocusListeners(): void {
    this.view.dom.removeEventListener('blur', this.onBlur);
    this.view.dom.removeEventListener('focus', this.onFocus);
  }

  /**
   * Called when the component unmounts and is responsible for cleanup.
   *
   * @remarks
   *
   * - Removes listeners for the editor `blur` and `focus` events
   */
  destroy(): void {
    // Let it clear that this instance has been destroyed.
    this.#events.emit('destroy');

    if (this.view) {
      // Remove the focus and blur listeners.
      this.removeFocusListeners();
    }
  }

  /**
   * Use this method in the `onUpdate` event to run all change handlers.
   */
  readonly onChange = (parameter: ListenerParameter<ExtensionUnion> = object()): void => {
    this.props.onChange?.(this.eventListenerParameter(parameter));

    if (this.#firstRender) {
      this.#firstRender = false;
    }
  };

  /**
   * Listener for editor 'blur' events
   */
  private readonly onBlur = (event: Event) => {
    const parameter = this.eventListenerParameter();

    this.props.onBlur?.(parameter, event);
    this.#events.emit('blur', parameter, event);
  };

  /**
   * Listener for editor 'focus' events
   */
  private readonly onFocus = (event: Event) => {
    const parameter = this.eventListenerParameter();

    this.props.onFocus?.(parameter, event);
    this.#events.emit('focus', parameter, event);
  };

  /**
   * Sets the content of the editor.
   *
   * @param content
   * @param triggerChange
   */
  private readonly setContent = (
    content: RemirrorContentType,
    { triggerChange = false }: TriggerChangeParameter = {},
  ) => {
    const state = this.createStateFromContent(content);
    this.updateState({ state, triggerChange });
  };

  /**
   * Clear the content of the editor (reset to the default empty node).
   *
   * @param triggerChange - whether to notify the onChange handler that the
   * content has been reset
   */
  private readonly clearContent = ({ triggerChange = false }: TriggerChangeParameter = {}) => {
    this.setContent(this.manager.createEmptyDoc(), { triggerChange });
  };

  /**
   * The params used in the event listeners and the state listener
   */
  protected baseListenerParameter(
    parameter: ListenerParameter<ExtensionUnion>,
  ): BaseListenerParameter<ExtensionUnion> {
    const { state, tr } = parameter;

    return {
      tr,
      internalUpdate: !tr,
      view: this.view,
      getHTML: this.getHTML(state),
      getJSON: this.getJSON(state),
      getRemirrorJSON: this.getRemirrorJSON(state),
      getText: this.getText(state),
    };
  }

  /**
   * Creates the parameters passed into all event listener handlers. e.g.
   * `onChange`
   */
  protected eventListenerParameter(
    parameter: ListenerParameter<ExtensionUnion> = object(),
  ): RemirrorEventListenerParameter<ExtensionUnion> {
    const { state, tr } = parameter;

    return {
      firstRender: this.#firstRender,
      ...this.baseListenerParameter({ tr, state }),
      state: state ?? this.getState(),
      createStateFromContent: this.createStateFromContent,
      previousState: this.previousState,
    };
  }

  /**
   * Focus the editor.
   */
  protected readonly focus = (position?: FocusType): void => {
    (this.manager.store.commands as CommandsFromExtensions<BuiltinPreset>).focus(position);
  };

  /**
   * Blur the editor.
   */
  protected readonly blur = (position?: PrimitiveSelection): void => {
    (this.manager.store.commands as CommandsFromExtensions<BuiltinPreset>).blur(position);
  };

  /**
   * Methods and properties which are made available to all consumers of the
   * `Framework` class.
   */
  protected get baseOutput(): FrameworkOutput<ExtensionUnion> {
    return {
      manager: this.manager,
      ...this.manager.store,
      addHandler: this.addHandler,

      // Commands => these are also available on the commands and will
      // be removed soon.
      focus: this.focus,
      blur: this.blur,

      // Properties
      uid: this.#uid,
      view: this.view,

      // Getter Methods
      getState: this.getState,
      getPreviousState: this.getPreviousState,
      getExtension: this.manager.getExtension.bind(this.manager),

      // Setter Methods
      clearContent: this.clearContent,
      setContent: this.setContent,
    };
  }

  /**
   * Every framework implementation must provide it's own custom output.
   */
  abstract get frameworkOutput(): Output;

  /**
   * A method to get all the content in the editor as text. Depending on the
   * content in your editor, it is not guaranteed to preserve it 100%, so it's
   * best to test that it meets your needs before consuming.
   */
  private readonly getText = (state?: EditorState<GetSchema<ExtensionUnion>>) => (
    lineBreakDivider = '\n\n',
  ) => {
    const { doc } = state ?? this.getState();
    return doc.textBetween(0, doc.content.size, lineBreakDivider);
  };

  /**
   * Retrieve the HTML from the `doc` prosemirror node.
   *
   * This assumes a dom environment.
   */
  private readonly getHTML = (state?: EditorState<GetSchema<ExtensionUnion>>) => () => {
    return prosemirrorNodeToHtml((state ?? this.getState()).doc, this.document);
  };

  /**
   * Retrieve the full state json object
   */
  private readonly getJSON = (state?: EditorState<GetSchema<ExtensionUnion>>) => (): StateJSON => {
    return (state ?? this.getState()).toJSON() as StateJSON;
  };

  /**
   * Return the json object for the prosemirror document.
   */
  private readonly getRemirrorJSON = (
    state?: EditorState<GetSchema<ExtensionUnion>>,
  ) => (): RemirrorJSON => {
    return (state ?? this.getState()).doc.toJSON() as RemirrorJSON;
  };
}
