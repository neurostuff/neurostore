import { expect, test, type Page } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

const FACES = 'Faces > Houses';
const PRECUNEUS = { coordinates: [4, -60, 40], values: [{ kind: 't', value: 5.1 }], label: 'Precuneus' };
const INSULA = { coordinates: [-36, 20, 2], values: [{ kind: 't', value: 4.2 }], cluster_size: 12 };
const [X, , Z] = [0, 1, 2];

/** The paper open on its first analysis, its points in the static table, and no grid mounted yet. */
async function open(page: Page) {
    const { batches } = await serve(page);
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
    return { table, grid, staticCell, cell, engage, sent, noneSent };
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
