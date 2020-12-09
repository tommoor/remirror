import type { AnyRemirrorManager } from '@remirror/core';
import { reactPreset } from '@remirror/preset-react';
import { act as renderAct, render } from '@remirror/testing/react';

import { useManager } from '../../..';

jest.mock('@remirror/preset-react', () => {
  const actual = jest.requireActual('@remirror/preset-react');
  return {
    ...actual,
    reactPreset: jest.fn().mockImplementation((...args: any[]) => actual.reactPreset(...args)),
  };
});

describe('useManager', () => {
  it('does not recreate the react preset for every rerender', () => {
    const Component = (_: { options?: object }) => {
      useManager(() => [], {});

      return null;
    };

    const { rerender } = render(<Component />);
    rerender(<Component options={{}} />);
    rerender(<Component options={{}} />);

    expect(reactPreset).toHaveBeenCalledTimes(1);
  });

  it('rerenders when the manager is destroyed', () => {
    let manager: AnyRemirrorManager;
    const Component = (_: { options?: object }) => {
      manager = useManager(() => [], {});

      return null;
    };

    const { rerender } = render(<Component />);

    rerender(<Component options={{}} />);
    rerender(<Component options={{}} />);

    renderAct(() => manager.destroy());
    expect(reactPreset).toHaveBeenCalledTimes(2);

    rerender(<Component options={{}} />);
    expect(reactPreset).toHaveBeenCalledTimes(2);
  });
});
