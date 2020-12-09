import { ExtensionPriority } from '@remirror/core-constants';
import { isEmptyObject } from '@remirror/core-helpers';
import {
  AnyFunction,
  CommandFunction,
  NonChainableCommandFunction,
  Shape,
} from '@remirror/core-types';
import { KeyBindingCommandFunction } from '@remirror/core-types';
import { MessageDescriptor } from '@remirror/i18n';
import { CoreIcon } from '@remirror/icons';

import { AnyExtension, HelperAnnotation } from '../extension';
import { GetOptions, TypedPropertyDescriptor } from '../types';

/**
 * A class which is used as a singleton to track the metadata available on all
 * extensions.
 */
class BuiltinMeta {
  /**
   * Track the decorated command data.
   */
  private readonly commands = new Map<string, Remirror.ExtraCommandMeta>();

  /**
   * Update the command options via a shallow merge of the provided options. If
   * no options are provided the entry is deleted.
   *
   * @experimental
   */
  updateCommand(name: string, options?: Remirror.ExtraCommandMeta): void {
    if (!options) {
      this.commands.delete(name);
      return;
    }

    const decoratorOptions = this.commands.get(name) ?? {};
    this.commands.set(name, { ...decoratorOptions, ...options });
  }

  /**
   * Get the options applied via the `@command()` decorator. These can be used
   * for applying default messaging to each command.
   *
   * @experimental
   */
  getCommand(name: string): Remirror.ExtraCommandMeta;
  getCommand(): Map<string, Remirror.ExtraCommandMeta>;
  getCommand(name?: string): Remirror.ExtraCommandMeta | Map<string, Remirror.ExtraCommandMeta> {
    if (!name) {
      return this.commands;
    }

    return this.commands.get(name) ?? {};
  }
}

/**
 * Metadata used by the builtin decorators.
 *
 * @experimental
 */
export const builtinMeta = new BuiltinMeta();

/**
 * @experimental
 *
 * A decorator which can be applied to top level methods on an extension to
 * identify them as helpers. This can be used as a replacement for the
 * `createHelpers` method.
 *
 * To allow the TypeScript compiler to automatically infer types, please create
 * your methods with the following type signature.
 *
 * ```ts
 * import { CommandFunction } from '@remirror/core';
 *
 * type Signature = (...args: any[]) => CommandFunction;
 * ```
 *
 * The following is an example of how this can be used within your extension.
 *
 * ```ts
 * import { helper, Helper } from '@remirror/core';
 *
 * class MyExtension {
 *   get name() {
 *     return 'my';
 *   }
 *
 *   @helper()
 *   alwaysTrue(): Helper<boolean> {
 *     return true;
 *   }
 * }
 * ```
 *
 * The above helper can now be used within your editor instance.
 *
 * ```tsx
 * import { useRemirrorContext } from 'remirror/react';
 *
 * const MyEditorButton = () => {
 *   const { helpers } = useRemirrorContext();
 *
 *   return helpers.alwaysTrue() ? <button>My Button</button> : null
 * }
 * ```
 */
export function helper(options: HelperDecoratorOptions = {}) {
  return <Extension extends AnyExtension, Type>(
    target: Extension,
    propertyKey: string,
    _descriptor: TypedPropertyDescriptor<
      // This type signature helps enforce the need for the `Helper` annotation
      // while allowing for `null | undefined`.
      AnyFunction<NonNullable<Type> extends HelperAnnotation ? Type : never>
    >,
  ): void => {
    // Attach the options to the `decoratedCommands` property for this extension.
    (target.decoratedHelpers ??= {})[propertyKey] = options;
  };
}

/**
 * A decorator which can be applied to top level methods on an extension to
 * identify them as commands. This can be used as a replacement for the
 * `createCommands` method.
 *
 * If you prefer not to use decorators, then you can continue using
 * `createCommands`. Internally the decorators are being used as they are better
 * for documentation purposes.
 *
 * For automated type inference methods that use this decorator must implement
 * the following type signature.
 *
 * ```ts
 * import { CommandFunction } from '@remirror/core';
 *
 * type Signature = (...args: any[]) => CommandFunction;
 * ```
 *
 * The following is an example of how this can be used within your extension.
 *
 * ```ts
 * import { command, CommandFunction } from '@remirror/core';
 *
 * class MyExtension {
 *   get name() {
 *     return 'my';
 *   }
 *
 *   @command() myCommand(text: string): CommandFunction {return ({ tr, dispatch
 *   }) => {dispatch?.(tr.insertText('my command ' + text)); return true;
 *     }
 *   }
 * }
 * ```
 *
 * The above command can now be used within your editor instance.
 *
 * ```tsx
 * import { useRemirrorContext } from 'remirror/react';
 *
 * const MyEditorButton = () => {
 *   const { commands } = useRemirrorContext();
 *
 *   return <button onClick={() => commands.myCommand('hello')}>My Button</button>
 * }
 * ```
 *
 * @category Method Decorator
 */
