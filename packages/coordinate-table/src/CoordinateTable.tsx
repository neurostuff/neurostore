import {
  HotTable,
  type HotTableProps,
  type HotTableRef,
} from "@handsontable/react-wrapper";
import { Box, Typography } from "@mui/material";
import { registerAllModules } from "handsontable/registry";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-classic.min.css";
import {
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import {
  CBMA_COLUMNS,
  hotColumns,
  invalidCells,
  isBlankRow,
  type CoordinateColumn,
} from "./columns";
import { CoordinateTableToolbar } from "./CoordinateTableToolbar";
import type { GridEngagement } from "./StaticTable";
import { InsertRowsDialog } from "./InsertRowsDialog";
import { sanitizePaste } from "./paste";
import { insertionIndices, sameValue } from "./rows";
import { CONTEXT_MENU, DEFAULT_SETTINGS } from "./settings";

registerAllModules();

type Row = Record<string, unknown>;
type Size = { width: number; height: number };

/** What the app can do to the grid from outside it. */
export interface CoordinateTableHandle {
  /** Carries on what the reviewer began on the static table: a cell selected, typed in or pasted on, or its toolbar. */
  engage(engagement: GridEngagement): void;
  /** Commits the cell edit still open, if one is. */
  finish(): void;
}

export interface CoordinateTableProps {
  /** The rows as the app holds them; a new list replaces what the grid shows. */
  points: Row[];
  /** Called once for each committed change whose every cell is valid, with every row after it. */
  onChange(points: Row[]): void;
  /** Called with the row a selection ends on, once the reviewer selects in the grid. */
  onSelectRow?(row: number): void;
  columns?: CoordinateColumn[];
  readOnly?: boolean;
  /** The accessible name of the grid. */
  label?: string;
  /** The row the toolbar adds. */
  newRow?: () => Row;
  /** The most rows the grid shows whole, growing to them; past them it is `maxHeight` high and scrolls. */
  autoRows?: number;
  /** The height of a grid of more than `autoRows` rows. */
  maxHeight?: number;
  /** The fewest rows the grid keeps: a delete that would leave fewer is refused. */
  minRows?: number;
  /** Whether the columns keep their widths ("none") or stretch across the grid ("all"). */
  stretchH?: "none" | "all";
  ref?: Ref<CoordinateTableHandle>;
}

const emptyRow = (): Row => ({});
const copyRows = (rows: Row[]) => rows.map((row) => ({ ...row }));

/**
 * The rows the grid edits in place, and how many cells of them are invalid; replaced when `points` holds other
 * rows, kept when it holds the ones the grid shows.
 */
function useHeldRows(points: Row[]) {
  const [held, setHeld] = useState(() => ({
    source: points,
    rows: copyRows(points),
    invalid: 0,
  }));
  if (held.source !== points) {
    const same = sameValue(held.rows, points);
    const next = same
      ? { ...held, source: points }
      : { source: points, rows: copyRows(points), invalid: 0 };
    setHeld(next);
    return { ...next, setInvalid: () => {} };
  }
  return {
    ...held,
    setInvalid: (invalid: number) =>
      setHeld((current) => ({ ...current, invalid })),
  };
}

interface GridProps {
  hot: RefObject<HotTableRef | null>;
  rows: Row[];
  newRow: () => Row;
  settings: HotTableProps;
  hooks: HotTableProps;
  height: HotTableProps["height"];
}

/** Handsontable over `rows` and `height`, which it takes when first drawn; the table loads new ones itself. */
const Grid = memo(
  function Grid({ hot, rows, newRow, settings, hooks, height }: GridProps) {
    return (
      <HotTable
        {...DEFAULT_SETTINGS}
        ref={hot}
        data={rows}
        dataSchema={newRow}
        {...settings}
        {...hooks}
        height={height}
        rowHeaders
      />
    );
  },
  (before, after) =>
    before.newRow === after.newRow &&
    before.settings === after.settings &&
    before.hooks === after.hooks,
);

/** A spreadsheet of coordinate points: type, paste, fill, and add and delete rows; each committed change is one onChange. */
export function CoordinateTable({
  points,
  onChange,
  columns = CBMA_COLUMNS,
  readOnly = false,
  label = "coordinates",
  newRow = emptyRow,
  onSelectRow,
  autoRows = 15,
  maxHeight = 500,
  minRows = 0,
  stretchH = "none",
  ref,
}: CoordinateTableProps) {
  const hot = useRef<HotTableRef>(null);
  const { rows, invalid, setInvalid } = useHeldRows(points);
  const [inserting, setInserting] = useState(false);

  /** Sends the rows when every cell is valid; else says how many are not, leaving out the rows `added` just made. */
  const commit = (added = false) => {
    const next = copyRows(rows);
    const problems = invalidCells(next, columns);
    if (problems.length === 0) {
      setInvalid(0);
      onChange(next);
    } else if (added) {
      setInvalid(
        problems.filter(([at]) => !isBlankRow(next[at], columns)).length,
      );
    } else {
      setInvalid(problems.length);
      hot.current?.hotInstance?.validateCells();
    }
  };
  const latestCommit = useRef(commit);
  const latestSelect = useRef(onSelectRow);
  useLayoutEffect(() => {
    latestCommit.current = commit;
    latestSelect.current = onSelectRow;
  });
  const hooks = useMemo(
    () => ({
      beforePaste: (data: unknown[][]) => sanitizePaste(data),
      afterChange: (changes: unknown[] | null) => {
        if (changes) latestCommit.current();
      },
      afterCreateRow: (_index: number, _amount: number, source?: string) => {
        if (source !== "auto") latestCommit.current(true);
      },
      beforeRemoveRow: (_index: number, amount: number) =>
        (hot.current?.hotInstance?.countRows() ?? 0) - amount >= minRows,
      afterRemoveRow: () => latestCommit.current(),
      afterAutofill: () => hot.current?.hotInstance?.validateCells(),
      afterSelectionEnd: (_row: number, _column: number, row: number) =>
        latestSelect.current?.(row),
      beforeRefreshDimensions: (before: Size, after: Size) =>
        before.width !== after.width,
    }),
    [minRows],
  );
  const settings = useMemo(
    () => ({
      columns: hotColumns(columns, readOnly),
      colHeaders: columns.map((column) => column.header),
      colWidths: columns.map((column) => column.width ?? 80),
      contextMenu: readOnly ? false : CONTEXT_MENU,
      stretchH,
    }),
    [columns, readOnly, stretchH],
  );

  const selectedRows = () => hot.current?.hotInstance?.getSelected() ?? [];

  const insertRows = (count: number) => {
    const instance = hot.current?.hotInstance;
    setInserting(false);
    if (!instance) return;
    if (instance.countRows() === 0)
      return instance.alter("insert_row_above", 0, count);
    const selected = selectedRows();
    const below = selected.length
      ? insertionIndices(selected).insertBelowIndex
      : rows.length - 1;
    instance.alter("insert_row_below", below, count);
  };

  const deleteRows = () => {
    const instance = hot.current?.hotInstance;
    const [selected] = selectedRows();
    if (!instance || !selected) return;
    const [start, , end] = selected;
    const from = Math.min(start, end);
    instance.alter("remove_row", [[from, Math.abs(end - start) + 1]]);
  };

  /** Selects the cell at `row`, `column` and takes the keyboard; the instance, unless the grid has no rows. */
  const selectCell = (row: number, column: number) => {
    const instance = hot.current?.hotInstance;
    if (!instance || instance.countRows() === 0) return undefined;
    instance.selectCell(Math.min(row, instance.countRows() - 1), column);
    instance.listen();
    return instance;
  };

  const finish = () => {
    const editor = hot.current?.hotInstance?.getActiveEditor();
    if (editor?.isOpened()) editor.finishEditing();
  };
  const latestFinish = useRef(finish);
  useLayoutEffect(() => {
    latestFinish.current = finish;
  });
  useLayoutEffect(() => () => latestFinish.current(), []);

  useImperativeHandle(ref, () => ({
    finish,
    engage: (engagement) => {
      switch (engagement.kind) {
        case "select":
          selectCell(engagement.row, engagement.column);
          break;
        case "type": {
          const editor = selectCell(
            engagement.row,
            engagement.column,
          )?.getActiveEditor();
          editor?.beginEditing(engagement.text);
          editor?.setValue(engagement.text);
          break;
        }
        case "paste":
          selectCell(engagement.row, engagement.column)
            ?.getPlugin("copyPaste")
            .paste(engagement.text);
          break;
        case "addRow":
          insertRows(1);
          break;
        case "addRows":
          setInserting(true);
          break;
        case "deleteRows":
          if (engagement.row !== null)
            hot.current?.hotInstance?.selectRows(engagement.row);
          deleteRows();
      }
    },
  }));

  const height = rows.length <= autoRows ? "auto" : maxHeight;
  useEffect(() => {
    const instance = hot.current?.hotInstance;
    const settings = instance?.getSettings();
    if (!instance || (settings!.data === rows && settings!.height === height))
      return;
    // Drawn once the effects of this commit are done, so an engagement they carry on (a selection, an editor) is drawn with the rows.
    instance.suspendRender();
    if (settings!.data !== rows) instance.updateData(rows);
    if (settings!.height !== height) instance.updateSettings({ height });
    queueMicrotask(() => instance.resumeRender());
  }, [rows, height]);

  return (
    <Box role="group" aria-label={label} data-coordinate-table="">
      <InsertRowsDialog
        open={inserting}
        onClose={() => setInserting(false)}
        onSubmit={(n) => insertRows(n)}
      />
      <Box sx={{ display: "flex", gap: 1 }}>
        <CoordinateTableToolbar
          disabled={readOnly}
          onAddRow={() => insertRows(1)}
          onAddRows={() => setInserting(true)}
          onDeleteRows={deleteRows}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Grid
            hot={hot}
            rows={rows}
            newRow={newRow}
            settings={settings}
            hooks={hooks}
            height={height}
          />
        </Box>
      </Box>
      {invalid > 0 && (
        <Typography role="status" variant="caption" color="error">
          {`${invalid} ${invalid === 1 ? "cell is" : "cells are"} not valid; nothing is saved until every marked cell is`}
        </Typography>
      )}
    </Box>
  );
}
