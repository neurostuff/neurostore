import type { ColumnSettings } from "handsontable/settings";

type Row = Record<string, unknown>;

/** One column of the grid: the row field it edits, its header and what it takes. */
export interface CoordinateColumn {
  data: string;
  header: string;
  kind: "number" | "checkbox" | "text" | "dropdown";
  /** Whether the cell must hold a value; a number column takes an empty cell otherwise. */
  required?: boolean;
  /** The choices of a dropdown column. */
  options?: string[];
  /** Whether a dropdown column also takes a value not among its choices. */
  open?: boolean;
  /** The least a number column takes. */
  minimum?: number;
  width?: number;
  /** What an empty cell shows. */
  placeholder?: string;
}

/** Whether `value` is a number, as compose's validator reads one: not empty, not `e`, not a boolean. */
const isNumeric = (value: unknown) =>
  !Number.isNaN(Number(value)) &&
  value !== "e" &&
  value !== true &&
  value !== false &&
  value !== "";

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "";

/** Whether a cell of `column` may hold `value`. */
export function isValid(column: CoordinateColumn, value: unknown): boolean {
  if (isEmpty(value)) return !column.required;
  switch (column.kind) {
    case "number":
      return (
        typeof value !== "object" &&
        isNumeric(value) &&
        !(Number(value) < (column.minimum ?? -Infinity))
      );
    case "checkbox":
      return value === true || value === false;
    case "dropdown":
      return column.open || (column.options?.includes(String(value)) ?? true);
    case "text":
      return true;
  }
}

/** Whether every cell of `row` under `columns` is empty, as a row just added is. */
export const isBlankRow = (row: Row, columns: CoordinateColumn[]) =>
  columns.every((column) => isEmpty(row[column.data]));

/** Each cell of `rows` that its column does not take, as [row, field]. */
export function invalidCells(
  rows: Row[],
  columns: CoordinateColumn[],
): [number, string][] {
  return rows.flatMap((row, at) =>
    columns
      .filter((column) => !isValid(column, row[column.data]))
      .map((column): [number, string] => [at, column.data]),
  );
}

export const numberColumn = (
  data: string,
  header: string,
  options: Partial<Omit<CoordinateColumn, "data" | "header" | "kind">> = {},
): CoordinateColumn => ({ data, header, kind: "number", ...options });

export const checkboxColumn = (
  data: string,
  header: string,
): CoordinateColumn => ({ data, header, kind: "checkbox" });

/** The columns of compose's CBMA points table. */
export const CBMA_COLUMNS: CoordinateColumn[] = [
  numberColumn("x", "X", { required: true, width: 30 }),
  numberColumn("y", "Y", { required: true, width: 30 }),
  numberColumn("z", "Z", { required: true, width: 30 }),
  numberColumn("value", "Value", { width: 80 }),
  numberColumn("cluster_size", "Cluster Size (mm^3)", { width: 100 }),
  { ...checkboxColumn("subpeak", "Subpeak?"), width: 70 },
  { ...checkboxColumn("deactivation", "Deactivations"), width: 70 },
];

const CELL_TYPES = {
  number: "numeric",
  checkbox: "checkbox",
  text: "text",
  dropdown: "dropdown",
} as const;
const CLASS_NAMES = {
  number: "htCenter",
  checkbox: "htCenter",
  text: "htLeft",
  dropdown: "htLeft",
} as const;

/** The Handsontable settings of `columns`, each validated as `isValid` takes its cells. */
export const hotColumns = (
  columns: CoordinateColumn[],
  readOnly: boolean,
): ColumnSettings[] =>
  columns.map((column) => ({
    data: column.data,
    type: CELL_TYPES[column.kind],
    className: CLASS_NAMES[column.kind],
    readOnly,
    ...(column.options && { source: column.options, strict: !column.open }),
    ...(column.placeholder && { placeholder: column.placeholder }),
    validator: (value: unknown, callback: (valid: boolean) => void) =>
      callback(isValid(column, value)),
  }));
