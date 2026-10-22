import { expect, test } from '@playwright/test';
import type { CreateEntityOp } from '../src/contract/generated/review-ops';
import { problemsWithCreated } from '../src/test/recordProblems';
import { serve } from './server';

test('New analysis on an analysis’s card adds an analysis the server takes, with no banner', async ({ page }) => {
    const { batches } = await serve(page, { createdProblems: problemsWithCreated });
    await page.goto('/review/e2e/index.html?paper=P4');
    await page.getByRole('button', { name: /^Analyses \d/ }).click({ timeout: 20_000 });
    await page.locator('[data-slot-key="slot:an_1:name"]').getByRole('button').click();
    await page.getByRole('button', { name: 'New analysis' }).click();
    await expect.poll(() => batches.length).toBe(1);
    const [op] = batches[0] as CreateEntityOp[];
    expect(op).toMatchObject({ type: 'create_entity', parent: 'study', list: 'analyses' });
    const created = (op.entity as { local_id: string }).local_id;
    await expect(page.getByRole('status', { name: /^save state/ })).toHaveAccessibleName('save state: saved');
    await expect(page.locator(`[data-slot-key="slot:${created}:name"]`)).toBeAttached();
    await expect(page.getByRole('status').filter({ hasText: 'Couldn’t' })).toHaveCount(0);
});
