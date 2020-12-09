import { cx } from '@linaria/core';
import { SeparatorHTMLProps, SeparatorOptions } from 'reakit/Separator/Separator';
import { useFade } from 'reakit-system-palette/utils/fade';
import { usePalette } from 'reakit-system-palette/utils/palette';

import { Components } from '@remirror/theme';

import { BootstrapRoleOptions } from './role';

export type BootstrapSeparatorOptions = BootstrapRoleOptions & SeparatorOptions;

export function useSeparatorProps(
  _: BootstrapSeparatorOptions,
  htmlProps: SeparatorHTMLProps = {},
): SeparatorHTMLProps {
  return { ...htmlProps, className: cx(Components.SEPARATOR, htmlProps.className) };
}
