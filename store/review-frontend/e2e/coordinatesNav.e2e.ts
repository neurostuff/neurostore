import { expect, test, type Page } from '@playwright/test';
import type { Op } from '../src/contract/generated/review-ops';
import { serve } from './server';

const FACES = 'Faces > Houses';
const HOUSES = 'Houses > Faces';
const LOCALIZER = 'Precuneus localizer';

const head = (page: Page, name: string) => page.getByRole('group', { name: `${name}: card head` });

test('Next on the coordinates head moves on, Accept says so, and Next analysis goes to the next unchecked one', async ({
    page,
}) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html');
    await expect(head(page, FACES)).toContainText('Analysis 1 of 3', { timeout: 20_000 });
    await expect(page.getByRole('toolbar')).toHaveCount(0);

    await head(page, FACES).getByRole('button', { name: 'Next' }).click();
    await expect(head(page, HOUSES)).toContainText('Analysis 2 of 3');
    await expect(page.getByRole('article', { name: HOUSES })).toHaveAttribute('aria-current', 'true');

    await head(page, HOUSES).getByRole('button', { name: 'Accept' }).click();
    await expect(head(page, HOUSES).getByRole('status', { name: 'last verdict' })).toHaveText(`Accepted ${HOUSES}`);
    await expect
        .poll(() => (batches.flat() as Op[]).filter((op) => op.type === 'verdict' && op.verdict === 'accept').length)
        .toBe(1);

    await head(page, HOUSES).getByRole('button', { name: 'Next analysis' }).click();
    await expect(head(page, LOCALIZER)).toContainText('Analysis 3 of 3');
});
