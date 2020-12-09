import isEqual from 'fast-deep-equal/react';
import { DependencyList, useEffect, useRef } from 'react';
import warning from 'tiny-warning';

/**
 * A `useEffect` function which issues a warning when the dependencies provided
 * are deeply equal, but only in development.
 *
 * This is used in places where it's important for developers to memoize and
 * wrap methods with `useCallback`.
 */
export const useEffectWithWarning: typeof useEffect =
  process.env.NODE_ENV === 'production'
    ? useEffect
    : (effect, deps) => {
        const firstUpdate = useRef(true);
        const ref = useRef<DependencyList>();
        const unnecessaryChange = useRef(0);

        useEffect(() => {
          // Use the effect only the first render.
          if (firstUpdate.current) {
            firstUpdate.current = false;

            // Hold the initial reference for the deps.
            ref.current = deps;
            return;
          }

          // Only run the following on every subsequent render.
          if (!isEqual(deps, ref.current)) {
            unnecessaryChange.current = 0;
            ref.current = deps;
            return;
          }

          unnecessaryChange.current += 1;
        });

        const wrappedEffect = () => {
          warning(
            unnecessaryChange.current === 0,
            `The dependencies passed into your useEffect are identical, but an update has been triggered ${unnecessaryChange.current} time(s). Please consider wrapping the values with \`useMemo\` or \`useCallback\` to memoize your dependencies and prevent unnecessary re-renders.: ${deps}`,
          );

          return effect();
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
        useEffect(wrappedEffect, deps);
      };
