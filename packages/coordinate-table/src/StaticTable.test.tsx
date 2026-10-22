import { fireEvent, render, screen, within } from "@testing-library/react";
import { numberColumn } from "./columns";
import { StaticTable } from "./StaticTable";

const COLUMNS = [
  numberColumn("x", "X", { required: true, width: 58 }),
  numberColumn("y", "Y", { required: true, width: 58 }),
  numberColumn("z", "Z", { required: true, width: 58 }),
];
const ROWS = [
  { x: 4, y: -60, z: 40 },
  { x: -36, y: 20, z: 2 },
];

function setup(props: Partial<Parameters<typeof StaticTable>[0]> = {}) {
  const onEngage = vi.fn();
  render(
    <StaticTable
      rows={ROWS}
      columns={COLUMNS}
      caption="points of Faces"
      onEngage={onEngage}
      {...props}
    />,
  );
  return {
    onEngage,
    table: screen.getByRole("table", { name: "points of Faces" }),
  };
}

describe("the static table", () => {
  it("is a table with a caption, column and row headers, and the rows' values", () => {
    const { table } = setup();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["", "X", "Y", "Z"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((h) => h.textContent),
    ).toEqual(["1", "2"]);
    expect(
      within(table)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["4", "-60", "40", "-36", "20", "2"]);
  });

  it("hands the grid the cell clicked", () => {
    const { onEngage, table } = setup();
    fireEvent.click(within(table).getAllByRole("cell")[4]);
    expect(onEngage).toHaveBeenCalledWith({
      kind: "select",
      row: 1,
      column: 1,
    });
  });

  it("hands the grid a character typed, Enter, or a paste, at its row", () => {
    const { onEngage, table } = setup({ row: 1 });
    fireEvent.keyDown(table, { key: "7" });
    expect(onEngage).toHaveBeenLastCalledWith({
      kind: "type",
      row: 1,
      column: 0,
      text: "7",
    });
    fireEvent.keyDown(table, { key: "Enter" });
    expect(onEngage).toHaveBeenLastCalledWith({
      kind: "select",
      row: 1,
      column: 0,
    });
    fireEvent.paste(table, { clipboardData: { getData: () => "1\t2\t3" } });
    expect(onEngage).toHaveBeenLastCalledWith({
      kind: "paste",
      row: 1,
      column: 0,
      text: "1\t2\t3",
    });
  });

  it("leaves other keys, and keys held with Ctrl, to the review", () => {
    const { onEngage, table } = setup();
    fireEvent.keyDown(table, { key: "z", ctrlKey: true });
    fireEvent.keyDown(table, { key: "Shift" });
    expect(onEngage).not.toHaveBeenCalled();
  });

  it("hands the grid its toolbar's add and delete", () => {
    const { onEngage } = setup({ row: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(onEngage).toHaveBeenLastCalledWith({ kind: "addRow" });
    fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
    expect(onEngage).toHaveBeenLastCalledWith({ kind: "addRows" });
    fireEvent.click(screen.getByRole("button", { name: "Delete row(s)" }));
    expect(onEngage).toHaveBeenLastCalledWith({ kind: "deleteRows", row: 1 });
  });
});
