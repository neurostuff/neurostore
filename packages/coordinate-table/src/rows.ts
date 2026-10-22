/** Where rows are inserted for a selection: above its topmost row, or below its bottommost. */
export function insertionIndices(selected: number[][]) {
  if (selected.length === 0)
    return { insertAboveIndex: 0, insertBelowIndex: 0 };
  let insertAboveIndex = selected[0][0];
  let insertBelowIndex = selected[selected.length - 1][2];
  for (const [startRow, , endRow] of selected) {
    insertAboveIndex = Math.min(insertAboveIndex, startRow, endRow);
    insertBelowIndex = Math.max(insertBelowIndex, startRow, endRow);
  }
  return { insertAboveIndex, insertBelowIndex };
}

type Row = Record<string, unknown>;

/** Whether `a` and `b` hold equal values, key by key, stopping at the first difference. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => sameValue((a as Row)[key], (b as Row)[key]));
}

export interface RowsDiff<T extends Row> {
  created: T[];
  deleted: T[];
  updated: T[];
}

/**
 * What a change made of the rows, by row id: the rows of `after` with no id, or one `before` lacks, are created;
 * the rows of `before` whose id `after` lacks are deleted; and the rows whose values changed are updated.
 */
export function rowsDiff<T extends Row>(
  before: T[],
  after: T[],
  idOf: (row: T) => unknown = (row) => row.id,
): RowsDiff<T> {
  const held = new Map(before.map((row) => [idOf(row), row]));
  const kept = new Set(after.map(idOf));
  const heldAs = (row: T) =>
    idOf(row) === undefined ? undefined : held.get(idOf(row));
  return {
    created: after.filter((row) => heldAs(row) === undefined),
    deleted: before.filter((row) => !kept.has(idOf(row))),
    updated: after.filter((row) => {
      const was = heldAs(row);
      return was !== undefined && !sameValue(was, row);
    }),
  };
}
