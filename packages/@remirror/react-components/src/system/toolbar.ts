import { cx } from '@linaria/core';
import { ToolbarHTMLProps, ToolbarOptions } from 'reakit/Toolbar/Toolbar';

import { Components } from '@remirror/theme';

import { BootstrapRoleOptions } from './role';

export type BootstrapToolbarOptions = BootstrapRoleOptions & ToolbarOptions;

export function useToolbarProps(
  _: BootstrapToolbarOptions,
  htmlProps: ToolbarHTMLProps = {},
): ToolbarHTMLProps {
  return { ...htmlProps, className: cx(Components.TOOLBAR, htmlProps.className) };
}
