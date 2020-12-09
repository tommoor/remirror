import { renderEditor } from 'jest-remirror';

import { ReactPlaceholderExtension, reactPreset } from '../..';

test('it renders with options', () => {
  const editor = renderEditor(() => reactPreset({ placeholder: 'Hello' }));
  expect(editor.manager.getExtension(ReactPlaceholderExtension).options.placeholder).toBe('Hello');
});
