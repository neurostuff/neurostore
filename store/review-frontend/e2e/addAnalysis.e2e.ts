import { expect, test } from '@playwright/test';
import { serve } from './server';

test('adding an analysis to a table sends the rows typed into its grid as the analysis’s points', async ({ page }) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html');
    await page.getByRole('button', { name: 'Add an analysis to Table 2' }).click({ timeout: 20_000 });
    const form = page.getByRole('group', { name: 'new analysis in Table 2' });
    await form.getByRole('textbox', { name: 'name' }).fill('Scrambled');
    const grid = form.getByRole('group', { name: 'points of the new analysis' });
    const cell = (row: number, column: number) =>
        grid.locator('.ht_master .htCore tbody tr').nth(row).locator('td').nth(column);
    await cell(0, 0).click();
    for (const [row, values] of [
        [0, ['1', '2', '3']],
        [1, ['-4', '5', '6']],
    ] as const) {
        if (row > 0) {
            await form.getByRole('button', { name: 'Add row', exact: true }).click();
            await cell(row, 0).click();
        }
        for (const [i, value] of values.entries()) {
            await page.keyboard.type(value);
            await page.keyboard.press(i === values.length - 1 ? 'Enter' : 'Tab');
        }
    }
    await expect(form).toBeVisible();
    await form.getByRole('button', { name: 'Add analysis' }).click();
    await expect.poll(() => batches.length).toBe(1);
    expect(batches[0]).toEqual([
        expect.objectContaining({
            type: 'coordinate',
            action: 'add',
            payload: {
                analysis: expect.objectContaining({
                    table_id: 't2',
                    name: 'Scrambled',
                    points: [{ coordinates: [1, 2, 3] }, { coordinates: [-4, 5, 6] }],
                }),
            },
        }),
    ]);
});
