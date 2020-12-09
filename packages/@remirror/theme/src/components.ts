import { css } from '@linaria/core';

import { getTheme } from './theme';

const foreground = getTheme((t) => t.color.foreground);
const text = getTheme((t) => t.color.text);
const background = getTheme((t) => t.color.background);
const backdrop = getTheme((t) => t.color.backdrop);
const border = getTheme((t) => t.color.border);
const shadow1 = getTheme((t) => t.color.shadow1);
const borderHover = getTheme((t) => t.color.hover.border);
const borderActive = getTheme((t) => t.color.active.border);
const primary = getTheme((t) => t.color.primary);
const primaryText = getTheme((t) => t.color.primaryText);
const primaryHover = getTheme((t) => t.color.hover.primary);
const primaryHoverText = getTheme((t) => t.color.hover.primaryText);
const primaryActive = getTheme((t) => t.color.active.primary);
const primaryActiveText = getTheme((t) => t.color.active.primaryText);

export const BUTTON = css`
  display: inline-flex;
  font-weight: 400;
  align-items: center;
  justify-content: center;
  user-select: none;
  padding: 0.375em 0.75em;
  line-height: 1.5;
  border-radius: 0.25rem;
  text-decoration: none;
  border: 1px solid ${border};
  cursor: pointer;
  white-space: nowrap;
  color: ${primaryText};
  background-color: ${primary};
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  font-size: 100%;
  &[aria-disabled='true'] {
    cursor: auto;
  }
  &:not([aria-disabled='true']) {
    &:hover {
      color: ${primaryHoverText};
      border-color: ${borderHover};
      background-color: ${primaryHover};
    }
    &:active,
    &[data-active],
    &[aria-expanded='true'] {
      color: ${primaryActiveText};
      border-color: ${borderActive};
      background-color: ${primaryActive};
    }
  }
` as 'rmr-button';

export const COMPOSITE = css`
  align-items: center;
  justify-content: center;
  padding: 0.375em 0.75em;
  font-size: 100%;
  border: 0;
  color: inherit;
  background-color: inherit;
  &:not([aria-selected='true']) {
    color: inherit;
    background-color: inherit;
  }
  [aria-activedescendant='*']:focus &[aria-selected='true'],
  [aria-activedescendant='*']:focus ~ * &[aria-selected='true'] {
    color: ${text};
    background-color: ${background};
  }
` as 'rmr-composite';

export const DIALOG = css`
  position: fixed;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 0.25rem;
  padding: 1em;
  max-height: calc(100vh - 56px);
  outline: 0;
  border: 1px solid ${border};
  color: ${text};
  z-index: 999;

  &:focus {
    box-shadow: 0 0 0 0.2em ${shadow1};
  }
` as 'rmr-dialog';

export const DIALOG_BACKDROP = css`
  background-color: ${backdrop};
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
` as 'rmr-dialog-backdrop';

export const FORM = css`
  > *:not(:first-child) {
    margin-top: 1rem;
  }
` as 'rmr-form';

export const FORM_MESSAGE = css`
  font-size: 0.8em;
  margin-top: 0.5rem !important;
` as 'rmr-form-message';

export const FORM_LABEL = css`
  display: block;
  margin: 0 0 0.5rem 0 !important;

  input[type='checkbox'] + &,
  input[type='radio'] + & {
    display: inline-block;
    margin: 0 0 0 0.5rem !important;
  }
` as 'rmr-form-label';

export const FORM_GROUP = css`
  display: block;
  color: ${text};
  border: 1px solid ${border};
  border-radius: 0.25rem;
  padding: 0.5rem 1rem 1rem;
  & > * {
    display: block;
  }
` as 'rmr-form-group';

export const GROUP = css`
  display: flex;

  & > :not(:first-child) {
    margin-left: -1px;
  }

  & > :not(:first-child):not(:last-child):not(.first-child):not(.last-child) {
    border-radius: 0;
  }

  & > :first-child:not(:last-child),
  & > .first-child {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  & > :last-child:not(:first-child),
  & > .last-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
` as 'rmr-group';

export const INPUT = css`
  display: block;
  width: 100%;
  border-radius: 0.2rem;
  padding: 0.5em 0.75em;
  font-size: 100%;
  border: 1px solid ${getTheme((t) => t.hue.gray[2])};
  color: ${getTheme((t) => t.hue.gray[5])};
  margin: 0 !important;

  &:focus {
    border-color: ${getTheme((t) => t.hue.gray[3])};
  }
`;

export const MENU = css`
  display: flex;
  border-radius: 0;
` as 'rmr-menu';

export const MENU_BUTTON_LEFT = css`
  [role='menu'] > & {
    left: ${getTheme((t) => t.space[2])};
  }
` as 'rmr-menu-button-left';
export const MENU_BUTTON_RIGHT = css`
  [role='menu'] > & {
    right: ${getTheme((t) => t.space[2])};
  }
` as 'rmr-menu-button-right';

export const MENU_BUTTON_NESTED_LEFT = css`
  svg {
    margin-right: ${getTheme((t) => t.space[2])};
  }
` as 'rmr-menu-button-nested-left';

export const MENU_BUTTON_NESTED_RIGHT = css`
  [role='menu'] > & {
    padding-right: 2em !important;
  }

  svg {
    margin-left: ${getTheme((t) => t.space[2])};
  }
` as 'rmr-menu-button-nested-right';

