/**
 * Render prop type
 *
 * @template Props - The props for this component
 */
export type RenderProp<Props = object> = (props: Props) => React.ReactElement;

/**
 * Provides strong typing for the `as` prop.
 * @template Props - The props for the component.
 */
export type As<Props = any> = React.ElementType<Props>;

/**
 * @template ElementType - The element type for the html attributes.
 */
export type HTMLAttributesWithRef<ElementType = any> = React.HTMLAttributes<ElementType> &
  React.RefAttributes<ElementType>;

/**
 * Returns only the HTML attributes inside `Props`
 *
 * ```ts
 * type OnlyId = ExtractHTMLAttributes<{ id: string; foo: string }>;
 * type HTMLAttributes = ExtractHTMLAttributes<any>;
 * ```
 *
 * @template Props - The type of the available props
 */
export type ExtractHTMLAttributes<Props> = Pick<
  HTMLAttributesWithRef,
  Extract<keyof HTMLAttributesWithRef, keyof Props>
>;

/**
 * Generic component props with `as` prop.
 *
 * @template Props Additional props
 * @template Type React component or string element
 */
export type PropsWithAs<Props, Type extends As> = Props &
  Omit<React.ComponentProps<Type>, 'as' | keyof Props> & {
    as?: Type;
    children?: React.ReactNode | RenderProp<ExtractHTMLAttributes<any>>;
  };
