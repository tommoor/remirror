/**
 * @module
 *
 * Taken from
 * https://github.com/react-icons/react-icons/blob/10199cca7abeb3efbc647090714daa279da45779/packages/react-icons/src/iconBase.tsx#L1-L62
 */

import { createElement, ReactElement, ReactNode, SVGAttributes } from 'react';

import type { CoreIcon } from '@remirror/icons';
import { IconTree } from '@remirror/icons';
import * as Icons from '@remirror/icons';

import { IconContext } from './icons-context';

/**
 * Convert the provided icon tree to a react element.
 */
function Tree2Element(tree: IconTree[]): Array<ReactElement<object>> {
  return tree.map((node, index) =>
    createElement(node.tag, { key: index, ...node.attr }, Tree2Element(node.child ?? [])),
  );
}

/**
 * A higher order component which creates the Icon component.
 */
export function GenIcon(tree: IconTree[], viewBox = '0 0 24 24'): IconType {
  // eslint-disable-next-line react/display-name
  return (props: IconBaseProps) => (
    <IconBase viewBox={viewBox} {...props}>
      {Tree2Element(tree ?? [])}
    </IconBase>
  );
}

export interface IconProps extends IconBaseProps {
  /**
   * The name of the core icon to use.
   */
  icon: Icons.CoreIcon;
}

/**
 * Dynamic icons for the remirror codebase..
 */
export const Icon = (props: IconProps): JSX.Element => {
  const { icon } = props;
  return <IconBase {...props}>{Tree2Element(Icons[icon])}</IconBase>;
};

export interface IconBaseProps extends SVGAttributes<SVGElement> {
  children?: ReactNode;
  size?: string | number;
  color?: string;
  title?: string;
}

export type IconType = (props: IconBaseProps) => JSX.Element;

/**
 * The base icon as an svg with the icon context available
 */
export const IconBase = (props: IconBaseProps): JSX.Element => {
  const renderSvg = (conf: IconContext) => {
    const computedSize = props.size ?? conf.size ?? '1em';
    let className;

    if (conf.className) {
      className = conf.className;
    }

    if (props.className) {
      className = (className ? `${className} ` : '') + props.className;
    }

    const { title, ...svgProps } = props;

    return (
      <svg
        stroke='currentColor'
        fill='currentColor'
        strokeWidth='0'
        {...conf.attr}
        {...svgProps}
        className={className}
        style={{ color: props.color ?? conf.color, ...conf.style, ...props.style }}
        height={computedSize}
        width={computedSize}
        xmlns='http://www.w3.org/2000/svg'
      >
        {title && <title>{title}</title>}
        {props.children}
      </svg>
    );
  };

  return <IconContext.Consumer>{renderSvg}</IconContext.Consumer>;
};
