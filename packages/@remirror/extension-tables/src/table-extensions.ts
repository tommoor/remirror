import {
  ApplySchemaAttributes,
  CommandFunction,
  CommandFunctionParameter,
  convertCommand,
  EditorState,
  extension,
  ExtensionPriority,
  ExtensionTag,
  NodeExtension,
  nonChainable,
  NonChainableCommandFunction,
  OnSetOptionsParameter,
  ProsemirrorPlugin,
  StateUpdateLifecycleParameter,
} from '@remirror/core';
import { TextSelection } from '@remirror/pm/state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  fixTables,
  fixTablesKey,
  mergeCells,
  setCellAttr,
  splitCell,
  tableEditing,
  toggleHeaderCell,
  toggleHeaderColumn,
  toggleHeaderRow,
} from '@remirror/pm/tables';

import {
  createTable,
  createTableNodeSchema,
  CreateTableParameter,
  TableSchemaSpec,
} from './table-utils';

export interface TableOptions {
  /**
   * When `true` the table will be resizable.
   *
   * @default true
   */
  resizable?: boolean;
}

let tablesEnabled = false;

@extension<TableOptions>({
  defaultOptions: {
    resizable: true,
  },
  defaultPriority: ExtensionPriority.Low,
})
export class TableExtension extends NodeExtension<TableOptions> {
  private lastGoodState?: EditorState = undefined;

  get name() {
    return 'table' as const;
  }

  createTags() {
    return [ExtensionTag.BlockNode];
  }

  /**
   * The last known good state that didn't need fixing. This helps make the fix
   * command more effective.
   */

  createNodeSpec(extra: ApplySchemaAttributes): TableSchemaSpec {
    return createTableNodeSchema(extra).table;
  }

  /**
   * Create the table extensions. Set the priority to low so that they appear
   * lower down in the node list.
   */
  createExtensions() {
    return [new TableRowExtension({ priority: ExtensionPriority.Low })];
  }

  onStateUpdate(parameter: StateUpdateLifecycleParameter): void {
    const { tr, state } = parameter;

    if (tr?.getMeta(fixTablesKey)?.fixTables) {
      this.lastGoodState = state;
    }
  }

  /**
   * Add the table plugins to the editor.
   */
  createExternalPlugins(): ProsemirrorPlugin[] {
    const plugins = [tableEditing()];

    if (this.options.resizable) {
      plugins.push(columnResizing({}));
    }

    return plugins;
  }

  /**
   * Create the commands that can be used for the table.
   */
  createCommands() {
    return {
      /**
       * Create a table in the editor at the current selection point.
       */
      createTable: (
        parameter: Pick<CreateTableParameter, 'rowsCount' | 'columnsCount' | 'withHeaderRow'>,
      ): CommandFunction => ({ tr, dispatch, state }) => {
        if (!tr.selection.empty) {
          return false;
        }

        const offset = tr.selection.anchor + 1;
        const nodes = createTable({ schema: state.schema, ...parameter });

        dispatch?.(
          tr
            .replaceSelectionWith(nodes)
            .scrollIntoView()
            .setSelection(TextSelection.near(tr.doc.resolve(offset))),
        );

        return true;
      },

      /**
       * Delete the table.
       */
      deleteTable: () => convertCommand(deleteTable),

      /**
       * Command to add a column before the column with the selection.
       */
      addTableColumnBefore: () => {
        return convertCommand(addColumnBefore);
      },

      /**
       * Command to add a column after the column with the selection.
       */
      addTableColumnAfter: () => convertCommand(addColumnAfter),

      /**
       * Remove selected column from the table.
       */
      deleteTableColumn: () => convertCommand(deleteColumn),

      /**
       * Add a table row before the current selection.
       */
      addTableRowBefore: () => convertCommand(addRowBefore),

      /**
       * Add a table row after the current selection.
       */
      addTableRowAfter: () => convertCommand(addRowAfter),

      /**
       * Delete the table row at the current selection.
       */
      deleteTableRow: () => convertCommand(deleteRow),

      /**
       * Toggles between merging cells.
       */
      toggleTableCellMerge: () => toggleMergeCellCommand,

      /**
       * Merge the table cells.
       */
      mergeTableCells: () => convertCommand(mergeCells),

      /**
       * Split the merged cells into individual cells.
       */
      splitTableCell: () => convertCommand(splitCell),

      /**
       * Toggles a column as the header column.
       */
      toggleTableHeaderColumn: () => convertCommand(toggleHeaderColumn),

      /**
       * Toggles a row as a table header row.
       */
      toggleTableHeaderRow: () => convertCommand(toggleHeaderRow),

      /**
       * Toggle a cell as a table header cell.
       */
      toggleTableHeaderCell: () => convertCommand(toggleHeaderCell),

      /**
       * Set the attribute for a table cell.
       */
      setTableCellAttribute: (name: string, value: unknown) =>
        convertCommand(setCellAttr(name, value)),

      /**
       * Fix all tables within the document.
       *
       * This is a **non-chainable** command.
       */
      fixTables: (): NonChainableCommandFunction =>
        nonChainable(fixTablesCommand(this.lastGoodState)),
    };
  }

