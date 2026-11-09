import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { formatBytes } from './review';
import { pickMaps } from './tree';
import { TreePicker } from './TreePicker';

// Each row calls formatBytes when it draws, so the calls count the rows drawn.
vi.mock('./review', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./review')>();
    return { ...actual, formatBytes: vi.fn(actual.formatBytes) };
});

const at = (path: string) => ({ file: new File([new Uint8Array(1000)], path.split('/').pop()!), path });
const feat = (n: number) => [`g.gfeat/cope${n}.feat/stats/zstat1.nii.gz`, `g.gfeat/cope${n}.feat/stats/cope1.nii.gz`];
const analyses = [{ key: 'a', name: 'Faces > Houses', description: null, points: 5 }];

function renderPicker(count: number, limit: number) {
    const candidates = pickMaps(
        Array.from({ length: count }, (_, i) => feat(i + 1))
            .flat()
            .map(at),
        limit
    );
    const onUpload = vi.fn();
    render(
        <TreePicker candidates={candidates} limit={limit} analyses={analyses} onClose={vi.fn()} onUpload={onUpload} />
    );
    return { onUpload };
}

const selectedList = () => within(screen.getByRole('region', { name: 'Selected maps' }));
/** A row's folder and file name, as the picker shows them. */
const where = (box: HTMLElement) => {
    const label = box.closest('label')!;
    return `${label.querySelector('.MuiTypography-caption')?.textContent}/${label.querySelector('p')?.textContent}`;
};
const ticked = () => selectedList().getAllByRole('checkbox').map(where);

test('every map is listed under its folder, with the number of maps before the name', () => {
    renderPicker(5, 2);
    expect(screen.getByRole('heading', { name: 'cope1.feat/stats (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'cope2.feat/stats (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'cope5.feat/stats (2)' })).toBeInTheDocument();
});

test('a selected map also shows, checked, under its folder', () => {
    renderPicker(5, 2);
    const section = screen.getByRole('heading', { name: 'cope1.feat/stats (2)' }).closest('section')!;
    const boxes = within(section).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, true]);
    const other = screen.getByRole('heading', { name: 'cope2.feat/stats (2)' }).closest('section')!;
    expect((within(other).getAllByRole('checkbox') as HTMLInputElement[]).map((box) => box.checked)).toEqual([
        false,
        false,
    ]);
});

test('unselecting a map takes it off the selected list but keeps it under its folder', async () => {
    renderPicker(5, 2);
    await userEvent.click(selectedList().getAllByRole('checkbox')[0]);
    expect(ticked()).toEqual(['cope1.feat/stats/zstat1.nii.gz']);
    const section = screen.getByRole('heading', { name: 'cope1.feat/stats (2)' }).closest('section')!;
    expect((within(section).getAllByRole('checkbox') as HTMLInputElement[]).map((box) => box.checked)).toEqual([
        false,
        true,
    ]);
});

test('the title names the folder in code type', () => {
    renderPicker(5, 2);
    const title = screen.getByRole('heading', { name: /^Select maps to upload \(\s*g\.gfeat\s*\)$/ });
    expect(title.textContent).toBe('Select maps to upload (g.gfeat)');
});

test('the filter narrows both lists, and says when nothing matches', async () => {
    renderPicker(5, 2);
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter maps' }), 'cope4');
    // Two rows in the results; the selected panel does not follow the filter.
    const results = screen.getByRole('heading', { name: 'cope4.feat/stats (2)' }).closest('section')!;
    expect(within(results).getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: /cope2/ })).not.toBeInTheDocument();
    expect(selectedList().getAllByRole('checkbox')).toHaveLength(2);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Filter maps' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter maps' }), 'zzz');
    expect(screen.getByText('No maps match “zzz”.')).toBeInTheDocument();
});

const swapPopover = () => within(screen.getByRole('dialog', { name: 'Swap this with a similar map' }));
const swapOptions = () => swapPopover().getAllByRole('button', { name: /\.nii\.gz$/ });

test('swapping a ticked map replaces it, with its effect map, where it stood', async () => {
    const { onUpload } = renderPicker(5, 2);
    expect(ticked()).toEqual(['cope1.feat/stats/cope1.nii.gz', 'cope1.feat/stats/zstat1.nii.gz']);
    await userEvent.click(screen.getByRole('button', { name: /Swap cope1.feat\/stats\/zstat1.nii.gz/ }));
    // The nearest maps come first, in folder order.
    expect(swapOptions()[0]).toHaveAccessibleName('cope2.feat/stats/zstat1.nii.gz');
    await userEvent.click(swapPopover().getByRole('button', { name: 'cope4.feat/stats/zstat1.nii.gz' }));
    expect(ticked()).toEqual(['cope4.feat/stats/cope1.nii.gz', 'cope4.feat/stats/zstat1.nii.gz']);
    await userEvent.click(screen.getByRole('button', { name: 'Upload 2 maps' }));
    expect(onUpload.mock.calls[0][0].map((map: { path: string }) => map.path)).toEqual([
        'g.gfeat/cope4.feat/stats/cope1.nii.gz',
        'g.gfeat/cope4.feat/stats/zstat1.nii.gz',
    ]);
});

