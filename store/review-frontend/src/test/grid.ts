import { act, fireEvent, screen, within } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';

/** The read-only table of an analysis's points, shown until the reviewer engages the grid. */
export const staticTable = (name: string) => screen.getByRole('table', { name: `points of ${name}` });

/** The static table's cell at `row`, `column` of the points. */
export const staticCell = (name: string, row: number, column: number) =>
    within(staticTable(name)).getAllByRole('row')[row + 1].querySelectorAll('td')[column];

/** Clicks the static table's cell at `row`, `column` and waits for the grid that takes its place. */
export async function engageGrid(name: string, row = 0, column = 0) {
    act(() => void fireEvent.click(staticCell(name, row, column)));
    return screen.findByRole('group', { name: `edit the points of ${name}` }, { timeout: 10_000 });
}

/** The stand-in grid of the Add analysis form `form`, once its chunk is in. */
export async function newPointsGrid(form: HTMLElement) {
    const grid = await within(form).findByRole('group', { name: 'points of the new analysis' }, { timeout: 10_000 });
    return fakeHotIn(grid);
}
