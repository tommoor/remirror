import type { ReactElement, ReactNode } from 'react';

import { AnyExtension, isNullOrUndefined, shouldUseDomEnvironment } from '@remirror/core';
import { RemirrorPortals, usePortals } from '@remirror/extension-react-component';

import { useReactFramework } from './hooks/use-react-framework';
import { useRemirrorContext } from './hooks/use-remirror-context';
import { RemirrorContext } from './react-contexts';
import type { ReactFrameworkProps } from './react-framework';

/**
 * The props for the main `<Remirror />` component.
 */
export interface RemirrorProps<ExtensionUnion extends AnyExtension>
  extends ReactFrameworkProps<ExtensionUnion> {
  /**
   * The optional children which can be passed into the [`Remirror`].
   */
  children?: ReactNode;

  /**
   * Set this to `start` or `end` to automatically render the editor to the dom.
   *
   * When set to `start` the editor will be added before all other child
   * components. If `end` the editable editor will be added after all child
   * components.
   *
   * When no children are provided the editor will automatically be rendered
   * even without this prop being set.
   *
   * `start` is the preferred value since it helps avoid some of the issues that
   * can arise from `zIndex` issues with floating components rendered within the
   * context.
   *
   * @default undefined
   */
  autoRender?: boolean | 'start' | 'end';
}

/**
 * The default internal editor when rendering with react..
 */
const AutoRenderedEditor = () => <div {...useRemirrorContext().getRootProps()} />;

/**
 * [[`Remirror`]] is the component for putting the editor into into it's child
 * component.
 *
 * @remarks
 * This only supports one child. At the moment if that that child is a built in
 * html string element then it is also where the prosemirror editor will be
 * injected (root element).
 *
 * These can either be consumed using React Hooks
 * - `useRemirrorContext`
 * - `usePositioner`
 *
 * When no children are provided the default behavior is to automatically
 * create render into a `div` element.
 */
export const Remirror = <ExtensionUnion extends AnyExtension>(
  props: RemirrorProps<ExtensionUnion>,
): ReactElement<RemirrorProps<ExtensionUnion>> => {
  const { children, autoRender, ...frameworkProps } = props;
  const context = useReactFramework(frameworkProps);

  // Subscribe to updates from the [[`PortalContainer`]]
  const portals = usePortals(context.portalContainer);

  // A boolean flag which is true when a default editor should be rendered
  // first. If no children are provided and no configuration is provided for
  // autoRender, the editor will automatically be rendered.
  const autoRenderAtStart =
    autoRender === 'start' || autoRender === true || (!children && isNullOrUndefined(autoRender));

  // Whether to render the editor at the end of the editor.
  const autoRenderAtEnd = autoRender === 'end';

  return (
    <RemirrorContext.Provider value={context}>
      <RemirrorPortals portals={portals} />
      {autoRenderAtStart && (context.renderSsr() || <AutoRenderedEditor />)}
      {children}
      {autoRenderAtEnd && (context.renderSsr() || <AutoRenderedEditor />)}
    </RemirrorContext.Provider>
  );
};
