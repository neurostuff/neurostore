import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ShareApi } from './api';
import { SharePage } from './SharePage';
import type { ShareView } from './types';

const view = (over: Partial<ShareView> = {}): ShareView => ({
    preview: false,
    status: 'uploading',
    open: true,
    closed_reason: null,
    paper: {
        title: 'Faces and houses in the brain',
        journal: 'Neuron',
        year: 2026,
        authors: 'A. Author, B. Author',
        doi: '10.1000/xyz',
        pmid: null,
        pmcid: null,
    },
    analyses: [{ key: 'a', name: 'Faces > Houses', description: null, points: 5 }],
    collection: { name: 'Faces' },
    software: null,
    uploads: [],
    issues: [],
    submitter_name: null,
    submitter_orcid: null,
    limits: { max_files: 100, max_file_bytes: 200 * 1024 * 1024, extensions: ['.nii.gz'], map_types: [] },
    ...over,
});

const api = {} as ShareApi;

test('the paper has a card of its own, with its title, authors and links', () => {
    render(<SharePage api={api} initial={view()} />);
    expect(screen.getByRole('heading', { name: 'Faces and houses in the brain' })).toBeInTheDocument();
    expect(screen.getByText('A. Author, B. Author')).toBeInTheDocument();
    expect(screen.getByText('Neuron, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DOI' })).toHaveAttribute('href', 'https://doi.org/10.1000/xyz');
});

test('a paper without a journal, authors or links shows only what it has', () => {
    const paper = {
        title: 'Only a title',
        journal: null,
        year: null,
        authors: null,
        doi: null,
        pmid: null,
        pmcid: null,
    };
    render(<SharePage api={api} initial={view({ paper })} />);
    expect(screen.getByRole('heading', { name: 'Only a title' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('the steps are numbered one to four, with the folder button first', () => {
    render(<SharePage api={api} initial={view()} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
        'Faces and houses in the brain',
        'Add your maps',
        'Check each map',
        'Collection details',
        'Submit',
    ]);
    expect(screen.getByRole('button', { name: 'Choose a folder' })).toBeEnabled();
});

test('the folder help is always shown, above the upload box', () => {
    render(<SharePage api={api} initial={view()} />);
    expect(screen.queryByRole('button', { name: 'Which folder do I choose?' })).not.toBeInTheDocument();
    const help = screen.getByLabelText('Maps made with');
    const upload = screen.getByRole('button', { name: 'Choose a folder' });
    expect(help.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('the collection details start folded and open with Edit', async () => {
    render(<SharePage api={api} initial={view()} />);
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(edit);
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
});

test('before the author starts, only the invitation card shows', () => {
    render(<SharePage api={api} initial={view({ status: 'contacted' })} />);
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add your maps' })).not.toBeInTheDocument();
});

test('choosing a folder uploads its NIfTI files with their paths, and nothing else', async () => {
    const files = ['study/stats/z.nii.gz', 'study/stats/notes.txt', 'study/c.nii.gz'].map((path) => {
        const file = new File(['x'], path.split('/').pop()!);
        Object.defineProperty(file, 'webkitRelativePath', { value: path });
        return file;
    });
    const upload = vi.fn().mockResolvedValue(view());
    const { container } = render(<SharePage api={{ upload } as unknown as ShareApi} initial={view()} />);
    const input = container.querySelector('input[webkitdirectory]') as HTMLInputElement;
    await userEvent.upload(input, files, { applyAccept: false });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(upload.mock.calls.map(([, path]) => path)).toEqual(['study/stats/z.nii.gz', 'study/c.nii.gz']);
});

test('a folder with no NIfTI files says so instead of doing nothing', async () => {
    const file = new File(['x'], 'readme.md');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'study/readme.md' });
    const upload = vi.fn();
    const { container } = render(<SharePage api={{ upload } as unknown as ShareApi} initial={view()} />);
    await userEvent.upload(container.querySelector('input[webkitdirectory]') as HTMLInputElement, file, {
        applyAccept: false,
    });
    expect(await screen.findByText(/found no new \.nii or \.nii\.gz files/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
});

const mapUpload = (id: string, keys: string[]) => ({
    id,
    filename: `${id}.nii.gz`,
    path: null,
    kind: 'statistic' as const,
    map_type_by: 'name' as const,
    partner_id: null,
    partner_r: null,
    partner_by: null,
    reversed: false,
    size_bytes: 1,
    check_status: 'ok' as const,
    problem: null,
    thresholded: false,
    analysis_keys: keys,
    assigned_by: null,
    label: null,
    map_type: 'z' as const,
    fits: {},
});

test('the submit step sums up what was uploaded and what is still open', () => {
    render(<SharePage api={api} initial={view({ uploads: [mapUpload('1', ['a']), mapUpload('2', [])] })} />);
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(summary).toHaveTextContent('1map assigned of 2 uploaded');
    expect(summary).toHaveTextContent('1analysis has maps out of 1 total analysis');
    // A line is yellow while something is open (a map is unassigned) and green once it is not.
    const line = (text: RegExp) => within(summary).getByText(text).parentElement as HTMLElement;
    expect(line(/map assigned of 2 uploaded/)).toHaveStyle({ color: 'rgb(138, 101, 0)' });
    expect(line(/analysis has maps out of/)).toHaveStyle({ color: 'rgb(46, 125, 50)' });
});

test('the summary is green on both lines once every map is assigned and every analysis has a map', () => {
    render(<SharePage api={api} initial={view({ uploads: [mapUpload('1', ['a'])] })} />);
    const summary = screen.getByRole('region', { name: 'Summary' });
    for (const text of [/map assigned of 1 uploaded/, /analysis has maps out of/]) {
        expect(within(summary).getByText(text).parentElement).toHaveStyle({ color: 'rgb(46, 125, 50)' });
    }
});

describe('the too-many-maps warning', () => {
    const upload = (id: string) => ({
        id,
        filename: `${id}.nii.gz`,
        path: null,
        kind: 'statistic' as const,
        map_type_by: 'name' as const,
        partner_id: null,
        partner_r: null,
        partner_by: null,
        reversed: false,
        size_bytes: 1,
        check_status: 'ok' as const,
        problem: null,
        thresholded: false,
        analysis_keys: [],
        assigned_by: null,
        label: null,
        map_type: 'z' as const,
        fits: {},
    });
    const warning = /more than we expect for this paper/;

    test('shows when there are more than three maps per analysis', () => {
        const uploads = ['1', '2', '3', '4'].map(upload);
        render(<SharePage api={api} initial={view({ uploads })} />);
        expect(screen.getByText(warning)).toBeInTheDocument();
        expect(screen.getByText(/does not impact the upload process/)).toBeInTheDocument();
    });

    test('stays away at exactly three maps per analysis', () => {
        const uploads = ['1', '2', '3'].map(upload);
        render(<SharePage api={api} initial={view({ uploads })} />);
        expect(screen.queryByText(warning)).not.toBeInTheDocument();
    });
});
