import { expect, test, type Locator, type Page } from '@playwright/test';
import { serve } from './server';

/**
 * The open card scrolled to the top of the pane that scrolls it, and how far its bottom is above the pane's bottom:
 * negative where the card would scroll.
 */
async function room(card: Locator) {
    return card.evaluate((element) => {
        let pane = element.parentElement;
        while (pane && !/(auto|scroll)/.test(getComputedStyle(pane).overflowY)) pane = pane.parentElement;
        element.scrollIntoView({ block: 'start' });
        const bottom = (pane ?? document.documentElement).getBoundingClientRect().bottom;
        return Math.min(bottom, window.innerHeight) - element.getBoundingClientRect().bottom;
    });
}

async function openStep(page: Page, step: RegExp) {
    await serve(page);
    await page.goto('/review/e2e/index.html?paper=P5');
    await page.getByRole('button', { name: step }).click({ timeout: 20_000 });
}

test('a group of 39 fields fits the inspector at 1440×900 with its fold closed', async ({ page }) => {
    await openStep(page, /^Entities \d/);
    await page
        .getByRole('list', { name: 'entities' })
        .getByRole('button', { name: /^patients/ })
        .first()
        .click();
    const fields = page.getByRole('region', { name: 'Fields of patients' });
    await expect(fields.getByRole('region', { name: 'About' })).toContainText('28 human participants aged 34.2');
    await expect(fields.getByRole('button', { name: /more fields/ })).toHaveAttribute('aria-expanded', 'false');
    expect(await room(fields.getByRole('region', { name: 'patients', exact: true }))).toBeGreaterThanOrEqual(0);
});

test('a heavy analysis fits the inspector at 1440×900 with its fold closed, its comparison first', async ({ page }) => {
    await openStep(page, /^Analyses \d/);
    const fields = page.getByRole('region', { name: /^Fields of / });
    await expect(fields.getByRole('region', { name: 'What is compared' })).toBeVisible();
    await expect(fields.getByRole('region', { name: 'About' })).toContainText('planned interaction analysis');
    await expect(fields.getByRole('button', { name: /more fields/ })).toHaveAttribute('aria-expanded', 'false');
    const name = (await fields.getAttribute('aria-label'))!.replace(/^Fields of /, '');
    expect(await room(fields.getByRole('region', { name, exact: true }))).toBeGreaterThanOrEqual(0);
});

test('a value clicked shows its details below, with the field actions', async ({ page }) => {
    await openStep(page, /^Entities \d/);
    await page
        .getByRole('list', { name: 'entities' })
        .getByRole('button', { name: /^patients/ })
        .first()
        .click();
    const fields = page.getByRole('region', { name: 'Fields of patients' });
    await fields.getByRole('button', { name: '53.6' }).first().click();
    const selected = fields.getByRole('region', { name: 'Selected field' });
    await expect(selected).toContainText('15 of 28 is 53.6%: matches');
    await expect(selected.getByRole('toolbar', { name: /^actions on / })).toBeVisible();
});
