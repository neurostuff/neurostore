import { expect, test } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

/** The verdicts on links sent, each op once though a batch may be sent again. */
const verdicts = (batches: unknown[][]) => [
    ...new Map(
        (batches.flat() as Op[]).flatMap((op) =>
            op.type === 'verdict' && op.target.kind === 'relationship'
                ? [[op.client_op_id, `${op.verdict} ${op.target.path}`] as const]
                : []
        )
    ).values(),
];

test('a link is accepted and another rejected by keys, and one added back through the picker counts as added', async ({
    page,
}) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html?paper=P4');
    const step = page.getByRole('button', { name: /^Relationships \d/ });
    await step.click({ timeout: 20_000 });
    await expect(step).toContainText('0 of 4');
    const card = page.getByRole('list', { name: 'relationships' }).locator(':scope > li').first();
    await expect(card).toContainText('0 of 4 links judged');

    await page.keyboard.press('j');
    await page.keyboard.press('a');
    await page.keyboard.press('j');
    await page.keyboard.press('r');
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    await expect(step).toContainText('2 of 4');
    await expect(card).toContainText('2 of 4 links judged');
    await expect.poll(() => verdicts(batches)).toEqual(['accept acquisitions', 'reject measure']);

    const tasks = page.getByRole('group', { name: /^Tasks/ });
    await tasks.getByText('Stroop').click();
    await tasks.getByRole('button', { name: 'Remove link' }).click();
    await expect(step).toContainText('2 of 3');
    await expect(tasks).toContainText('No task linked');

    const picker = tasks.getByRole('combobox', { name: /^link a task to / });
    await picker.fill('Str');
    await page.keyboard.press('Enter');
    await expect(step).toContainText('3 of 4');
    await expect(card).toContainText('3 of 4 links judged');
    const relinked = page.getByRole('group', { name: 'Tasks (1 linked)' });
    await expect(relinked).toContainText('Stroop');
    await expect(relinked).toContainText(/added/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
