import { expect, test } from '@playwright/test';
import { serve } from './server';

const PAGE = '/review/e2e/index.html?paper=P1';

test('dragging the divider widens the inspector, and the width it leaves is kept through a reload', async ({
    page,
}) => {
    await serve(page);
    await page.goto(PAGE);
    const divider = page.getByRole('separator', { name: 'Resize the text and the review panes' });
    await expect(divider).toBeVisible({ timeout: 20_000 });
    const inspector = page.getByRole('complementary', { name: 'review' });
    const before = (await inspector.boundingBox())!.width;
    const handle = (await divider.boundingBox())!;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(handle.x + handle.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(handle.x - 200, y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await inspector.boundingBox())!.width).toBeGreaterThan(before + 150);
    const after = (await inspector.boundingBox())!.width;
    const share = await divider.getAttribute('aria-valuenow');

    // The e2e entry replaces its own URL, so a reload is a fresh visit to it.
    await page.goto(PAGE);
    await expect(divider).toHaveAttribute('aria-valuenow', share!, { timeout: 20_000 });
    expect(Math.abs((await inspector.boundingBox())!.width - after)).toBeLessThan(2);
});
