import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { numberColumn } from "./columns";
import { CoordinateTable, type CoordinateTableHandle } from "./CoordinateTable";
import { createRef } from "react";
import { fakeHotIn } from "./testing/fakeHotTable";

vi.mock("@handsontable/react-wrapper", () => import("./testing/fakeHotTable"));
vi.mock("handsontable/registry", () => ({ registerAllModules: () => {} }));

const POINTS = [
  { x: 4, y: -60, z: 40, value: 5.1 },
  { x: -36, y: 20, z: 2 },
];

function setup(points = POINTS) {
  const onChange = vi.fn();
  const view = render(
    <CoordinateTable points={points} onChange={onChange} label="points" />,
  );
  const hot = () => fakeHotIn(screen.getByRole("group", { name: "points" }));
  const cells = () =>
    [
      ...screen
        .getByRole("group", { name: "points", hidden: true })
        .querySelectorAll("tbody tr"),
    ].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent),
    );
  return { ...view, onChange, hot, cells };
}

describe("the coordinate table", () => {
  it("shows the points under compose’s headers", () => {
    const { cells } = setup();
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual([
      "X",
      "Y",
      "Z",
      "Value",
      "Cluster Size (mm^3)",
      "Subpeak?",
      "Deactivations",
    ]);
    expect(cells()[0].slice(0, 4)).toEqual(["4", "-60", "40", "5.1"]);
  });

  it("commits a cell edit as one change carrying every row", () => {
    const { hot, onChange } = setup();
    act(() => hot().edit(1, "z", 6));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([POINTS[0], { ...POINTS[1], z: 6 }]);
  });

  it("commits a paste running past the last row as one change, the new rows added, minus signs read", () => {
    const { hot, onChange } = setup();
    act(() =>
      hot().paste(1, 0, [
        ["1", "2", "3"],
        ["−4", "5", "6"],
        ["7", "8", "9"],
      ]),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([
      POINTS[0],
      { x: "1", y: "2", z: "3" },
      { x: "-4", y: "5", z: "6" },
      { x: "7", y: "8", z: "9" },
    ]);
  });

  it("commits a paste past the last row as one change when no cell is required", () => {
    const onChange = vi.fn();
    render(
      <CoordinateTable
        points={[{ value: 1 }]}
        onChange={onChange}
        label="points"
        columns={[numberColumn("value", "Value")]}
      />,
    );
    const hot = fakeHotIn(screen.getByRole("group", { name: "points" }));
    act(() => hot.paste(0, 0, [["2"], ["3"], ["4"]]));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { value: "2" },
      { value: "3" },
      { value: "4" },
    ]);
  });

  it("commits a fill as one change", () => {
    const { hot, onChange } = setup([...POINTS, { x: 1, y: 1, z: 1 }]);
    act(() => hot().fill(0, "z", 2));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      onChange.mock.calls[0][0].map((row: { z: number }) => row.z),
    ).toEqual([40, 40, 40]);
  });

  it("marks an invalid cell and commits nothing until it is valid", () => {
    const { hot, onChange, container } = setup();
    act(() => hot().edit(0, "x", "abc"));
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector("td.htInvalid")).toHaveTextContent("abc");
    expect(screen.getByRole("status")).toHaveTextContent("1 cell is not valid");
    act(() => hot().edit(0, "x", 5));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("adds a row from the toolbar, marked invalid only once edited, sent once its x, y and z are filled", () => {
    const { hot, onChange, cells, container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(cells()).toHaveLength(3);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector("td.htInvalid")).toBeNull();
    act(() => hot().paste(2, 0, [["1", "2", "3"]]));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(3);
  });

  it("marks the cells an added row still needs once another edit is held back by it", () => {
    const { hot, onChange, container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    act(() => hot().edit(0, "z", 6));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 cells are not valid",
    );
    expect(container.querySelectorAll("td.htInvalid")).toHaveLength(3);
  });

  it("adds several rows below the selection from the Add rows dialog", () => {
    const { hot, cells } = setup();
    act(() => hot().selectCell(0, 0));
    fireEvent.click(screen.getByRole("button", { name: "Add rows" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("spinbutton", { name: "number" }),
      { target: { value: "2" } },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
    expect(cells().map((row) => row[0])).toEqual(["4", "", "", "-36"]);
  });

  it("deletes the selected rows as one change", () => {
    const { hot, onChange } = setup([...POINTS, { x: 1, y: 1, z: 1 }]);
    act(() => hot().selectRows(0, 1));
    fireEvent.click(screen.getByRole("button", { name: "Delete row(s)" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([{ x: 1, y: 1, z: 1 }]);
  });

  it("keeps minRows rows: deleting the rest is refused, from the toolbar or the context menu", () => {
    const onChange = vi.fn();
    render(
      <CoordinateTable
        points={POINTS}
        onChange={onChange}
        label="points"
        minRows={2}
      />,
    );
    const hot = fakeHotIn(screen.getByRole("group", { name: "points" }));
    act(() => hot.selectRows(0, 0));
    fireEvent.click(screen.getByRole("button", { name: "Delete row(s)" }));
    act(() => hot.alter("remove_row", 1, 1, "ContextMenu.removeRow"));
    expect(hot.getSourceData()).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("validates every cell again after a fill", () => {
    const { hot, container } = setup([
      { x: 4, y: 1, z: 1 },
      { y: 2, z: 2 },
      { y: 3, z: 3 },
    ]);
    expect(container.querySelectorAll("td.htInvalid")).toHaveLength(0);
    act(() => hot().fill(1, "x", 2));
    expect(container.querySelectorAll("td.htInvalid")).toHaveLength(2);
  });

  it("stretches its columns across its width when asked, as compose's does", () => {
    const { hot, rerender } = setup();
    expect(hot().props.stretchH).toBe("none");
    rerender(
      <CoordinateTable
        points={POINTS}
        onChange={vi.fn()}
        label="points"
        stretchH="all"
      />,
    );
    expect(hot().props.stretchH).toBe("all");
  });

  it("keeps its rows when given the rows it shows, and takes new ones otherwise", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CoordinateTable points={POINTS} onChange={onChange} label="points" />,
    );
    const hot = fakeHotIn(screen.getByRole("group", { name: "points" }));
    const rows = hot.getSourceData();
    rerender(
      <CoordinateTable
        points={POINTS.map((p) => ({ ...p }))}
        onChange={onChange}
        label="points"
      />,
    );
    expect(
      fakeHotIn(screen.getByRole("group", { name: "points" })).getSourceData(),
    ).toBe(rows);
    rerender(
      <CoordinateTable
        points={[{ x: 0, y: 0, z: 0 }]}
        onChange={onChange}
        label="points"
      />,
    );
    expect(
      fakeHotIn(screen.getByRole("group", { name: "points" })).getSourceData(),
    ).toEqual([{ x: 0, y: 0, z: 0 }]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("grows to its rows, with no vertical scrollbar, up to a cap past which it scrolls", () => {
    const { hot, rerender } = setup();
    expect(hot().height).toBe("auto");
    const many = Array.from({ length: 40 }, (_, i) => ({ x: i, y: 0, z: 0 }));
    rerender(
      <CoordinateTable
        points={many}
        onChange={vi.fn()}
        label="points"
        maxHeight={500}
      />,
    );
    expect(hot().height).toBe(500);
  });

  it("takes no edits while read-only", () => {
    const onChange = vi.fn();
    render(
      <CoordinateTable
        points={POINTS}
        onChange={onChange}
        label="points"
        readOnly
      />,
    );
    expect(screen.getByRole("button", { name: "Add row" })).toBeDisabled();
    expect(
      screen.getByRole("group", { name: "points" }).querySelector("td"),
    ).toHaveAttribute("aria-readonly", "true");
  });

  describe("taking over from the static table", () => {
    function engaged() {
      const ref = createRef<CoordinateTableHandle>();
      const onChange = vi.fn();
      render(
        <CoordinateTable
          ref={ref}
          points={POINTS}
          onChange={onChange}
          label="points"
        />,
      );
      const hot = () =>
        fakeHotIn(screen.getByRole("group", { name: "points" }));
      return { ref, onChange, hot };
    }

    it("selects the cell the reviewer clicked", () => {
      const { ref, hot } = engaged();
      act(() => ref.current!.engage({ kind: "select", row: 1, column: 2 }));
      expect(hot().selection).toEqual([1, 2, 1, 2]);
      expect(hot().listening).toBe(true);
    });

    it("opens the cell's editor with the character typed, and commits it", () => {
      const { ref, hot, onChange } = engaged();
      act(() =>
        ref.current!.engage({ kind: "type", row: 0, column: 0, text: "7" }),
      );
      expect(hot().editor).toEqual({ row: 0, prop: "x", value: "7" });
      act(() => hot().getActiveEditor()!.finishEditing());
      expect(onChange).toHaveBeenCalledWith([
        { ...POINTS[0], x: "7" },
        POINTS[1],
      ]);
    });

    it("pastes the text pasted on it at the cell", () => {
      const { ref, onChange } = engaged();
      act(() =>
        ref.current!.engage({
          kind: "paste",
          row: 1,
          column: 0,
          text: "1\t2\t3",
        }),
      );
      expect(onChange).toHaveBeenCalledWith([
        POINTS[0],
        { x: "1", y: "2", z: "3" },
      ]);
    });

    it("adds a row, or deletes the focused one, from its toolbar", () => {
      const { ref, hot, onChange } = engaged();
      act(() => ref.current!.engage({ kind: "addRow" }));
      expect(hot().getSourceData()).toHaveLength(3);
      act(() => ref.current!.engage({ kind: "deleteRows", row: 2 }));
      expect(hot().getSourceData()).toHaveLength(2);
      act(() => ref.current!.engage({ kind: "deleteRows", row: 0 }));
      expect(onChange).toHaveBeenLastCalledWith([POINTS[1]]);
    });

    it("finish commits the edit still open", () => {
      const { ref, hot, onChange } = engaged();
      act(() =>
        ref.current!.engage({ kind: "type", row: 1, column: 2, text: "9" }),
      );
      act(() => ref.current!.finish());
      expect(hot().editor).toBeNull();
      expect(onChange).toHaveBeenCalledWith([
        POINTS[0],
        { ...POINTS[1], z: "9" },
      ]);
    });
  });
});
