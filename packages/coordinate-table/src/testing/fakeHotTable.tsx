import { useImperativeHandle, useReducer, useRef, type Ref } from "react";

type Row = Record<string, unknown>;
type Change = [number, string, unknown, unknown];
type Validator = (value: unknown, callback: (valid: boolean) => void) => void;

interface Props {
  data: Row[];
  dataSchema?: () => Row;
  columns?: { data: string; validator?: Validator; readOnly?: boolean }[];
  colHeaders?: string[];
  readOnly?: boolean;
  height?: number | string;
  beforePaste?: (data: unknown[][], coords: unknown[]) => boolean | void;
  afterChange?: (changes: Change[] | null, source: string) => void;
  afterCreateRow?: (index: number, amount: number, source?: string) => void;
  beforeRemoveRow?: (
    index: number,
    amount: number,
    rows: number[],
    source?: string,
  ) => boolean | void;
  afterAutofill?: () => void;
  stretchH?: string;
  afterRemoveRow?: (
    index: number,
    amount: number,
    rows: number[],
    source?: string,
  ) => void;
  afterSelectionEnd?: (
    row: number,
    column: number,
    row2: number,
    column2: number,
  ) => void;
  ref?: Ref<{ hotInstance: FakeHot | null }>;
}

const tables = new WeakMap<Element, FakeHot>();

/** The fake grid rendered inside `element`. */
export function fakeHotIn(element: Element): FakeHot {
  const table = element.querySelector("table[data-fake-hot]");
  const hot = table && tables.get(table);
  if (!hot) throw new Error("no fake Handsontable here");
  return hot;
}

