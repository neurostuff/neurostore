import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { GroupingBoard } from './GroupingBoard';
import type { ShareUpload, ShareView } from './types';

const upload = (id: string, keys: string[], over: Partial<ShareUpload> = {}): ShareUpload => ({
    id,
    filename: `${id}.nii.gz`,
    path: null,
    kind: 'statistic',
    map_type_by: 'name',
    partner_id: null,
    partner_r: null,
    partner_by: null,
    reversed: false,
    size_bytes: 1000,
    check_status: 'ok',
    problem: null,
    thresholded: false,
    analysis_keys: keys,
    assigned_by: keys.length > 0 ? 'suggestion' : null,
    label: null,
    map_type: 'z',
    fits: {},
    ...over,
});

const view = (uploads: ShareUpload[]): ShareView => ({
    preview: false,
    status: 'uploading',
    open: true,
    closed_reason: null,
    paper: { title: 'A paper', journal: null, year: 2026, authors: null, doi: null, pmid: null, pmcid: null },
    analyses: [
        { key: 'a', name: 'Faces > Houses', description: null, points: 5 },
        { key: 'b', name: 'Houses > Faces', description: null, points: 5 },
    ],
    collection: {},
    software: null,
    uploads,
    issues: [],
    submitter_name: null,
    submitter_orcid: null,
    limits: { max_files: 9, max_file_bytes: 200 * 1024 * 1024, extensions: ['.nii.gz'], map_types: [] },
});

function renderBoard(v: ShareView, over: Partial<Parameters<typeof GroupingBoard>[0]> = {}) {
    const handlers = { onAssign: vi.fn(), onChange: vi.fn(), onRemoveFile: vi.fn(), onIssue: vi.fn() };
    render(<GroupingBoard view={v} folder="" disabled={false} busy={false} {...handlers} {...over} />);
    return handlers;
}

const lane = (name: string) => within(screen.getByText(name).closest('.MuiAccordion-root') as HTMLElement);

