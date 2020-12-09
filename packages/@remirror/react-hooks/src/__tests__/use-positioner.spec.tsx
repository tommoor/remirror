import { FC } from 'react';

import { emptyCoords, emptyVirtualPosition } from '@remirror/extension-positioner';
import { createReactManager, Remirror } from '@remirror/react';
import { strictRender } from '@remirror/testing/react';

import { usePositioner } from '../use-positioner';

test('`usePositioner` default values', () => {
  const HookComponent: FC = () => {
    const positionerProps = usePositioner('bubble');

    expect(positionerProps).toEqual({
      active: false,
      ...emptyCoords,
      ...emptyVirtualPosition,
    });

    return <div />;
  };

  strictRender(
    <Remirror manager={createReactManager([])}>
      <HookComponent />
    </Remirror>,
  );
});
