import type { Editor } from 'prosekit/core'
import type { TableExtension } from 'prosekit/extensions/table'
import { useEditorDerivedValue } from 'prosekit/react'
import { MenuItem, MenuPopup, MenuPositioner } from 'prosekit/react/menu'
import {
  TableHandleColumnMenuRoot,
  TableHandleColumnMenuTrigger,
  TableHandleColumnPopup,
  TableHandleColumnPositioner,
  TableHandleDragPreview,
  TableHandleDropIndicator,
  TableHandleRoot,
  TableHandleRowMenuRoot,
  TableHandleRowMenuTrigger,
  TableHandleRowPopup,
  TableHandleRowPositioner,
} from 'prosekit/react/table-handle'
import { TableMap } from 'prosemirror-tables'

// Number of rows and columns of the table containing the current selection, or
// null when the caret is not inside a table. Used to disable Delete Row/Column
// when they would leave an empty table — prosemirror-tables reports those
// commands as executable but silently does nothing at a 1x1 table.
function getTableShape(editor: Editor<TableExtension>): { rows: number; cols: number } | null {
  const { $head } = editor.state.selection
  for (let depth = $head.depth; depth >= 0; depth--) {
    const node = $head.node(depth)
    if ((node.type.spec as { tableRole?: string }).tableRole === 'table') {
      const map = TableMap.get(node)
      return { rows: map.height, cols: map.width }
    }
  }
  return null
}

export function getTableHandleState(editor: Editor<TableExtension>) {
  const shape = getTableShape(editor)
  return {
    addTableColumnBefore: {
      canExec: editor.commands.addTableColumnBefore.canExec(),
      command: () => editor.commands.addTableColumnBefore(),
    },
    addTableColumnAfter: {
      canExec: editor.commands.addTableColumnAfter.canExec(),
      command: () => editor.commands.addTableColumnAfter(),
    },
    deleteCellSelection: {
      canExec: editor.commands.deleteCellSelection.canExec(),
      command: () => editor.commands.deleteCellSelection(),
    },
    deleteTableColumn: {
      canExec: editor.commands.deleteTableColumn.canExec() && (shape === null || shape.cols > 1),
      command: () => editor.commands.deleteTableColumn(),
    },
    addTableRowAbove: {
      canExec: editor.commands.addTableRowAbove.canExec(),
      command: () => editor.commands.addTableRowAbove(),
    },
    addTableRowBelow: {
      canExec: editor.commands.addTableRowBelow.canExec(),
      command: () => editor.commands.addTableRowBelow(),
    },
    deleteTableRow: {
      canExec: editor.commands.deleteTableRow.canExec() && (shape === null || shape.rows > 1),
      command: () => editor.commands.deleteTableRow(),
    },
    deleteTable: {
      canExec: editor.commands.deleteTable.canExec(),
      command: () => editor.commands.deleteTable(),
    },
  }
}

const TABLE_MENU_ITEM_CLASS = 'relative min-w-32 scroll-my-1 rounded-sm px-3 py-1.5 flex items-center justify-between gap-8 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 hover:data-[disabled=true]:opacity-50 data-danger:text-red-500 box-border cursor-default select-none whitespace-nowrap outline-hidden data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800'

interface Props {
  dir?: 'ltr' | 'rtl'
}

