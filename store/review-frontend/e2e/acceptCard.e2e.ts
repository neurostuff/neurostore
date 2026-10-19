import { expect, test } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

const accepted = (batches: unknown[][]) =>
    (batches.flat() as Op[])
        .flatMap((op) =>
            op.type === 'verdict' && op.verdict === 'accept'
                ? [op.target.kind === 'slot' ? op.target.path : op.target.kind]
                : []
        )
        .sort();

test('Accept analysis on the only analysis finishes the step, and the next step is offered', async ({ page }) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html?paper=P2');
    await page.getByRole('button', { name: /^Analyses \d/ }).click({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /^analyses ·/ })).toContainText('0 of 1 done');
    await page.getByRole('button', { name: 'Accept analysis' }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Accepted/ })).toHaveText(
        'Accepted the analysis and 2 fields'
    );
    await expect(page.getByRole('heading', { name: /^analyses ·/ })).toContainText('1 of 1 done');
    await expect(page.getByRole('button', { name: 'Next: Entities →' })).toBeVisible();
    await expect.poll(() => accepted(batches)).toEqual(['entity', 'groups[#0].n', 'name']);
});

test('Accept analysis asks first where no field has evidence, and Enter accepts them all', async ({ page }) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html?paper=P4');
    await page.getByRole('button', { name: /^Analyses \d/ }).click({ timeout: 20_000 });
    await page.keyboard.press('Shift+A');
    const dialog = page.getByRole('dialog', { name: 'These fields don’t have evidence' });
    await expect(dialog.getByRole('button', { name: 'Accept fields with evidence' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Accept all fields' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: /^Accepted/ })).toHaveText(
        /^Accepted the analysis and \d+ fields$/
    );
    await expect.poll(() => accepted(batches)).toContain('entity');
    await expect(page.getByRole('button', { name: 'Next: Entities →' })).toBeVisible();
});

test('the card head stays at the top of its fields while they scroll, and Accept stays clickable', async ({ page }) => {
    await serve(page);
    await page.goto('/review/e2e/index.html?paper=P4');
    await page.getByRole('button', { name: /^Analyses \d/ }).click({ timeout: 20_000 });
    const pane = page.getByRole('complementary', { name: 'review' });
    const fields = page.getByRole('region', { name: /^Fields of / });
    const head = fields.getByRole('group', { name: /: card head$/ });
    const region = (await fields.boundingBox())!;
    const pageTop = (await pane.boundingBox())!.y;
    await pane.evaluate((el, middle) => el.scrollBy(0, middle), region.y - pageTop + region.height / 2);
    const scrolled = (await fields.boundingBox())!;
    expect(scrolled.y).toBeLessThan(pageTop - 100);
    const stuck = (await head.boundingBox())!;
    expect(Math.abs(stuck.y - pageTop)).toBeLessThan(2);
    expect(stuck.y + stuck.height).toBeLessThan(scrolled.y + scrolled.height);
    await head.getByRole('button', { name: 'Accept analysis' }).click();
    await expect(page.getByRole('dialog', { name: 'These fields don’t have evidence' })).toBeVisible();
});
