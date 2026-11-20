import { CBMA_COLUMNS, invalidCells, numberColumn, isValid } from "./columns";
import { insertionIndices } from "./rows";
import { sanitizePaste } from "./paste";

describe("the coordinate columns", () => {
  it("are compose’s CBMA columns by default: x, y and z required numbers, then value, cluster size and two flags", () => {
    expect(CBMA_COLUMNS.map((c) => [c.data, c.header])).toEqual([
      ["x", "X"],
      ["y", "Y"],
      ["z", "Z"],
      ["value", "Value"],
      ["cluster_size", "Cluster Size (mm^3)"],
      ["subpeak", "Subpeak?"],
      ["deactivation", "Deactivations"],
    ]);
  });

  it("take a required number only when it is one, as compose’s validator does", () => {
    const x = numberColumn("x", "X", { required: true });
    expect([0, -36, "4.5", "−8"].map((v) => isValid(x, v))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(
      ["", null, undefined, "e", "abc", true].map((v) => isValid(x, v)),
    ).toEqual([false, false, false, false, false, false]);
  });

  it("leave an optional number empty, but not a word", () => {
    const value = numberColumn("value", "Value");
    expect(["", null, undefined, 3.1].map((v) => isValid(value, v))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isValid(value, "n.s.")).toBe(false);
  });

  it("name every invalid cell by row and column", () => {
    const rows = [
      { x: 1, y: 2, z: 3 },
      { x: "a", y: 2, z: "" },
    ];
    expect(invalidCells(rows, CBMA_COLUMNS)).toEqual([
      [1, "x"],
      [1, "z"],
    ]);
  });

  it("keep a number within its least, and a closed choice among its options", () => {
    const size = numberColumn("cluster_size", "size", { minimum: 0 });
    expect([0, 12, -1].map((v) => isValid(size, v))).toEqual([
      true,
      true,
      false,
    ]);
    const closed = {
      data: "m",
      header: "m",
      kind: "dropdown" as const,
      options: ["voxels", "mm3"],
    };
    expect([
      isValid(closed, "voxels"),
      isValid(closed, "acres"),
      isValid({ ...closed, open: true }, "acres"),
    ]).toEqual([true, false, true]);
  });
});

describe("a paste", () => {
  it("loses copied markup and reads minus-sign lookalikes as minus", () => {
    const data: unknown[][] = [["<b>4</b>", "−60", "– 2", 7, true, "true"]];
    sanitizePaste(data);
    expect(data).toEqual([["4", "-60", "- 2", 7, true, true]]);
  });
});

describe("inserting rows", () => {
  it("goes above the topmost selected row or below the bottommost", () => {
    expect(insertionIndices([])).toEqual({
      insertAboveIndex: 0,
      insertBelowIndex: 0,
    });
    expect(
      insertionIndices([
        [3, 0, 4, 2],
        [1, 0, 1, 2],
      ]),
    ).toEqual({ insertAboveIndex: 1, insertBelowIndex: 4 });
  });
});
