import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

const FACES = 'Faces > Houses';
const PRECUNEUS = { coordinates: [4, -60, 40], values: [{ kind: 't', value: 5.1 }], label: 'Precuneus' };
const INSULA = { coordinates: [-36, 20, 2], values: [{ kind: 't', value: 4.2 }], cluster_size: 12 };
const [X, , Z] = [0, 1, 2];

/**
 * Holds back the grid's chunk until the returned function is called, so that keys typed on the static table come
 * before the grid is mounted.
 */
async function holdGrid(page: Page) {
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/src/coordinates/PointsTable.tsx*', async (route) => {
        await released;
        await route.continue();
    });
    return release;
}

/** The paper open on its first analysis, its points in the static table, and no grid mounted yet. */
async function open(page: Page) {
    const { batches, holdNext } = await serve(page);
    await page.goto('/review/e2e/index.html');
    const table = page.getByRole('table', { name: `points of ${FACES}` });
    const grid = page.getByRole('group', { name: `edit the points of ${FACES}` });
    const staticCell = (row: number, column: number) => table.locator('tbody tr').nth(row).locator('td').nth(column);
    const cell = (row: number, column: number) =>
        grid.locator('.ht_master .htCore tbody tr').nth(row).locator('td').nth(column);
    await expect(staticCell(0, X)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.handsontable')).toHaveCount(0);
    /** The batches sent, once there are `count` of them and no more follow within half a second. */
    const sent = async (count: number) => {
        await expect.poll(() => batches.length).toBe(count);
        await page.waitForTimeout(500);
        expect(batches).toHaveLength(count);
        return batches;
    };
    /** No batch is sent within a second of the last action. */
    const noneSent = async () => {
        await page.waitForTimeout(1000);
        expect(batches).toEqual([]);
    };
    /** Clicks the static table's cell, and waits for the grid in its place. */
    const engage = async (row: number, column: number) => {
        await staticCell(row, column).click();
        await expect(cell(row, column)).toBeVisible();
    };
    /** The grid takes edits: no cell dimmed as read-only, and its Add row button enabled. */
    const expectEditable = async () => {
        await expect(grid.locator('td.htDimmed')).toHaveCount(0);
        await expect(grid.getByRole('button', { name: 'Add row', exact: true })).toBeEnabled();
    };
    return { table, grid, staticCell, cell, engage, sent, noneSent, batches, holdNext, expectEditable };
}

const actions = (batch: Op[]) => batch.map((op) => [op.type, 'action' in op && op.action]);
const pointsOf = (batch: Op[]) => (batch[0] as { payload: { points: unknown[] } }).payload.points;

test('clicking a cell, typing and pressing Enter sends one edit_points with every point', async ({ page }) => {
    const { engage, sent } = await open(page);
    await engage(0, Z);
    await page.keyboard.type('42');
    await page.keyboard.press('Enter');
    const [batch] = await sent(1);
    expect(actions(batch)).toEqual([['coordinate', 'edit_points']]);
    expect(pointsOf(batch)).toEqual([{ ...PRECUNEUS, coordinates: [4, -60, 42] }, INSULA]);
});

test('typing on the static table keeps the first character, in the grid’s cell', async ({ page }) => {
    const { table, sent } = await open(page);
    await table.focus();
    await page.keyboard.type('-7');
    await page.keyboard.press('Enter');
    const [batch] = await sent(1);
    expect(pointsOf(batch)).toEqual([{ ...PRECUNEUS, coordinates: [-7, -60, 40] }, INSULA]);
});

test('typing -7.5 and Tab on the static table before the grid is in keeps every key, in order', async ({ page }) => {
    const release = await holdGrid(page);
    const { table, sent } = await open(page);
    await table.focus();
    await page.keyboard.type('-7.5');
    await page.keyboard.press('Tab');
    await expect(page.locator('.handsontable')).toHaveCount(0);
    release();
    await expect(page.locator('.handsontable').first()).toBeVisible();
    const [batch] = await sent(1);
    expect(pointsOf(batch)).toEqual([{ ...PRECUNEUS, coordinates: [-7.5, -60, 40] }, INSULA]);
});

test('typing a number that begins with a digit before the grid is in sends nothing until Enter', async ({ page }) => {
    const release = await holdGrid(page);
    const { table, sent, noneSent } = await open(page);
    await table.focus();
    await page.keyboard.type('12');
    release();
    await expect(page.locator('.handsontableInput')).toHaveValue('12');
    await noneSent();
    await page.keyboard.press('Enter');
    const [batch] = await sent(1);
    expect(pointsOf(batch)).toEqual([{ ...PRECUNEUS, coordinates: [12, -60, 40] }, INSULA]);
});

test('pasting three rows on the static table, past the last row, sends one edit_points', async ({ page }) => {
    const { table, sent } = await open(page);
    await table.focus();
    await table.evaluate((element) => {
        const data = new DataTransfer();
        data.setData('text/plain', '1\t2\t3\n4\t5\t6\n7\t8\t9');
        element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    const [batch] = await sent(1);
    expect(pointsOf(batch)).toEqual([
        { ...PRECUNEUS, coordinates: [1, 2, 3] },
        { ...INSULA, coordinates: [4, 5, 6] },
        { coordinates: [7, 8, 9] },
    ]);
});

test('dragging the fill handle sends one edit_points', async ({ page }) => {
    const { grid, cell, engage, sent } = await open(page);
    await engage(0, Z);
    await grid.locator('.ht_master .wtBorder.current.corner').hover();
    await page.mouse.down();
    await cell(1, Z).hover();
    await page.mouse.up();
    const [batch] = await sent(1);
    expect(pointsOf(batch)).toEqual([PRECUNEUS, { ...INSULA, coordinates: [-36, 20, 40] }]);
});

test('removing a row from the context menu sends one edit_points', async ({ page }) => {
    const { cell, engage, sent } = await open(page);
    await engage(0, X);
    await cell(0, X).click({ button: 'right' });
    await page.locator('.htContextMenu td', { hasText: 'Remove row(s)' }).click();
    const [batch] = await sent(1);
    expect(pointsOf(batch)).toEqual([INSULA]);
});

test('Add row on the static table adds an empty row in the grid, marks nothing invalid and sends nothing', async ({
    page,
}) => {
    const { grid, noneSent } = await open(page);
    await page.getByRole('button', { name: 'Add row', exact: true }).click();
    await expect(grid.locator('.ht_master .htCore tbody tr')).toHaveCount(3);
    await noneSent();
    await expect(grid.getByRole('status')).toHaveCount(0);
    await expect(grid.locator('td.htInvalid')).toHaveCount(0);
});

test('a cell typed as abc is marked invalid and nothing is sent', async ({ page }) => {
    const { grid, table, noneSent } = await open(page);
    await table.focus();
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');
    await expect(grid.locator('td.htInvalid')).toHaveText('abc');
    await noneSent();
});

test('Ctrl+Z in the grid undoes the last edit with a restore', async ({ page }) => {
    const { cell, engage, sent } = await open(page);
    await engage(0, Z);
    await page.keyboard.type('42');
    await page.keyboard.press('Enter');
    await sent(1);
    await expect(cell(0, Z)).toHaveText('42');
    await cell(1, X).click();
    await page.keyboard.press('Control+z');
    const batches = await sent(2);
    expect(actions(batches[1])).toEqual([['coordinate', 'restore']]);
    await expect(cell(0, Z)).toHaveText('40');
});

test('the grid takes the static table’s place without moving it, and leaving the analysis brings the table back', async ({
    page,
}) => {
    const { table, grid, engage } = await open(page);
    const before = await table.boundingBox();
    await engage(0, X);
    const after = await grid.locator('.ht_master .htCore').boundingBox();
    for (const side of ['x', 'y', 'width', 'height'] as const) expect(after![side]).toBeCloseTo(before![side], 0);
    await page.getByRole('article', { name: 'Houses > Faces' }).click();
    await expect(page.getByRole('table', { name: 'points of Houses > Faces' })).toBeVisible();
    await expect(grid).toBeHidden();
});

test('More columns on the next analysis leaves the focus there, though the grid it left stays mounted', async ({
    page,
}) => {
    const { engage, noneSent } = await open(page);
    await engage(1, X);
    await page
        .getByRole('group', { name: `${FACES}: card head` })
        .getByRole('button', { name: 'Next' })
        .click();
    const houses = page.getByRole('article', { name: 'Houses > Faces' });
    await expect(houses).toHaveAttribute('aria-current', 'true');
    const headers = page.getByRole('table', { name: 'points of Houses > Faces' }).getByRole('columnheader');
    const fewer = await headers.count();
    await page.getByRole('button', { name: 'More columns' }).click();
    await expect.poll(() => headers.count()).toBeGreaterThan(fewer);
    await expect(houses).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('group', { name: 'Houses > Faces: card head' })).toBeVisible();
    await noneSent();
});

test('dragging over rows in the grid selects those points, and Split splits them off', async ({ page }) => {
    const { table, cell, sent } = await open(page);
    await table.focus();
    await table.evaluate((element) => {
        const data = new DataTransfer();
        data.setData('text/plain', '1\t2\t3\n4\t5\t6\n7\t8\t9');
        element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await sent(1);
    await expect(cell(2, X)).toHaveText('7');
    await cell(2, X).click();
    const head = page.getByRole('group', { name: `${FACES}: card head` });
    const split = head.getByRole('button', { name: 'Split' });
    await expect(split).toBeDisabled();
    await expect(head.getByRole('list', { name: 'why some actions do not apply' })).toContainText(
        'Select the points to split off: drag over rows or press Space'
    );
    await cell(0, X).hover();
    await page.mouse.down();
    await cell(1, Z).hover();
    await page.mouse.up();
    await expect(split).toBeEnabled();
    await split.click();
    const batches = await sent(2);
    expect(batches[1]).toEqual([
        expect.objectContaining({ action: 'split', payload: { parts: [{ indices: [0, 1] }, { indices: [2] }] } }),
    ]);
});

/** Types `value` in the grid's cell at `row`, `column` and commits it with Enter. */
async function typeIn(
    page: Page,
    cell: (row: number, column: number) => Locator,
    row: number,
    column: number,
    value: string
) {
    await cell(row, column).click();
    await page.keyboard.type(value);
    await page.keyboard.press('Enter');
}

const FINAL = [
    { ...PRECUNEUS, coordinates: [5, -60, 42] },
    { ...INSULA, coordinates: [-36, 20, 7] },
];

test('three quick edits send nothing until a pause, then one batch of the final points; the grid never dims', async ({
    page,
}) => {
    const { cell, engage, batches, sent, holdNext, expectEditable } = await open(page);
    const release = holdNext();
    await engage(0, Z);
    await typeIn(page, cell, 0, Z, '42');
    await expectEditable();
    await typeIn(page, cell, 1, Z, '7');
    await expectEditable();
    await typeIn(page, cell, 0, X, '5');
    await expectEditable();
    await page.waitForTimeout(1000);
    expect(batches).toEqual([]);
    await expect.poll(() => batches.length).toBe(1);
    await expectEditable();
    release();
    const [batch] = await sent(1);
    expect(actions(batch)).toEqual([['coordinate', 'edit_points']]);
    expect(pointsOf(batch)).toEqual(FINAL);
    await expectEditable();
});

test('edits made while a batch waits for its answer stay editable and go out after it, in order', async ({ page }) => {
    const { cell, engage, batches, sent, holdNext, expectEditable } = await open(page);
    const release = holdNext();
    await engage(0, Z);
    await typeIn(page, cell, 0, Z, '42');
    await expect.poll(() => batches.length).toBe(1);
    await expectEditable();
    await typeIn(page, cell, 1, Z, '7');
    await expectEditable();
    await typeIn(page, cell, 0, X, '5');
    await expectEditable();
    await expect(cell(0, X)).toHaveText('5');
    await expect(cell(1, Z)).toHaveText('7');
    release();
    const [first, second] = await sent(2);
    expect(pointsOf(first)).toEqual([{ ...PRECUNEUS, coordinates: [4, -60, 42] }, INSULA]);
    expect(pointsOf(second)).toEqual(FINAL);
    await expectEditable();
    await expect(cell(0, X)).toHaveText('5');
});

test('Accept and Change role pressed while a point edit waits for its answer apply at once and go out after it, in order', async ({
    page,
}) => {
    const { cell, engage, batches, sent, holdNext } = await open(page);
    const release = holdNext();
    await engage(0, Z);
    await typeIn(page, cell, 0, Z, '42');
    await page.keyboard.press('Shift+J');
    await page.keyboard.press('Shift+K');
    await expect.poll(() => batches.length).toBe(1);
    const head = page.getByRole('group', { name: `${FACES}: card head` });
    await head.getByRole('button', { name: 'Accept' }).click();
    await expect(head).toContainText('verified');
    await head.getByRole('button', { name: 'Change role' }).click();
    const role = page.getByRole('combobox', { name: 'role' });
    await role.selectOption('anchor');
    await role.press('Enter');
    await expect(head.getByText('anchor', { exact: true })).toBeVisible();
    await expect(page.getByText(/wait/i)).toHaveCount(0);
    release();
    await expect.poll(() => batches.flat().length).toBe(3);
    const [first, ...rest] = await sent(batches.length);
    expect(actions(first)).toEqual([['coordinate', 'edit_points']]);
    const after = rest.flat();
    expect(actions(after)).toEqual([
        ['verdict', false],
        ['coordinate', 'relabel'],
    ]);
    const keyOf = (op: Op) => (op as { target: { analysis_key: string } }).target.analysis_key;
    expect(new Set(after.map(keyOf)).size).toBe(1);
    expect(keyOf(after[0])).not.toBe(keyOf(first[0]));
});