test('the swap list shows every similar map, under a plain title, with a search and filters', async () => {
    renderPicker(40, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    const title = swapPopover().getByRole('heading', { name: 'Swap this with a similar map' });
    expect(getComputedStyle(title).lineHeight).toBe('normal');
    // 40 z maps, 3 of them ticked: all the rest are offered, not just the first few.
    expect(swapOptions()).toHaveLength(37);
    expect(swapPopover().getByRole('textbox', { name: 'Filter maps' })).toBeInTheDocument();
    expect(swapPopover().getByRole('combobox', { name: 'Filter by folder' })).toBeInTheDocument();
    expect(swapPopover().getByRole('combobox', { name: 'Filter by map type' })).toBeInTheDocument();
    expect(swapPopover().getByText('Showing 37 maps')).toBeInTheDocument();
});

test('each swap option looks like the rows of the selected panel', async () => {
    renderPicker(40, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    const option = within(swapOptions()[0]);
    // Folder, then the map type and file name, then the size.
    expect(option.getByText(/^cope\d+\.feat\/stats$/)).toBeInTheDocument();
    expect(option.getByText('z map')).toBeInTheDocument();
    expect(option.getByText('zstat1.nii.gz')).toBeInTheDocument();
    expect(option.getByText('1 KB')).toBeInTheDocument();
    expect(screen.getAllByTestId('FolderIcon').length).toBeGreaterThan(0);
});

test('the swap list can be searched and filtered', async () => {
    renderPicker(40, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    await userEvent.type(swapPopover().getByRole('textbox', { name: 'Filter maps' }), 'cope12');
    expect(swapOptions()).toHaveLength(1);
    expect(swapPopover().getByText('Showing 1 of 37 maps')).toBeInTheDocument();
    await userEvent.type(swapPopover().getByRole('textbox', { name: 'Filter maps' }), 'zzz');
    expect(swapPopover().getByText('No maps match these filters.')).toBeInTheDocument();
});

test('the swap filters start empty each time it opens', async () => {
    renderPicker(40, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    await userEvent.type(swapPopover().getByRole('textbox', { name: 'Filter maps' }), 'cope12');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    expect(swapOptions()).toHaveLength(37);
});

test('a map that is not ticked has no swap button', () => {
    renderPicker(5, 2);
    expect(screen.getAllByRole('button', { name: /^Swap / })).toHaveLength(2);
});

test('the filter box says how many maps it searches', () => {
    renderPicker(5, 2);
    expect(screen.getByPlaceholderText('Filter by file or folder name across 10 maps')).toBeInTheDocument();
});

test('the selected panel counts against the maximum', async () => {
    renderPicker(5, 2);
    expect(selectedList().getByText('(2 / 2)')).toBeInTheDocument();
    await userEvent.click(selectedList().getAllByRole('checkbox')[0]);
    expect(selectedList().getByText('(1 / 2)')).toBeInTheDocument();
});

test('the count is green up to the maximum and red at none or over it', async () => {
    renderPicker(5, 2);
    const colour = (text: string) => getComputedStyle(selectedList().getByText(text)).color;
    const green = colour('(2 / 2)');
    await userEvent.click(selectedList().getAllByRole('checkbox')[0]);
    expect(colour('(1 / 2)')).toBe(green);
    await userEvent.click(selectedList().getAllByRole('checkbox')[0]);
    const red = colour('(0 / 2)');
    expect(red).not.toBe(green);
    // Over the maximum: tick three more maps.
    for (const name of ['cope2.feat/stats', 'cope3.feat/stats']) {
        const section = screen.getByRole('heading', { name: `${name} (2)` }).closest('section')!;
        for (const box of within(section).getAllByRole('checkbox')) await userEvent.click(box);
    }
    expect(colour('(4 / 2)')).toBe(red);
});

test('the instructions sit in an accordion', async () => {
    renderPicker(5, 2);
    const header = screen.getByRole('button', { name: /^Instructions/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Faces > Houses')).toBeVisible();
    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
});

test('the over-the-limit notice is part of the instructions', async () => {
    renderPicker(5, 2);
    const notice = screen.getByText(/more maps than the maximum number allowed \(2\)/);
    expect(notice).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /^Instructions/ }));
    expect(notice).not.toBeVisible();
});

test('the folder filter narrows the results to the chosen folders', async () => {
    renderPicker(5, 2);
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by folder' }));
    await userEvent.click(screen.getByRole('option', { name: 'cope3.feat/stats' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'cope3.feat/stats (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'cope2.feat/stats (2)' })).not.toBeInTheDocument();
    // The selected panel keeps showing every chosen map.
    expect(selectedList().getAllByRole('checkbox')).toHaveLength(2);
});

test('the map type filter keeps only that kind, and the two filters combine', async () => {
    renderPicker(5, 2);
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by map type' }));
    await userEvent.click(screen.getByRole('option', { name: 'z map' }));
    await userEvent.keyboard('{Escape}');
    const section = screen.getByRole('heading', { name: 'cope2.feat/stats (1)' }).closest('section')!;
    expect(within(section).getAllByRole('checkbox')).toHaveLength(1);
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter maps' }), 'zzz');
    expect(screen.getByText('No maps match “zzz”.')).toBeInTheDocument();
});

test('filters that match nothing say so', async () => {
    renderPicker(5, 2);
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by map type' }));
    await userEvent.click(screen.getByRole('option', { name: 'effect map' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter maps' }), 'zstat');
    expect(screen.getByText('No maps match “zstat”.')).toBeInTheDocument();
});

test('a muted line says how many maps are showing, and of how many when filtering', async () => {
    renderPicker(5, 2);
    expect(screen.getByText('Showing 10 maps')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter maps' }), 'cope4');
    expect(screen.getByText('Showing 2 of 10 maps')).toBeInTheDocument();
});

test('in every row the map type comes before the file name', () => {
    renderPicker(5, 2);
    const section = screen.getByRole('heading', { name: 'cope2.feat/stats (2)' }).closest('section')!;
    const [first] = within(section).getAllByRole('checkbox');
    const label = first.closest('label')!;
    const chip = label.querySelector('.MuiChip-root')!;
    const name = label.querySelector('p')!;
    expect(chip.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const selectedLabel = selectedList().getAllByRole('checkbox')[0].closest('label')!;
    expect(
        selectedLabel.querySelector('.MuiChip-root')!.compareDocumentPosition(selectedLabel.querySelector('p')!) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
});

test('rows carry no file icon, and folders use the filled folder icon', () => {
    renderPicker(5, 2);
    expect(screen.queryByTestId('InsertDriveFileOutlinedIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('FolderOutlinedIcon')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('FolderIcon').length).toBeGreaterThan(0);
});

test('a reason for leaving a map out shows in the warning colour, and "over the limit" is not shown', () => {
    const candidates = pickMaps([...feat(1), ...feat(2), 'g.gfeat/cope1.feat/stats/thresh_zstat2.nii.gz'].map(at), 2);
    render(<TreePicker candidates={candidates} limit={2} analyses={analyses} onClose={vi.fn()} onUpload={vi.fn()} />);
    expect(screen.queryByText('over the limit')).not.toBeInTheDocument();
    const reason = screen.getByText('thresholded copy');
    expect(getComputedStyle(reason).color).not.toBe('');
    expect(getComputedStyle(reason).color).not.toBe(getComputedStyle(screen.getAllByText(/\bKB$/)[0]).color);
});

test('ticking one map draws only that map, not the whole list', async () => {
    renderPicker(40, 6);
    const rows = screen.getAllByRole('checkbox').length;
    expect(rows).toBeGreaterThan(80);
    vi.mocked(formatBytes).mockClear();
    const section = screen.getByRole('heading', { name: 'cope30.feat/stats (2)' }).closest('section')!;
    await userEvent.click(within(section).getAllByRole('checkbox')[0]);
    // The ticked map's row in its folder, and its new row in the selected panel.
    expect(vi.mocked(formatBytes).mock.calls.length).toBeLessThanOrEqual(4);
    vi.mocked(formatBytes).mockClear();
    await userEvent.click(within(section).getAllByRole('checkbox')[0]);
    expect(vi.mocked(formatBytes).mock.calls.length).toBeLessThanOrEqual(4);
});

const showMore = () => swapPopover().queryByRole('button', { name: /^Show \d+ more$/ });

test('the swap list opens with 100 options and adds 50 at a time', { timeout: 30000 }, async () => {
    renderPicker(200, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    expect(swapOptions()).toHaveLength(100);
    await userEvent.click(swapPopover().getByRole('button', { name: 'Show 50 more' }));
    expect(swapOptions()).toHaveLength(150);
    // 197 maps are on offer in all, so the last page is whatever is left.
    await userEvent.click(swapPopover().getByRole('button', { name: 'Show 47 more' }));
    expect(swapOptions()).toHaveLength(197);
    expect(showMore()).not.toBeInTheDocument();
});

test('a new search starts the swap list from 100 again', { timeout: 30000 }, async () => {
    renderPicker(200, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    await userEvent.click(swapPopover().getByRole('button', { name: 'Show 50 more' }));
    expect(swapOptions()).toHaveLength(150);
    await userEvent.type(swapPopover().getByRole('textbox', { name: 'Filter maps' }), 'cope1');
    // Over a hundred maps match, so it is a hundred again with the button to go on.
    expect(swapOptions()).toHaveLength(100);
    expect(showMore()).toBeInTheDocument();
});

test('a short swap list has no button to show more', async () => {
    renderPicker(40, 6);
    await userEvent.click(screen.getAllByRole('button', { name: /^Swap .*zstat1/ })[0]);
    expect(swapOptions()).toHaveLength(37);
    expect(showMore()).not.toBeInTheDocument();
});
