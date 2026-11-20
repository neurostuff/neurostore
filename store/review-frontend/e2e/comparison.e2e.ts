import { expect, test } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

test('an interaction reads as its factors, and a − sign takes the field actions', async ({ page }) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html?paper=P5');
    await page.getByRole('button', { name: /^Analyses \d/ }).click({ timeout: 20_000 });
    const compared = page.getByRole('region', { name: 'What is compared' });
    await expect(compared.getByRole('heading')).toHaveText('(patients − controls) × (incongruent − congruent)');
    const less = compared.getByRole('group', { name: 'condition' }).getByRole('button', { name: /^− congruent,/ });
    await less.click();
    await expect(less).toHaveAttribute('aria-current', 'true');
    await compared
        .getByRole('toolbar', { name: /^actions on / })
        .getByRole('button', { name: 'Accept' })
        .click();
    await expect(less).toHaveAccessibleName('− congruent, verified');
    await expect
        .poll(() =>
            (batches.flat() as Op[]).flatMap((op) =>
                op.type === 'verdict' && op.target.kind === 'slot' ? [`${op.verdict} ${op.target.path}`] : []
            )
        )
        .toEqual(['accept effect.cells[#3].direction']);
});
