import { ErrorConstant, ExtensionPriority } from '@remirror/core-constants';
import { entries, isEmptyObject, object } from '@remirror/core-helpers';
import type { AnyFunction, EmptyShape, ProsemirrorAttributes, Shape } from '@remirror/core-types';
import { isMarkActive, isNodeActive, isSelectionEmpty } from '@remirror/core-utils';

import {
  ActiveFromExtensions,
  AnyExtension,
  extension,
  Helper,
  HelpersFromExtensions,
  isMarkExtension,
  isNodeExtension,
  PlainExtension,
} from '../extension';
import { throwIfNameNotUnique } from '../helpers';
import type { ExtensionHelperReturn } from '../types';
import { helper, HelperDecoratorOptions } from './decorators';

/**
 * Helpers are custom methods that can provide extra functionality to the
 * editor.
 *
 * @remarks
 *
 * They can be used for pulling information from the editor or performing custom
 * async commands.
 *
 * Also provides the default helpers used within the extension.
 *
 * @category Builtin Extension
 */
@extension({})
export class HelpersExtension extends PlainExtension {
  get name() {
    return 'helpers' as const;
  }

  /**
   * Helpers are only available once the view has been added to
   * `RemirrorManager`.
   */
  onView(): void {
    const helpers: Record<string, AnyFunction> = object();
    const active: Record<string, AnyFunction> = object();
    const names = new Set<string>();

    for (const extension of this.store.extensions) {
      if (isNodeExtension(extension)) {
        active[extension.name] = (attrs?: ProsemirrorAttributes) => {
          return isNodeActive({ state: this.store.getState(), type: extension.type, attrs });
        };
      }

      if (isMarkExtension(extension)) {
        active[extension.name] = () => {
          return isMarkActive({ trState: this.store.getState(), type: extension.type });
        };
      }

      const extensionHelpers = extension.createHelpers?.() ?? {};

      for (const helperName of Object.keys(extension.decoratedHelpers ?? {})) {
        extensionHelpers[helperName] = (extension as Shape)[helperName].bind(extension);
      }

      if (isEmptyObject(extensionHelpers)) {
        continue;
      }

      for (const [name, helper] of entries(extensionHelpers)) {
        throwIfNameNotUnique({ name, set: names, code: ErrorConstant.DUPLICATE_HELPER_NAMES });
        helpers[name] = helper;
      }
    }

    this.store.setStoreKey('active', active);
    this.store.setStoreKey('helpers', helpers);
    this.store.setExtensionStore('helpers', helpers as any);
  }

  /**
   * Check whether the selection is empty.
   */
  @helper()
  isSelectionEmpty(): Helper<boolean> {
    return isSelectionEmpty(this.store.view.state);
  }
}

declare global {
  namespace Remirror {
    interface ManagerStore<ExtensionUnion extends AnyExtension> {
      /**
       * The helpers provided by the extensions used.
       */
      helpers: HelpersFromExtensions<ExtensionUnion>;

      /**
       * Check which nodes and marks are active under the current user
       * selection.
       *
       * ```ts
       * const { active } = manager.store;
       *
       * return active.bold() ? 'bold' : 'regular';
       * ```
       */
      active: ActiveFromExtensions<ExtensionUnion>;
    }

    interface BaseExtension {
      /**
       * `ExtensionHelpers`
       *
       * This pseudo property makes it easier to infer Generic types of this
       * class.
       *
       * @internal
       */
      ['~H']: this['createHelpers'] extends AnyFunction
        ? ReturnType<this['createHelpers']>
        : EmptyShape;

      /**
       * @experimental
       *
       * Stores all the helpers that have been added via decorators to the
       * extension instance. This is used by the `HelpersExtension` to pick the
       * helpers.
       *
       * @internal
       */
      decoratedHelpers?: Record<string, HelperDecoratorOptions>;

      /**
       * A helper method is a function that takes in arguments and returns a
       * value depicting the state of the editor specific to this extension.
       *
       * @remarks
       *
       * Unlike commands they can return anything and may not effect the
       * behavior of the editor.
       *
       * Below is an example which should provide some idea on how to add
       * helpers to the app.
       *
       * ```tsx
       * // extension.ts
       * import { ExtensionFactory } from '@remirror/core';
       *
       * const MyBeautifulExtension = ExtensionFactory.plain({
       *   name: 'beautiful',
       *   createHelpers: () => ({
       *     checkBeautyLevel: () => 100
       *   }),
       * })
       * ```
       *
       * ```
       * // app.tsx
       * import { useRemirrorContext } from 'remirror/react';
       *
       * const MyEditor = () => {
       *   const { helpers } = useRemirrorContext({ autoUpdate: true });
       *
       *   return helpers.beautiful.checkBeautyLevel() > 50
       *     ? (<span>😍</span>)
       *     : (<span>😢</span>);
       * };
       * ```
       */
      createHelpers?(): ExtensionHelperReturn;
    }

    interface ExtensionStore {
      /**
       * Helper method to provide information about the content of the editor.
       * Each extension can register its own helpers.
       *
       * This should only be accessed after the `onView` lifecycle method
       * otherwise it will throw an error.
       */
      helpers: HelpersFromExtensions<AllExtensionUnion>;
    }

    interface AllExtensions {
      helpers: HelpersExtension;
    }
  }
}