test('a map with a saved guess is on its analysis, one without waits under "Unassigned maps"', () => {
    renderBoard(view([upload('1', ['a']), upload('2', [])]));
    expect(lane('Faces > Houses').getByText('1.nii.gz')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Unassigned maps' })).toBeInTheDocument();
    expect(screen.getByText('2.nii.gz')).toBeInTheDocument();
    expect(lane('Houses > Faces').getByText('0 maps')).toBeInTheDocument();
    expect(lane('Faces > Houses').getByText('1 map')).toBeInTheDocument();
});

test('a suggested map says so, and one the author placed does not', () => {
    renderBoard(view([upload('1', ['a']), upload('2', ['b'], { assigned_by: 'author' })]));
    expect(lane('Faces > Houses').getByText('suggested')).toBeInTheDocument();
    expect(lane('Houses > Faces').queryByText('suggested')).not.toBeInTheDocument();
});

test('moving a map out of the pool sends it to the chosen analysis', async () => {
    const { onAssign } = renderBoard(view([upload('2', [])]));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 2.nii.gz' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Houses > Faces/ }));
    expect(onAssign).toHaveBeenCalledWith([{ id: '2', keys: ['b'] }]);
});

test('moving a suggested map to another analysis replaces the suggestion', async () => {
    const { onAssign } = renderBoard(view([upload('1', ['a'])]));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 1.nii.gz' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Houses > Faces/ }));
    expect(onAssign).toHaveBeenCalledWith([{ id: '1', keys: ['b'] }]);
});

test('choosing the analysis a map is already on changes nothing', async () => {
    const { onAssign } = renderBoard(view([upload('1', ['a'])]));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 1.nii.gz' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Faces > Houses/ }));
    expect(onAssign).not.toHaveBeenCalled();
});

test('the Unassign button on a map takes it off its analysis, recording the choice', async () => {
    const { onAssign } = renderBoard(view([upload('1', ['a'])]));
    await userEvent.click(screen.getByRole('button', { name: 'Unassign 1.nii.gz' }));
    expect(onAssign).toHaveBeenCalledWith([{ id: '1', keys: [] }]);
});

test('the move menu only assigns: it has no Unassign, on an analysis or in the pool', async () => {
    for (const keys of [['a'], []]) {
        renderBoard(view([upload('1', keys)]));
        await userEvent.click(screen.getByRole('button', { name: 'Options for 1.nii.gz' }));
        expect(screen.getByRole('textbox', { name: 'Search analyses' })).toBeInTheDocument();
        expect(within(screen.getByRole('menu')).queryByText(/Unassign/)).not.toBeInTheDocument();
        cleanup();
    }
});

test('an assigned map has Unassign where a map in the pool has the trash button', () => {
    renderBoard(view([upload('1', ['a']), upload('2', [])]));
    expect(screen.getByRole('button', { name: 'Unassign 1.nii.gz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove 1.nii.gz' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove 2.nii.gz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unassign 2.nii.gz' })).not.toBeInTheDocument();
});

test('an effect map in a card on an analysis is unassigned from its t/z map, not deleted', async () => {
    const effect = upload('2', ['a'], { kind: 'effect', map_type: 'effect', partner_id: '1', assigned_by: 'set' });
    const { onChange } = renderBoard(view([upload('1', ['a']), effect]));
    expect(screen.getByRole('button', { name: 'Unassign 1.nii.gz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove 2.nii.gz' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unassign 2.nii.gz from its t/z map' }));
    // Unpaired and on no analysis, in one request, so the server does not place it again.
    expect(onChange).toHaveBeenCalledWith('2', { partner_id: null, analysis_keys: [] });
});

test('an effect map in a card still in the pool keeps the trash button', () => {
    const effect = upload('2', [], { kind: 'effect', map_type: 'effect', partner_id: '1', assigned_by: null });
    renderBoard(view([upload('1', []), effect]));
    expect(screen.getByRole('button', { name: 'Remove 2.nii.gz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unassign 2.nii.gz from its t/z map' })).not.toBeInTheDocument();
});

test('the move menu searches analyses by name', async () => {
    renderBoard(view([upload('2', [])]));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 2.nii.gz' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Search analyses' }), 'houses >');
    expect(screen.getByRole('menuitem', { name: /Houses > Faces/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Faces > Houses/ })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Search analyses' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Search analyses' }), 'nothing like it');
    expect(screen.getByText('No matching analyses')).toBeInTheDocument();
});

test('an effect map sits inside its t/z map\'s card and its menu has no analyses to move to', async () => {
    const effect = upload('2', ['a'], { kind: 'effect', map_type: 'effect', partner_id: '1', assigned_by: 'set' });
    renderBoard(view([upload('1', ['a']), effect]));
    expect(lane('Faces > Houses').getByText('2.nii.gz')).toBeInTheDocument();
    const parentCard = screen.getByText('1.nii.gz').closest('.MuiPaper-root') as HTMLElement;
    expect(parentCard).toContainElement(screen.getByText('2.nii.gz'));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 2.nii.gz' }));
    expect(screen.queryByRole('textbox', { name: 'Search analyses' })).not.toBeInTheDocument();
});

test('an effect map can be paired with a t/z map from its menu', async () => {
    const effect = upload('2', [], { kind: 'effect', map_type: 'effect' });
    const { onChange } = renderBoard(view([upload('1', ['a']), effect]));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 2.nii.gz' }));
    await userEvent.click(screen.getByRole('menuitem', { name: '1.nii.gz' }));
    expect(onChange).toHaveBeenCalledWith('2', { partner_id: '1' });
});

test('a file that could not be read is listed with its error and can be removed', async () => {
    const bad = upload('3', [], { check_status: 'problem', problem: 'This map holds no numbers.' });
    const { onRemoveFile } = renderBoard(view([bad]));
    expect(screen.getByText(/This map holds no numbers\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemoveFile).toHaveBeenCalledWith('3');
});

test('nothing can be moved while a change is going through', () => {
    renderBoard(view([upload('1', ['a'])]), { busy: true });
    expect(screen.getByRole('button', { name: 'Options for 1.nii.gz' })).toBeDisabled();
});

test('reporting a problem with an analysis names it', async () => {
    const { onIssue } = renderBoard(view([]));
    await userEvent.click(
        within(screen.getByText('Houses > Faces').closest('.MuiAccordion-root') as HTMLElement).getByRole('button', {
            name: /something's wrong/,
        })
    );
    expect(onIssue).toHaveBeenCalledWith('b');
    await userEvent.click(screen.getByRole('button', { name: 'An analysis is missing' }));
    expect(onIssue).toHaveBeenLastCalledWith(null);
});

test('the map type is set from a dropdown on the map', async () => {
    const { onChange } = renderBoard(view([upload('1', ['a'])]));
    await userEvent.click(screen.getByRole('combobox', { name: 'Kind of map for 1.nii.gz' }));
    await userEvent.click(screen.getByRole('option', { name: 't map' }));
    expect(onChange).toHaveBeenCalledWith('1', { map_type: 't' });
});

test('a map in the pool is removed with the trash button on its row', async () => {
    const { onRemoveFile } = renderBoard(view([upload('1', [])]));
    await userEvent.click(screen.getByRole('button', { name: 'Remove 1.nii.gz' }));
    expect(onRemoveFile).toHaveBeenCalledWith('1');
});

test('the description field is hidden until the author says the paper does not table the map', async () => {
    const { onChange } = renderBoard(view([upload('1', ['a']), upload('2', [])]));
    expect(screen.queryByRole('textbox', { name: /What is this map\?/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Not reported in the paper's tables" }));
    expect(screen.queryByRole('button', { name: "Not reported in the paper's tables" })).not.toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: /What is this map\?/ });
    await userEvent.type(field, 'Faces only');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith('2', { label: 'Faces only' });
});

test('a map with a description shows its field, and only maps in the pool have the link', async () => {
    renderBoard(view([upload('1', ['a']), upload('2', [], { label: 'Faces only' }), upload('3', [])]));
    expect(screen.getAllByRole('textbox', { name: /What is this map\?/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: "Not reported in the paper's tables" })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Options for 3.nii.gz' }));
    expect(screen.queryByRole('menuitem', { name: /Not reported/ })).not.toBeInTheDocument();
});

test('the move menu shows how well the map fits each analysis', async () => {
    const fits: ShareUpload['fits'] = {
        a: { outcome: 'no_match', score: null, reason: null },
        b: { outcome: 'match', score: null, reason: null },
    };
    renderBoard(view([upload('1', [], { fits })]));
    await userEvent.click(screen.getByRole('button', { name: 'Options for 1.nii.gz' }));
    expect(screen.getByRole('menuitem', { name: /Faces > Houses.*Peaks not found/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Houses > Faces.*Peaks match/ })).toBeInTheDocument();
    expect(screen.getAllByText('5 coordinates').length).toBeGreaterThanOrEqual(2);
});

test('a map shows the folder it is in above its type, file name and size', () => {
    renderBoard(view([upload('1', ['a'], { path: 'study/stats/z.nii.gz', filename: 'z.nii.gz', size_bytes: 2048 })]));
    const row = within(lane('Faces > Houses').getByText('z.nii.gz').closest('.MuiPaper-root') as HTMLElement);
    expect(row.getByText('stats')).toBeInTheDocument();
    expect(row.getByText('2 KB')).toBeInTheDocument();
    expect(row.getByRole('combobox', { name: /Kind of map for/ })).toBeInTheDocument();
});