export default function TableHandle(props: Props) {
  const state = useEditorDerivedValue(getTableHandleState)

  return (
    <TableHandleRoot className="contents">
      <TableHandleDragPreview />
      <TableHandleDropIndicator />
      <TableHandleColumnPositioner className="translate-y-[80%] flex items-center box-border justify-center duration-150 transition-discrete transition data-[state=closed]:opacity-0 starting:opacity-0 opacity-100 data-[state=closed]:scale-95 starting:scale-95 scale-100">
        <TableHandleColumnPopup className="flex items-center box-border justify-center">
          <TableHandleColumnMenuRoot>
            <TableHandleColumnMenuTrigger className="flex items-center box-border justify-center h-[1.2em] w-[1.5em] bg-white dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm text-gray-500/50 dark:text-gray-500/50 border border-gray-200 dark:border-gray-800 border-solid p-0 overflow-hidden cursor-pointer">
              <div className="i-lucide-grip-horizontal size-5 block"></div>
            </TableHandleColumnMenuTrigger>
            <MenuPositioner className="z-10">
              <MenuPopup className="relative block max-h-100 min-w-32 select-none overflow-auto whitespace-nowrap p-1 box-border rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg [&:not([data-state])]:hidden">
                {state.addTableColumnBefore.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.addTableColumnBefore.command}
                  >
                    <span>Insert Left</span>
                  </MenuItem>
                )}
                {state.addTableColumnAfter.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.addTableColumnAfter.command}
                  >
                    <span>Insert Right</span>
                  </MenuItem>
                )}
                {state.deleteCellSelection.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.deleteCellSelection.command}
                  >
                    <span>Clear Contents</span>
                    <span className="text-xs tracking-widest text-gray-500 dark:text-gray-500">Del</span>
                  </MenuItem>
                )}
                {state.deleteTableColumn.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.deleteTableColumn.command}
                  >
                    <span>Delete Column</span>
                  </MenuItem>
                )}
                {state.deleteTable.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    data-danger=""
                    onSelect={state.deleteTable.command}
                  >
                    <span>Delete Table</span>
                  </MenuItem>
                )}
              </MenuPopup>
            </MenuPositioner>
          </TableHandleColumnMenuRoot>
        </TableHandleColumnPopup>
      </TableHandleColumnPositioner>
      <TableHandleRowPositioner
        placement={props.dir === 'rtl' ? 'right' : 'left'}
        className="ltr:translate-x-[80%] rtl:translate-x-[-80%] flex items-center box-border justify-center duration-150 transition-discrete transition data-[state=closed]:opacity-0 starting:opacity-0 opacity-100 data-[state=closed]:scale-95 starting:scale-95 scale-100"
      >
        <TableHandleRowPopup className="flex items-center box-border justify-center">
          <TableHandleRowMenuRoot>
            <TableHandleRowMenuTrigger className="flex items-center box-border justify-center h-[1.5em] w-[1.2em] bg-white dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm text-gray-500/50 dark:text-gray-500/50 border border-gray-200 dark:border-gray-800 border-solid p-0 overflow-hidden cursor-pointer">
              <div className="i-lucide-grip-vertical size-5 block"></div>
            </TableHandleRowMenuTrigger>
            <MenuPositioner className="z-10">
              <MenuPopup className="relative block max-h-100 min-w-32 select-none overflow-auto whitespace-nowrap p-1 box-border rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg [&:not([data-state])]:hidden">
                {state.addTableRowAbove.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.addTableRowAbove.command}
                  >
                    <span>Insert Above</span>
                  </MenuItem>
                )}
                {state.addTableRowBelow.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.addTableRowBelow.command}
                  >
                    <span>Insert Below</span>
                  </MenuItem>
                )}
                {state.deleteCellSelection.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.deleteCellSelection.command}
                  >
                    <span>Clear Contents</span>
                    <span className="text-xs tracking-widest text-gray-500 dark:text-gray-500">Del</span>
                  </MenuItem>
                )}
                {state.deleteTableRow.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    onSelect={state.deleteTableRow.command}
                  >
                    <span>Delete Row</span>
                  </MenuItem>
                )}
                {state.deleteTable.canExec && (
                  <MenuItem
                    className={TABLE_MENU_ITEM_CLASS}
                    data-danger=""
                    onSelect={state.deleteTable.command}
                  >
                    <span>Delete Table</span>
                  </MenuItem>
                )}
              </MenuPopup>
            </MenuPositioner>
          </TableHandleRowMenuRoot>
        </TableHandleRowPopup>
      </TableHandleRowPositioner>
    </TableHandleRoot>
  )
}
