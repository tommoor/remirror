import { FC } from 'react';

import { createReactManager, Remirror } from '@remirror/react';
import { strictRender } from '@remirror/testing/react';

import { useMultiPositioner } from '../use-multi-positioner';

test('`useMultiPositioner` default values', () => {
  const HookComponent: FC = () => {
    const positioners = useMultiPositioner('bubble');

    expect(positioners).toEqual([]);

    return <div />;
  };

  strictRender(
    <Remirror manager={createReactManager([])}>
      <HookComponent />
    </Remirror>,
  );
});
