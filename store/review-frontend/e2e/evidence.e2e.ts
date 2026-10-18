import { expect, test, type Page } from '@playwright/test';
import { serve } from './server';

/** The viewport points at the start and the end of the first `words` in the paper text. */
const pointsOf = (page: Page, words: string) =>
    page.evaluate((words) => {
        const root = document.querySelector('[data-text-root]')!;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node as Text;
            const at = text.data.indexOf(words);
            if (at < 0) continue;
            const box = (from: number) => {
                const range = document.createRange();
                range.setStart(text, from);
                range.setEnd(text, from + 1);
                return range.getBoundingClientRect();
            };
            const first = box(at);
            const last = box(at + words.length - 1);
            return {
                from: [first.left + 1, first.top + first.height / 2],
                to: [last.right - 1, last.top + last.height / 2],
            };
        }
        throw new Error(`no text ${words}`);
    }, words);

const focusHighlight = (page: Page) =>
    page.evaluate(() => [...(CSS.highlights.get('rv-focus') ?? [])].map((range) => range.toString()));

test('text selected inside a sentence several other fields use is added to the focused field from the bar, and highlighted', async ({
    page,
}) => {
    const { batches } = await serve(page);
    await page.goto('/review/e2e/index.html?paper=P3');
    await page.getByRole('button', { name: 'Next: Analyses →' }).click({ timeout: 20_000 });
    await page.locator('[data-slot-key="slot:ana_1:name"]').getByText('Name', { exact: true }).click();
    await expect.poll(() => focusHighlight(page)).toEqual(['larger putamen volume']);

    const { from, to } = await pointsOf(page, 'SAD-patients and');
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move(to[0], to[1], { steps: 8 });
    await page.mouse.up();

    await expect(page.getByRole('menu')).toHaveCount(0);
    await page
        .getByRole('toolbar', { name: 'selection' })
        .getByRole('button', { name: /^Add as evidence for/ })
        .click();
    await expect.poll(() => focusHighlight(page)).toEqual(['SAD-patients and', 'larger putamen volume']);
    await expect.poll(() => batches.length).toBe(1);
    expect(batches[0]).toEqual([
        expect.objectContaining({ type: 'set_evidence', target: { kind: 'slot', entity: 'ana_1', path: 'name' } }),
    ]);
    expect(await focusHighlight(page)).toEqual(['SAD-patients and', 'larger putamen volume']);
});