export const MENU_BUTTON = css`
  position: relative;

  svg {
    fill: currentColor;
    width: 0.65em;
    height: 0.65em;

    [role='menu'] > & {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    }

    [role='menubar'] > & {
      display: none;
    }
  }
` as 'rmr-menu-button';

export const MENU_BAR = css`
  position: relative;
  display: flex;
  white-space: nowrap;
  box-shadow: none !important;

  &[aria-orientation='vertical'] {
    padding: 0.25em 0;
  }

  &[aria-orientation='horizontal'] {
    padding: 0;
  }
` as 'rmr-menu-bar';

export const FLEX_COLUMN = css`
  flex-direction: column;
` as `rmr-flex-column`;

export const FLEX_ROW = css`
  flex-direction: row;
` as `rmr-flex-row`;

export const MENU_ITEM = css`
  &&& {
    line-height: 1.5;
    text-align: left;
    justify-content: flex-start;
    border: 0;
    border-radius: 0;
    font-size: 100%;
    background: transparent;
    color: ${foreground};
    margin: 0;
    user-select: none;
    cursor: default;
    text-decoration: none;

    &:focus,
    &[aria-expanded='true'] {
      background-color: ${primary};
      color: ${primaryText};
      box-shadow: none !important;
    }

    &:active,
    &[data-active] {
      background-color: ${primaryActive} !important;
      color: ${primaryActiveText} !important;
    }
  }
`;

export const MENU_ITEM_ROW = css`
  padding: 0 ${getTheme((t) => t.space[2])};
`;

export const MENU_ITEM_COLUMN = css`
  padding: 0 ${getTheme((t) => t.space[4])};
`;

export const MENU_ITEM_CHECKBOX = css`
  position: relative;
  outline: 0;

  &[aria-checked='true'] {
    &:before {
      content: '✓';
      position: absolute;
      top: 0;
      left: 0.4em;
      width: 1em;
      height: 1em;
    }
  }
` as 'rmr-menu-item-checkbox';

export const MENU_ITEM_RADIO = css`
  position: relative;
  outline: 0;

  &[aria-checked='true'] {
    &:before {
      content: '•';
      position: absolute;
      font-size: 1.4em;
      top: -0.25em;
      left: 0.35em;
      width: 0.7142857143em;
      height: 0.7142857143em;
    }
  }
` as 'rmr-menu-item-radio';

export const MENU_GROUP = css`
  display: inherit;
  flex-direction: inherit;
` as 'rmr-menu-group';

export const POPOVER = css`
  [data-arrow] {
    background-color: transparent;
    & .stroke {
      fill: ${border};
    }
    & .fill {
      fill: ${background};
    }
  }
` as 'rmr-popover';

export const ROLE = css`
  box-sizing: border-box;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  font-family: ${getTheme((t) => t.fontFamily.default)};
  color: ${text};
  background-color: ${background};
  /* border: 1px solid ${border}; */
`;

export const SEPARATOR = css`
  border: 1px solid ${border};
  border-width: 0 1px 0 0;
  margin: 0 0.5em;
  padding: 0;
  width: 0;
  height: auto;
  &[aria-orientation='horizontal'] {
    border-width: 0 0 1px 0;
    margin: 0.5em 0;
    width: auto;
    height: 0;
  }
`;

export const TAB = css`
  background-color: transparent;
  border: 1px solid transparent;
  border-width: 1px 1px 0 1px;
  border-radius: 0.25rem 0.25rem 0 0;
  font-size: 100%;
  padding: 0.5em 1em;
  margin: 0 0 -1px 0;
  &[aria-selected='true'] {
    background-color: ${background};
    border-color: ${border};
  }
  [aria-orientation='vertical'] & {
    border-width: 1px 0 1px 1px;
    border-radius: 0.2em 0 0 0.2em;
    margin: 0 -1px 0 0;
  }
` as 'rmr-tab';

export const TAB_LIST = css`
  display: flex;
  flex-direction: row;
  border: 1px solid ${border};
  border-width: 0 0 1px 0;
  margin: 0 0 1em 0;
  &[aria-orientation='vertical'] {
    flex-direction: column;
    border-width: 0 1px 0 0;
    margin: 0 1em 0 0;
  }
` as 'rmr-tab-list';

export const TABBABLE = css`
  &:not([type='checkbox']):not([type='radio']) {
    transition: box-shadow 0.15s ease-in-out;
    outline: 0;
    &:focus {
      box-shadow: 0 0 0 0.2em ${shadow1};
      position: relative;
      z-index: 2;
    }
    &:hover {
      z-index: 2;
    }
  }
  &[aria-disabled='true'] {
    opacity: 0.5;
  }
`;

export const TOOLBAR = css`
  display: flex;
  flex-direction: row;

  & > *:not(:first-child) {
    margin: 0 0 0 0.5em;
  }

  &[aria-orientation='vertical'] {
    display: inline-flex;
    flex-direction: column;

    & > *:not(:first-child) {
      margin: 0.5em 0 0;
    }
  }
`;

export const TOOLTIP = css`
  background-color: ${getTheme((t) => t.hue.gray[8])};
  font-size: 0.8em;
  padding: 0.5rem;
  border-radius: 0.25rem;
  z-index: 999;

  [data-arrow] {
    background-color: transparent;
    & .stroke {
      fill: transparent;
    }
    & .fill {
      fill: ${getTheme((t) => t.hue.gray[8])};
    }
  }
`;
