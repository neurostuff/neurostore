import { rowsDiff } from "./rows";

describe("rowsDiff", () => {
  const before = [
    { id: "a", x: 1 },
    { id: "b", x: 2 },
    { id: "c", x: 3 },
  ];

  it("finds the rows created, deleted and updated, by row id", () => {
    const after = [{ id: "a", x: 1 }, { id: "c", x: 9 }, { x: 4 }];
    expect(rowsDiff(before, after)).toEqual({
      created: [{ x: 4 }],
      deleted: [{ id: "b", x: 2 }],
      updated: [{ id: "c", x: 9 }],
    });
  });

  it("finds nothing between rows holding the same values", () => {
    expect(
      rowsDiff(
        before,
        before.map((row) => ({ ...row })),
      ),
    ).toEqual({
      created: [],
      deleted: [],
      updated: [],
    });
  });

  it("reads each row's id with idOf", () => {
    const keyed = [{ key: 1, x: 1 }];
    expect(rowsDiff(keyed, [{ key: 1, x: 2 }], (row) => row.key)).toEqual({
      created: [],
      deleted: [],
      updated: [{ key: 1, x: 2 }],
    });
  });
});
