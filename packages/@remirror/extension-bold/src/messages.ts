import { defineMessage, select } from '@lingui/macro';

import { CommandDecoratorMessage } from '@remirror/core';

export const label: CommandDecoratorMessage = ({ attrs, active, enabled }) => {
  const activeString = String(active);

  return defineMessage({
    id: 'extension.command.toggle-bold.label',
    comment: 'The label to use for toggling the bold formatting',
    message: select(activeString, { true: 'Set Bold', false: 'Remove Bold' }),
  });
};

export const description: CommandDecoratorMessage = () =>
  defineMessage({
    id: 'extension.command.toggle-bold.description',
    comment: 'The label to use for toggling the bold formatting',
    message: 'Toggle between bold text.',
  });
