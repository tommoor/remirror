import { get as getPath } from '@ngard/tiny-get';
import {
  createContext,
  Dispatch,
  MutableRefObject,
  PropsWithChildren,
  useRef,
  useState,
} from 'react';

import {
  contextHookFactory,
  ContextSelector,
  CreateContextReturn,
  GetPath,
  PathValue,
} from './create-context-hook';

/**
 * Create a context and provider with built in setters and getters.
 *
 * ```tsx
 * import { createContextState } from 'create-context-state';
 *
 * const [CountProvider, useCount] = createContextState(({ set, get }) => ({
 *   defaultValue: 0,
 *   value: 0,
 *   increment: () => set((state) => ({ value: state.value + 1 })),
 *   decrement: () => set((state) => ({ value: state.value - 1 })),
 *   reset: () => get('value') !== get('defaultValue'),
 * }));
 *
 * const App = () => {
 *   return (
 *     <CountProvider>
 *       <Counter />
 *     </CountProvider>
 *   );
 * };
 *
 * const Counter = () => {
 *   const { value, increment, decrement, reset } = useCount();
 *
 *   return (
 *     <>
 *       <span>{value}</span>
 *       <button onClick={() => increment()}>+</button>
 *       <button onClick={() => decrement()}>-</button>
 *       <button onClick={() => reset()}>reset</button>
 *     </>
 *   );
 * };
 * ```
 */
export function createContextState<Context extends object>(
  creator: ContextCreator<Context>,
): CreateContextReturn<object, Context> {
  // Create the initial react context.
  const DefaultContext = createContext<Context | null>(null);

  // Create the hook for retrieving the created context state.
  const useContextHook = contextHookFactory(DefaultContext);

  const Provider = (props: PropsWithChildren<object>) => {
    // Keep a ref to the context so that the `get` function can always be called
    // with the latest value.
    const contextRef = useRef<Context | null>(null);
    const setContextRef = useRef<Dispatch<React.SetStateAction<Context>>>();

    const [context, setContext] = useState(() => {
      return creator({ get: createGet(contextRef), set: createSet(setContextRef) });
    });

    // Keep the refs updated on each render.
    contextRef.current = context;
    setContextRef.current = setContext;

    return <DefaultContext.Provider value={context}>{props.children}</DefaultContext.Provider>;
  };

  return [Provider, useContextHook, DefaultContext];
}

/**
 * Create a get function which is used to get the current state within the
 * `context` creator.
 */
function createGet<Context extends object>(
  ref: MutableRefObject<Context | null>,
): GetContext<Context> {
  return (pathOrSelector?: unknown) => {
    if (!ref.current) {
      throw new Error(
        '`get` called outside of function scope. `get` can only be called within a function.',
      );
    }

    if (!pathOrSelector) {
      return ref.current;
    }

    if (typeof pathOrSelector === 'string') {
      return getPath(ref.current, pathOrSelector);
    }

    if (typeof pathOrSelector !== 'function') {
      throw new TypeError(
        'Invalid arguments passed to `useContextHook`. The hook must be called with zero arguments, a getter function or a path string.',
      );
    }

    return pathOrSelector(ref.current);
  };
}

/**
 * Create a `set` function which is used to set the context.
 */
function createSet<Context extends object>(
  ref: MutableRefObject<Dispatch<React.SetStateAction<Context>> | undefined>,
): SetContext<Context> {
  return (partial) => {
    if (!ref.current) {
      throw new Error(
        '`set` called outside of function scope. `set` can only be called within a function.',
      );
    }

    ref.current((context) => ({
      ...context,
      ...(typeof partial === 'function' ? partial(context) : partial),
    }));
  };
}

export interface GetContext<Context extends object> {
  (): Context;
  <SelectedValue>(selector: ContextSelector<Context, SelectedValue>): SelectedValue;
  <Path extends GetPath<Context>>(path: Path): PathValue<Context, Path>;
}
export type PartialContext<Context extends object> =
  | Partial<Context>
  | ((context: Context) => Partial<Context>);

export type SetContext<Context extends object> = (partial: PartialContext<Context>) => void;

export interface GetSetContext<Context extends object> {
  /**
   * Get the context with a partial update.
   */
  get: GetContext<Context>;

  /**
   * Set the context with a partial update.
   */
  set: SetContext<Context>;
}

export type ContextCreator<Context extends object> = (
  getSetContext: GetSetContext<Context>,
) => Context;