/** A stand-in for a Handsontable instance over object rows: it edits `data` in place and runs the hooks Handsontable runs, once per action. */
export class FakeHot {
  props: Props;
  rows: Row[];
  selection: [number, number, number, number] | null = null;
  listening = false;
  constructor(
    props: Props,
    private readonly redraw: () => void,
  ) {
    this.props = props;
    this.rows = props.data;
    this.height = props.height;
  }
  get data() {
    return this.rows;
  }
  /** Takes `props`, loading their rows when they are new, as updateSettings does. */
  take(props: Props) {
    if (props.data !== this.props.data) this.rows = props.data;
    this.props = props;
  }
  suspendRender = () => {};
  resumeRender = () => {};
  updateData = (rows: Row[]) => {
    this.rows = rows;
    this.redraw();
    this.props.afterChange?.(null, "updateData");
  };
  private get props_() {
    return (this.props.columns ?? []).map((column) => column.data);
  }
  /** The cell editor while it is open: the cell it edits and what it holds. */
  editor: { row: number; prop: string; value: unknown } | null = null;
  /** The editor of the selected cell, as Handsontable's getActiveEditor gives it. */
  getActiveEditor = () => {
    if (!this.selection) return undefined;
    const [row, column] = this.selection;
    const prop = this.props_[column];
    return {
      isOpened: () => this.editor !== null,
      beginEditing: (initial?: unknown) => {
        if (this.props.columns?.[column]?.readOnly) return;
        this.editor = { row, prop, value: initial ?? this.data[row]?.[prop] };
        this.redraw();
      },
      setValue: (value: unknown) => {
        if (this.editor) this.editor.value = value;
        this.redraw();
      },
      finishEditing: () => {
        const editor = this.editor;
        if (!editor) return;
        this.editor = null;
        this.setDataAtRowProp(editor.row, editor.prop, editor.value, "edit");
      },
    };
  };
  /** Types `text` into the open editor, after what it holds. */
  type = (text: string) => {
    if (this.editor) this.editor.value = `${this.editor.value ?? ""}${text}`;
    this.redraw();
  };
  /** Handsontable's plugins the grid uses: copyPaste pastes tab-separated text at the selection. */
  getPlugin = (name: string) =>
    name === "copyPaste"
      ? {
          paste: (text: string) => {
            const [row, column] = this.selection ?? [0, 0];
            this.paste(
              row,
              column,
              text.split("\n").map((line) => line.split("\t")),
            );
          },
        }
      : undefined;
  countRows = () => this.data.length;
  getSourceData = () => this.data;
  getSettings = () => ({ data: this.data, height: this.height });
  /** The height the grid was last given. */
  height: number | string | undefined;
  updateSettings = (settings: { height?: number | string }) => {
    this.height = settings.height;
    this.redraw();
  };
  getSelected = () => (this.selection ? [this.selection] : undefined);
  selectCell = (row: number, column: number) => {
    this.selection = [row, column, row, column];
    this.redraw();
    this.props.afterSelectionEnd?.(row, column, row, column);
  };
  selectRows = (from: number, to = from) => {
    this.selection = [from, 0, to, this.props_.length - 1];
    this.redraw();
    this.props.afterSelectionEnd?.(from, 0, to, this.props_.length - 1);
  };
  listen = () => {
    this.listening = true;
  };
  /** The fields of each row that have been validated; Handsontable marks a cell only once it validates it. */
  private validated = new WeakMap<Row, Set<string>>();
  private markValidated(row: Row, prop: string) {
    const fields = this.validated.get(row) ?? new Set<string>();
    fields.add(prop);
    this.validated.set(row, fields);
  }
  validateCells = () => {
    for (const row of this.data)
      for (const prop of this.props_) this.markValidated(row, prop);
    this.redraw();
  };
  private newRows(count: number) {
    return Array.from({ length: count }, () => this.props.dataSchema?.() ?? {});
  }
  alter = (
    action: string,
    index: number | [number, number][],
    amount = 1,
    source?: string,
  ) => {
    if (action === "insert_row_above" || action === "insert_row_below") {
      const at = (index as number) + (action === "insert_row_below" ? 1 : 0);
      this.data.splice(at, 0, ...this.newRows(amount));
      this.redraw();
      this.props.afterCreateRow?.(at, amount, source);
    } else if (action === "remove_row") {
      const ranges =
        typeof index === "number"
          ? [[index, amount] as [number, number]]
          : index;
      for (const [start, count] of [...ranges].sort((a, b) => b[0] - a[0])) {
        const removed = Array.from({ length: count }, (_, i) => start + i);
        if (
          this.props.beforeRemoveRow?.(start, count, removed, source) === false
        )
          continue;
        this.data.splice(start, count);
        this.redraw();
        this.props.afterRemoveRow?.(start, count, removed, source);
      }
    }
  };
  private apply(changes: Change[], source: string) {
    const missing =
      Math.max(...changes.map(([row]) => row)) - (this.data.length - 1);
    if (missing > 0) {
      const at = this.data.length;
      this.data.push(...this.newRows(missing));
      this.props.afterCreateRow?.(at, missing, "auto");
    }
    for (const [row, prop, , value] of changes) {
      this.data[row][prop] = value;
      this.markValidated(this.data[row], prop);
    }
    this.redraw();
    this.props.afterChange?.(changes, source);
  }
  setDataAtRowProp = (
    row: number,
    prop: string,
    value: unknown,
    source = "edit",
  ) => this.apply([[row, prop, this.data[row]?.[prop], value]], source);
  /** Types `value` into the cell at `row`, `prop` and commits it, as Enter does. */
  edit = (row: number, prop: string, value: unknown) =>
    this.setDataAtRowProp(row, prop, value, "edit");
  /** Pastes `cells` with their top left at `row`, `column`, adding the rows it runs past. */
  paste = (row: number, column: number, cells: unknown[][]) => {
    const data = cells.map((line) => [...line]);
    if (
      this.props.beforePaste?.(data, [{ startRow: row, startCol: column }]) ===
      false
    )
      return;
    const changes = data.flatMap((line, r) =>
      line.map((value, c): Change => {
        const prop = this.props_[column + c];
        return [row + r, prop, this.data[row + r]?.[prop], value];
      }),
    );
    this.apply(changes, "CopyPaste.paste");
  };
  /** Drags the fill handle from the cell at `row`, `prop` down to `to`; a cell the fill leaves as it was is no change. */
  fill = (row: number, prop: string, to: number) => {
    const changes = Array.from({ length: to - row }, (_, i): Change => [
      row + i + 1,
      prop,
      this.data[row + i + 1]?.[prop],
      this.data[row][prop],
    ]).filter(([, , before, after]) => before !== after);
    if (changes.length) this.apply(changes, "Autofill.fill");
    this.props.afterAutofill?.();
  };
  /** Whether the cell at `row`, `column` shows as valid: it does until it is validated. */
  isValid(row: number, column: number) {
    const validator = this.props.columns?.[column]?.validator;
    if (!this.validated.get(this.data[row])?.has(this.props_[column]))
      return true;
    let valid = true;
    validator?.(this.data[row][this.props_[column]], (ok) => (valid = ok));
    return valid;
  }
}

/** Renders the rows as a plain table and exposes a FakeHot as hotInstance. */
export function HotTable(props: Props) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const hot = useRef<FakeHot | null>(null);
  hot.current ??= new FakeHot(props, redraw);
  hot.current.take(props);
  useImperativeHandle(props.ref, () => ({ hotInstance: hot.current }));
  const columns = props.columns ?? [];
  return (
    <table
      data-fake-hot=""
      ref={(table) => {
        if (table) tables.set(table, hot.current!);
      }}
    >
      <thead>
        <tr>
          {(props.colHeaders ?? []).map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hot.current.data.map((row, r) => (
          <tr key={r}>
            {columns.map((column, c) => {
              const valid = hot.current!.isValid(r, c);
              return (
                <td
                  key={column.data}
                  className={valid ? undefined : "htInvalid"}
                  aria-invalid={valid ? undefined : true}
                  aria-readonly={column.readOnly || undefined}
                >
                  {hot.current!.editor?.row === r &&
                  hot.current!.editor.prop === column.data ? (
                    <textarea
                      data-fake-editor=""
                      readOnly
                      value={String(hot.current!.editor.value ?? "")}
                    />
                  ) : (
                    String(row[column.data] ?? "")
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default HotTable;