  createHelpers() {
    return {
      /**
       * Enable table usage within the editor. This depends on the browser that
       * is being used.
       */
      enableTableSupport: () => {
        if (tablesEnabled) {
          return;
        }

        document.execCommand('enableObjectResizing', false, 'false');
        document.execCommand('enableInlineTableEditing', false, 'false');
        tablesEnabled = true;
      },
    };
  }

  /**
   * This managers the updates of the collaboration provider.
   */
  protected onSetOptions(parameter: OnSetOptionsParameter<TableOptions>): void {
    const { changes } = parameter;

    // TODO move this into a new method in `plugins-extension`.
    if (changes.resizable.changed) {
      this.store.updateExtensionPlugins(this);
    }
  }
}

/**
 * The extension for a table row node.
 */
@extension({ defaultPriority: ExtensionPriority.Low })
export class TableRowExtension extends NodeExtension {
  get name() {
    return 'tableRow' as const;
  }

  /**
   * Automatically create the `TableCellExtension` and `TableHeaderCellExtension`.
   */
  createExtensions() {
    return [
      new TableCellExtension({ priority: ExtensionPriority.Low }),
      new TableHeaderCellExtension({ priority: ExtensionPriority.Low }),
    ];
  }

  createNodeSpec(extra: ApplySchemaAttributes): TableSchemaSpec {
    return createTableNodeSchema(extra).tableRow;
  }
}

/**
 * The extension for a table cell node.
 */
@extension({ defaultPriority: ExtensionPriority.Low })
export class TableCellExtension extends NodeExtension {
  get name() {
    return 'tableCell' as const;
  }

  createNodeSpec(extra: ApplySchemaAttributes): TableSchemaSpec {
    return createTableNodeSchema(extra).tableCell;
  }
}

/**
 * The extension for the table header node.
 */
@extension({ defaultPriority: ExtensionPriority.Low })
export class TableHeaderCellExtension extends NodeExtension {
  get name() {
    return 'tableHeaderCell' as const;
  }

  createNodeSpec(extra: ApplySchemaAttributes): TableSchemaSpec {
    return createTableNodeSchema(extra).tableHeaderCell;
  }
}

/**
 * The command for fixing the tables.
 */
function fixTablesCommand(lastGoodState?: EditorState): CommandFunction {
  return ({ state, dispatch }) => {
    const tr = fixTables(state, lastGoodState);

    if (!tr) {
      return false;
    }

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
}

function toggleMergeCellCommand({ state, dispatch }: CommandFunctionParameter) {
  if (mergeCells(state, dispatch)) {
    return false;
  }

  return splitCell(state, dispatch);
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      table: TableExtension;
    }
  }
}
