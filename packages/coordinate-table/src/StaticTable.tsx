import { Box } from "@mui/material";
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";
import type { CoordinateColumn } from "./columns";
import { CoordinateTableToolbar } from "./CoordinateTableToolbar";
import { holdKeys, typesCharacter } from "./heldKeys";

/** What the reviewer began on the static table, for the grid to carry on once it is mounted. */
export type GridEngagement =
  | { kind: "select"; row: number; column: number }
  | { kind: "type"; row: number; column: number; text: string }
  | { kind: "paste"; row: number; column: number; text: string }
  | { kind: "addRow" }
  | { kind: "addRows" }
  | { kind: "deleteRows"; row: number | null };

export interface StaticTableProps {
  rows: Record<string, unknown>[];
  columns: CoordinateColumn[];
  /** The table's caption, its accessible name. */
  caption: string;
  /** Called with what the reviewer began, when they begin to edit. */
  onEngage(engagement: GridEngagement): void;
  /** The row a key or a delete acts on; the first when none is given. */
  row?: number | null;
  readOnly?: boolean;
  /** As CoordinateTable's: the most rows shown whole, and the height past them. */
  autoRows?: number;
  maxHeight?: number;
}

/** The width of the row numbers, as Handsontable draws them. */
const ROW_HEADER_WIDTH = 50;
const BORDER = "1px solid #ccc";

/** Handsontable's classic theme, as far as a read-only table shows it: the same widths, row heights and type. */
const tableStyles = {
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  font: '13px/21px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#313131",
  "&:focus-visible": {
    outline: 2,
    outlineColor: "primary.main",
    outlineStyle: "solid",
  },
  "& caption": {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
  },
  "& th, & td": {
    boxSizing: "border-box",
    border: 0,
    height: 26,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "top",
    fontWeight: 400,
  },
  "& th": { bgcolor: "#f0f0f0", textAlign: "center", padding: 0 },
  "& td": {
    bgcolor: "#fff",
    padding: "2px 6px",
    borderRight: BORDER,
    borderBottom: BORDER,
    cursor: "cell",
  },
  "& thead th": { borderTop: BORDER, borderRight: BORDER },
  "& thead th:first-of-type, & tbody th": { borderLeft: BORDER },
  "& tbody th": { borderBottom: BORDER },
  "& tbody td:first-of-type": { borderLeft: BORDER },
  "& tbody tr:first-of-type > *": { borderTop: BORDER, height: 27 },
  "& .htCenter": { textAlign: "center" },
  "& .htLeft": { textAlign: "left" },
} as const;

const ALIGN = {
  number: "htCenter",
  checkbox: "htCenter",
  text: "htLeft",
  dropdown: "htLeft",
} as const;

/**
 * The rows as a plain, read-only table laid out as the grid lays them out, with the grid's toolbar; whatever begins
 * an edit (a click, Enter, a character, a paste, a toolbar button) is handed to `onEngage` for the grid to carry on.
 * The keys pressed after a click, Enter or a character are held for the grid, which takes them once it is mounted.
 */
export function StaticTable({
  rows,
  columns,
  caption,
  onEngage,
  row,
  readOnly = false,
  autoRows = 15,
  maxHeight = 500,
}: StaticTableProps) {
  const at = Math.min(row ?? 0, Math.max(rows.length - 1, 0));
  /** Hands the grid `engagement` begun on `element`, holding the keys pressed from now on for it unless read-only. */
  const engageHolding = (element: Element, engagement: GridEngagement) => {
    if (!readOnly) holdKeys(element);
    onEngage(engagement);
  };
  const onClick = (event: MouseEvent) => {
    const cell = (event.target as Element).closest("td[data-column]");
    if (!cell) return;
    engageHolding(cell, {
      kind: "select",
      row: Number(cell.parentElement!.dataset.row),
      column: Number((cell as HTMLElement).dataset.column),
    });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      engageHolding(event.currentTarget, {
        kind: "select",
        row: at,
        column: 0,
      });
    } else if (typesCharacter(event) && !readOnly) {
      event.preventDefault();
      engageHolding(event.currentTarget, {
        kind: "type",
        row: at,
        column: 0,
        text: event.key,
      });
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    if (readOnly) return;
    event.preventDefault();
    onEngage({
      kind: "paste",
      row: at,
      column: 0,
      text: event.clipboardData.getData("text/plain"),
    });
  };
  const width =
    ROW_HEADER_WIDTH +
    columns.reduce((sum, column) => sum + (column.width ?? 80), 0);
  return (
    <Box sx={{ display: "flex", gap: 1 }} data-coordinate-table="">
      <CoordinateTableToolbar
        disabled={readOnly}
        onAddRow={() => onEngage({ kind: "addRow" })}
        onAddRows={() => onEngage({ kind: "addRows" })}
        onDeleteRows={() => onEngage({ kind: "deleteRows", row: row ?? null })}
      />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "auto",
          maxHeight: rows.length <= autoRows ? undefined : maxHeight,
        }}
      >
        <Box
          component="table"
          tabIndex={0}
          sx={{ ...tableStyles, width }}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        >
          <caption>{caption}</caption>
          <colgroup>
            <col style={{ width: ROW_HEADER_WIDTH }} />
            {columns.map((column) => (
              <col key={column.data} style={{ width: column.width ?? 80 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" />
              {columns.map((column) => (
                <th key={column.data} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((values, r) => (
              <tr key={r} data-row={r}>
                <th scope="row">{r + 1}</th>
                {columns.map((column, c) => (
                  <td
                    key={column.data}
                    data-column={c}
                    className={ALIGN[column.kind]}
                  >
                    {column.kind === "checkbox" ? (
                      <input
                        type="checkbox"
                        disabled
                        checked={values[column.data] === true}
                        aria-label={column.header}
                      />
                    ) : (
                      String(values[column.data] ?? "")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}
