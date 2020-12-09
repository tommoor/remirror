import type { CompiledMessage } from '@lingui/core/cjs/i18n';

export type EnMessages = Record<
  | 'components.bold.menu.icon.label'
  | 'components.h1.menu.icon.label'
  | 'components.h2.menu.icon.label'
  | 'components.h3.menu.icon.label'
  | 'components.image.dialog.description.label'
  | 'components.image.dialog.description.placeholder'
  | 'components.image.dialog.label'
  | 'components.image.dialog.source.label'
  | 'components.image.menu.icon.label'
  | 'components.italic.menu.icon.label'
  | 'components.static-menu.label'
  | 'components.underline.menu.icon.label'
  | 'extension.command.toggle-bold.description'
  | 'extension.command.toggle-bold.label'
  | 'extension.command.toggle-heading.description'
  | 'extension.command.toggle-heading.label',
  CompiledMessage
>;

/**
 * The messages available for the `en` locale.
 */
export const messages: EnMessages;
