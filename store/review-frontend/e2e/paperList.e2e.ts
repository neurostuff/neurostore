import { expect, test } from '@playwright/test';
import { E2E_API } from './api';

const paper = {
    id: 'P1',
    base_study_id: 'B-P1',
    label: 'Grey matter in social anxiety',
    origin: 'upload',
    created_at: '2026-10-16T09:00:00+00:00',
    total: 0,
    assignees: [],
    reviews: [],
};

test('the lead’s assignment control shows its whole label', async ({ page }) => {
    await page.route(`**${E2E_API}/**`, async (route) => {
        const path = new URL(route.request().url()).pathname.slice(E2E_API.length);
        if (path === '/review/me') return route.fulfill({ json: { user_id: 'me', name: 'Me', lead: true } });
        if (path === '/review/reviewers/')
            return route.fulfill({ json: { results: [{ user_id: 'sam', name: 'Sam' }] } });
        if (path.startsWith('/review/sources/'))
            return route.fulfill({ json: { metadata: { total_count: 1 }, results: [paper] } });
        return route.fulfill({ status: 404, json: { status: 404, detail: path } });
    });
    await page.goto('/review/e2e/index.html?page=papers');
    const label = page.locator('label', { hasText: 'Reviewer assigned' });
    await expect(label).toBeVisible({ timeout: 20_000 });
    const clipped = await label.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(clipped).toBe(false);
    await expect(
        page.getByRole('combobox', { name: 'Reviewer assigned to Grey matter in social anxiety' })
    ).toBeVisible();
});
