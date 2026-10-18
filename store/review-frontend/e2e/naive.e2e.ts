import { expect, test } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

/**
 * A first-time reviewer, by mouse alone: opens the paper, finds help, edits a field from its Edit button, accepts
 * beside the field, finishes a step and follows "Next", and submits through the confirmation.
 */
test('a reviewer new to the app reviews a paper by mouse, from help to submit', async ({ page }) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html?paper=P2');
    await expect(page.getByRole('banner')).toContainText('Grey matter in social anxiety', { timeout: 20_000 });

    await page.getByRole('button', { name: 'Help' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();

    await page.getByRole('button', { name: 'Next: Analyses →' }).click();
    const field = page.locator('[data-slot-key="slot:ana_1:groups[#0].n"]');
    await field.getByText('SAD-patients: n').click();
    const beside = field.getByRole('toolbar', { name: 'actions on SAD-patients: n' });
    await beside.getByRole('button', { name: 'Edit' }).click();
    await field.getByRole('spinbutton', { name: 'SAD-patients: n' }).fill('175');
    await field.getByRole('button', { name: 'Save' }).click();
    await expect(field.locator('.rv-slot-value')).toHaveText('175');

    await field
        .getByRole('toolbar', { name: 'actions on SAD-patients: n' })
        .getByRole('button', { name: 'Accept' })
        .click();

    await page.locator('[data-card="ana_1"]').click();
    await page.getByRole('toolbar', { name: 'review actions' }).getByRole('button', { name: 'Accept' }).click();
    const next = page.getByRole('button', { name: 'Next: Entities →' });
    await expect(next).toBeVisible();
    await expect(
        page
            .getByRole('button', { name: /^Analyses/ })
            .locator('.Mui-completed')
            .first()
    ).toBeVisible();
    await next.click();
    await expect(page.getByRole('list', { name: 'entities' })).toBeVisible();

    await page
        .getByRole('button', { name: /^Submit/ })
        .first()
        .click();
    await expect(page.getByRole('status', { name: 'save state: saved' })).toBeAttached({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Submit review' }).click();
    const confirm = page.getByRole('dialog', { name: /^Submit with \d+ items? unreviewed\?$/ });
    await expect(confirm.getByRole('list', { name: 'still unreviewed' })).toContainText('Entities');
    await confirm.getByRole('button', { name: 'Submit anyway' }).click();
    await expect(page.getByRole('status', { name: 'review submitted' })).toContainText('Review submitted');

    const sent = batches.flat() as Op[];
    expect(sent).toContainEqual(
        expect.objectContaining({
            type: 'set_value',
            target: { kind: 'slot', entity: 'ana_1', path: 'groups[#0].n' },
            value: expect.objectContaining({ value: 175 }),
        })
    );
    expect(sent).toContainEqual(
        expect.objectContaining({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'slot', entity: 'ana_1', path: 'groups[#0].n' },
        })
    );
    expect(sent).toContainEqual(
        expect.objectContaining({ type: 'verdict', verdict: 'accept', target: { kind: 'entity', entity: 'ana_1' } })
    );
});
