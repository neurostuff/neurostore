import { fireEvent, render, screen, within } from "@testing-library/react";
import { numberColumn } from "./columns";
import { dropHeldKeys, takeHeldKeys } from "./heldKeys";
import { StaticTable } from "./StaticTable";

const COLUMNS = [
  numberColumn("x", "X", { required: true }),
  numberColumn("y", "Y", { required: true }),
  numberColumn("z", "Z", { required: true }),
];
const ROWS = [
  { x: 4, y: -60, z: 40 },
  { x: -36, y: 20, z: 2 },
];

/** The static table, a button beside it, and the keys that reach the window, as the review's shortcuts see them. */
function setup(readOnly = false) {
  render(
    <>
      <StaticTable
        rows={ROWS}
        columns={COLUMNS}
        caption="points of Faces"
        onEngage={() => {}}
        readOnly={readOnly}
      />
      <button type="button">elsewhere</button>
    </>,
  );
  const reached: string[] = [];
  const onKeyDown = (event: KeyboardEvent) => void reached.push(event.key);
  window.addEventListener("keydown", onKeyDown);
  onTestFinished(() => window.removeEventListener("keydown", onKeyDown));
  const table = screen.getByRole("table", { name: "points of Faces" });
  return { table, reached };
}

const onBody = (...keys: string[]) => {
  for (const key of keys) fireEvent.keyDown(document.body, { key });
};
const taken = () => takeHeldKeys().map((key) => key.key);

afterEach(() => {
  dropHeldKeys();
  vi.useRealTimers();
});

describe("the keys pressed after a character on the static table", () => {
  it("are held from the review, in order, for the grid to take once", () => {
    const { table, reached } = setup();
    fireEvent.keyDown(table, { key: "-" });
    reached.length = 0;
    onBody("7", "Backspace", "a", "Enter");
    expect(reached).toEqual([]);
    expect(taken()).toEqual(["7", "Backspace", "a", "Enter"]);
    expect(taken()).toEqual([]);
    onBody("j");
    expect(reached).toEqual(["j"]);
  });

  it("are held after a click or Enter on the table too", () => {
    const { table, reached } = setup();
    fireEvent.click(within(table).getAllByRole("cell")[0]);
    onBody("7");
    fireEvent.keyDown(table, { key: "Enter" });
    reached.length = 0;
    onBody("8");
    expect(reached).toEqual([]);
    expect(taken()).toEqual(["8"]);
  });

  it.each([
    ["a pointer down", () => fireEvent.pointerDown(document.body)],
    [
      "a key on something else",
      () =>
        fireEvent.keyDown(screen.getByRole("button", { name: "elsewhere" }), {
          key: "x",
        }),
    ],
    ["the window losing the focus", () => fireEvent.blur(window)],
    [
      "the page being hidden",
      () => {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        fireEvent(document, new Event("visibilitychange"));
      },
    ],
    ["3 s passing", () => vi.advanceTimersByTime(3000)],
    ["the app dropping them", () => dropHeldKeys()],
  ])("are let go on %s, and the next key reaches the review", (_, end) => {
    vi.useFakeTimers();
    const { table, reached } = setup();
    fireEvent.keyDown(table, { key: "-" });
    onBody("7");
    end();
    reached.length = 0;
    onBody("j");
    expect(reached).toEqual(["j"]);
    expect(taken()).toEqual([]);
  });

  it("are let go when a new hold begins, which holds only its own", () => {
    const { table } = setup();
    fireEvent.keyDown(table, { key: "-" });
    onBody("7");
    fireEvent.click(within(table).getAllByRole("cell")[0]);
    onBody("8");
    expect(taken()).toEqual(["8"]);
  });

  it("end at an arrow or any other key, which is held last", () => {
    const { table, reached } = setup();
    for (const last of ["ArrowDown", "Delete"]) {
      fireEvent.keyDown(table, { key: "-" });
      onBody("7", last);
      reached.length = 0;
      onBody("j");
      expect(reached).toEqual(["j"]);
      expect(taken()).toEqual(["7", last]);
    }
  });

  it("end at Escape, which drops what was typed", () => {
    const { table, reached } = setup();
    fireEvent.keyDown(table, { key: "-" });
    onBody("7", "Escape");
    reached.length = 0;
    onBody("j");
    expect(reached).toEqual(["j"]);
    expect(taken()).toEqual(["Escape"]);
  });

  it("leave modifier keys out", () => {
    const { table } = setup();
    fireEvent.keyDown(table, { key: "-" });
    onBody("Shift", "7");
    expect(taken()).toEqual(["7"]);
  });

  it("are not held on a read-only table", () => {
    const { table, reached } = setup(true);
    fireEvent.click(within(table).getAllByRole("cell")[0]);
    fireEvent.keyDown(table, { key: "Enter" });
    reached.length = 0;
    onBody("j");
    expect(reached).toEqual(["j"]);
    expect(taken()).toEqual([]);
  });
});
