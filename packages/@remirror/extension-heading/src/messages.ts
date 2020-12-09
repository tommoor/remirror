import { defineMessage, select } from '@lingui/macro';

import { CommandDecoratorMessage } from '@remirror/core';

export const label: CommandDecoratorMessage = ({ attrs }) => {
  const { level } = attrs;
  return defineMessage({
    id: 'extension.command.toggle-heading.label',
    comment: 'Label for the toggle heading command',
    message: `Heading ${level ?? 1}`,
  });
};

export const description: CommandDecoratorMessage = ({ attrs, active }) => {
  return defineMessage({
    id: 'extension.command.toggle-heading.description',
    comment: 'Description of the toggle heading command',
    message: select(`${active}`, {
      true: `Remove Heading ${attrs.level ?? 1}`,
      false: `Activate Heading ${attrs.level ?? 1}`,
    }),
  });
};
