import { expect, test } from '@playwright/test';
import { serve } from './server';

const MR_TYPE =
    'Acquisition dimensionality, such as 2D or 3D; useful for distinguishing protocols with materially different spatial sampling.';

test('an MRI value’s description shows on hover and collapsed under its details, More opening it all', async ({
    page,
}) => {
    await serve(page);
    await page.goto('/review/e2e/index.html?paper=P5');
    await page.getByRole('button', { name: /^Entities \d/ }).click({ timeout: 20_000 });
    await page
        .getByRole('list', { name: 'entities' })
        .getByRole('button', { name: /^gradient-echo EPI, 2D Acquisition/ })
        .first()
        .click();
    const value = page.getByRole('button', { name: '2D', exact: true });
    await expect(value).toHaveAttribute('title', new RegExp(`: ${MR_TYPE.replace(/[.()]/g, '\\$&')}$`));
    await value.click();
    const about = page
        .getByRole('region', { name: 'Selected field' })
        .getByRole('region', { name: 'About this field' });
    const more = about.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const line = about.locator('.rv-field-about-text');
    await expect(line).toHaveCSS('white-space', 'nowrap');
    expect(await line.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(24);
    await more.click();
    await expect(about).toContainText(MR_TYPE);
    await expect(about.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
});
