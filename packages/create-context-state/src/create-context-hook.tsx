import { get as getPath } from '@ngard/tiny-get';
import pick from 'object.pick';
import { ComponentType, Context as ReactContext, createContext, FC, useContext } from 'react';
import usePrevious from 'use-previous';

/**
 * Create a Provider and context retriever from a custom hook.
 */
export function createContextHook<Props extends object, Context extends object>(
  useHook: UseHook<Props, Context>,
): CreateContextReturn<Props, Context> {
  const DefaultContext = createContext<Context | null>(null);

  const Provider: FC<Props> = (props) => {
    const context = useHook(props);

    return <DefaultContext.Provider value={context}>{props.children}</DefaultContext.Provider>;
  };

  const useHookContext = contextHookFactory(DefaultContext);

  return [Provider, useHookContext, DefaultContext];
}

export type CreateContextReturn<Props extends object, Context extends object> = [
  Provider: ComponentType<Props>,
  hook: ContextHook<Context>,
  DefaultContext: ReactContext<Context | null>,
];

type UseHook<Props extends object, Context extends object> = (props: Props) => Context;

export function contextHookFactory<Context extends object>(
  DefaultContext: ReactContext<Context | null>,
): ContextHook<Context> {
  return (pathOrSelector?: unknown, equalityCheck?: EqualityChecker<Context>) => {
    const context = useContext(DefaultContext);
    const previousContext = usePrevious(context);

    if (!context) {
      throw new Error(
        '`useContextHook` must be placed inside the `Provider` returned by the `createContextState` method',
      );
    }

    if (!pathOrSelector) {
      return context;
    }

    if (typeof pathOrSelector === 'string') {
      return getPath(context, pathOrSelector);
    }

    if (Array.isArray(pathOrSelector)) {
      return pick(context, pathOrSelector);
    }

    if (typeof pathOrSelector !== 'function') {
      throw new TypeError(
        'invalid arguments passed to `useContextHook`. This hook must be called with zero arguments, a getter function or a path string.',
      );
    }

    const value = pathOrSelector(context);

    if (!previousContext || !equalityCheck) {
      return value;
    }

    const previousValue = pathOrSelector(previousContext);

    return equalityCheck(previousValue, value) ? previousValue : value;
  };
}

export type ContextSelector<Context extends object, SelectedValue> = (
  state: Context,
) => SelectedValue;
export type EqualityChecker<SelectedValue> = (
  selectedValue: SelectedValue,
  newSelectedValue: unknown,
) => boolean;

export interface ContextHook<Context extends object> {
  (): Context;
  <Key extends keyof Context>(pickedKeys: Key[]): Pick<Context, Key>;
  <SelectedValue>(
    selector: ContextSelector<Context, SelectedValue>,
    equalityFn?: EqualityChecker<SelectedValue>,
  ): SelectedValue;
  <Path extends GetPath<Context>>(path: Path): PathValue<Context, Path>;
}

export type GetRecursivePath<Type, Key extends keyof Type> = Key extends string
  ? Type[Key] extends Record<string, any>
    ?
        | `${Key}.${GetRecursivePath<Type[Key], Exclude<keyof Type[Key], keyof any[]>> & string}`
        | `${Key}.${Exclude<keyof Type[Key], keyof any[]> & string}`
    : never
  : never;
export type GetJoinedPath<Type> = GetRecursivePath<Type, keyof Type> | keyof Type;

export type GetPath<Type> = GetJoinedPath<Type> extends string | keyof Type
  ? GetJoinedPath<Type>
  : keyof Type;

export type PathValue<Type, Path extends GetPath<Type>> = Path extends `${infer Key}.${infer Rest}`
  ? Key extends keyof Type
    ? Rest extends GetPath<Type[Key]>
      ? PathValue<Type[Key], Rest>
      : never
    : never
  : Path extends keyof Type
  ? Type[Path]
  : never;
