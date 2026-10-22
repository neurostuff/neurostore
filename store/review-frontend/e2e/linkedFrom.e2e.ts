import { expect, test } from '@playwright/test';
import { serve } from './server';

test('a group linked from two model estimations’ "group" terms reads one sentence, opening to a row each', async ({
    page,
}) => {
    await serve(page);
    await page.goto('/review/e2e/index.html?paper=P5');
    await page.getByRole('button', { name: /^Entities \d/ }).click({ timeout: 20_000 });
    await page
        .getByRole('list', { name: 'entities' })
        .getByRole('button', { name: /^patients/ })
        .first()
        .click();
    const section = page.getByRole('region', { name: 'Linked from: what points to this group' });
    const grouped = section.getByRole('listitem', {
        name: "In 2 model estimations: the term 'group', level 1 ('patients') is this group",
    });
    await expect(grouped).toContainText("In 2 model estimations: the term 'group', level 1 ('patients') is this group");
    await grouped.getByRole('button', { name: 'In 2 model estimations' }).click();
    const rows = grouped.getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.getByRole('button', { name: /^open group in / })).toHaveText([
        'GLM of group and condition',
        'GLM of group alone',
    ]);
    await expect(rows.first()).toHaveAccessibleName(
        "Model term 'group' in model estimation 'GLM of group and condition': its level 1 ('patients') is this group"
    );
    await expect(grouped.getByRole('button', { name: 'Accept all 2' })).toBeEnabled();
    await expect(section).not.toContainText('[#');
});