export function command<Extension extends AnyExtension>(
  options?: ChainableCommandDecoratorOptions,
): ExtensionDecorator<Extension, CommandFunction, void>;
export function command<Extension extends AnyExtension>(
  options: NonChainableCommandDecoratorOptions,
): ExtensionDecorator<Extension, NonChainableCommandFunction, void>;
export function command(options: CommandDecoratorOptions = {}): any {
  return (target: any, propertyKey: string, _descriptor: any): void => {
    if (isEmptyObject(options)) {
      return;
    }

    // Attach the meta data from the command to the command extension.
    builtinMeta.updateCommand(propertyKey, options);

    // Attach the options to the decoratedCommands property for this extension.
    (target.decoratedCommands ??= {})[propertyKey] = options;
  };
}

/**
 * A decorator which can be applied to an extension method to
 * identify as a key binding method. This can be used as a replacement for
 * the `createKeymap` method depending on your preference.
 *
 * If you prefer not to use decorators, then you can continue using
 * `createKeymap`.
 *
 * @category Method Decorator
 */

export function keyBinding<Extension extends AnyExtension>(
  options: KeybindingDecoratorOptions<Required<GetOptions<Extension>>>,
) {
  return (
    target: Extension,
    propertyKey: string,
    _descriptor: TypedPropertyDescriptor<KeyBindingCommandFunction>,
  ): void => {
    // Attach the options to the decoratedCommands property for this extension.
    (target.decoratedKeybindings ??= {})[propertyKey] = options as any;
  };
}

export interface HelperDecoratorOptions {}

export interface KeybindingDecoratorOptions<Options extends Shape = Shape> {
  /**
   * The keypress sequence to intercept.
   *
   * - `Enter`
   * - `Shift-Enter`
   */
  key: string | ((options: Options, store: Remirror.ExtensionStore) => string);

  /**
   * This can be used to set a keybinding as inactive based on the provided
   * options.
   */
  isActive?: (options: Options, store: Remirror.ExtensionStore) => boolean;

  /**
   * The priority for this keybinding.
   */
  priority?:
    | ExtensionPriority
    | ((options: Options, store: Remirror.ExtensionStore) => ExtensionPriority);

  /**
   * The name of the command that the keybinding should be attached to.
   */
  command?: string;
}

type ExtensionDecorator<Extension extends AnyExtension, Fn, Return> = (
  target: Extension,
  propertyKey: string,
  _descriptor: TypedPropertyDescriptor<AnyFunction<Fn>>,
) => Return;

export interface BaseCommandDecoratorOptions {
  /**
   * The default command icon to use if this has a UI representation.
   */
  icon?: CommandDecoratorValue<CoreIcon>;

  /**
   * A label for the command with support for i18n. This makes use of
   * `babel-plugin-macros` to generate the message.
   */
  label?: CommandDecoratorMessage;

  /**
   * An i18n compatible description for the command with support for i18n.
   */
  description?: CommandDecoratorValue<MessageDescriptor>;
}

interface CommandDecoratorMessageParameter {
  /**
   * True when the command is enabled.
   */
  enabled: boolean;

  /**
   * True when the extension is active.
   */
  active: boolean;

  /**
   * Predefined attributes which can influence the returned value.
   */
  attrs: Shape;
}

export type CommandDecoratorValue<Value> =
  | ((parameter: CommandDecoratorMessageParameter) => Value)
  | Value;

export type CommandDecoratorMessage = CommandDecoratorValue<MessageDescriptor>;
interface ChainableCommandDecoratorOptions extends Remirror.CommandDecoratorOptions {
  /**
   * Set this to `true` to disable chaining of this command. This means it will
   * no longer be available when running `
   *
   * @default false
   */
  disableChaining?: false;
}
interface NonChainableCommandDecoratorOptions extends Remirror.CommandDecoratorOptions {
  /**
   * Set this to `true` to disable chaining of this command. This means it will
   * no longer be available when running `
   *
   * @default false
   */
  disableChaining: true;
}

export type CommandDecoratorOptions =
  | ChainableCommandDecoratorOptions
  | NonChainableCommandDecoratorOptions;

declare global {
  namespace Remirror {
    /**
     * Allow external extensions to supply additional data to the command
     * options.
     *
     * For example the keymap extension can add a keybinding to the named
     * command.
     */
    interface ExtraCommandMeta extends CommandDecoratorOptions {}

    /**
     * UX options for the command which can be extended.
     */
    interface CommandDecoratorOptions extends BaseCommandDecoratorOptions {}
  }
}
