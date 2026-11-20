import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { UploadedFolders } from './UploadedFolders';
import type { ShareUpload, ShareView } from './types';

const upload = (id: string, path: string | null, over: Partial<ShareUpload> = {}): ShareUpload => ({
    id,
    filename: `${id}.nii.gz`,
    path,
    kind: 'statistic',
    map_type_by: 'name',
    partner_id: null,
    partner_r: null,
    partner_by: null,
    reversed: false,
    size_bytes: 2048,
    check_status: 'ok',
    problem: null,
    thresholded: false,
    analysis_keys: [],
    assigned_by: null,
    label: null,
    map_type: 'z',
    fits: {},
    ...over,
});

const view = (uploads: ShareUpload[]): ShareView =>
    ({
        uploads,
        limits: { max_files: 100, max_file_bytes: 1, extensions: ['.nii.gz'], map_types: [] },
    }) as unknown as ShareView;

test('each folder has a header with its count, and its files beneath', () => {
    render(
        <UploadedFolders
            view={view([
                upload('1', 'study1/a.nii.gz'),
                upload('2', 'study1/b.nii.gz'),
                upload('3', 'study2/c.nii.gz'),
            ])}
            disabled={false}
            onRemove={vi.fn()}
        />
    );
    expect(screen.getByRole('heading', { name: 'study1' })).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'study2' })).toBeInTheDocument();
    expect(screen.getByText(/^a\.nii\.gz/)).toBeInTheDocument();
});

test('loose files sit under "Individual files"', () => {
    render(<UploadedFolders view={view([upload('1', null)])} disabled={false} onRemove={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Individual files' })).toBeInTheDocument();
});

test('a folder is removed with all its files, one file by itself', async () => {
    const onRemove = vi.fn();
    render(
        <UploadedFolders
            view={view([upload('1', 'study1/a.nii.gz'), upload('2', 'study1/b.nii.gz')])}
            disabled={false}
            onRemove={onRemove}
        />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove study1/b.nii.gz' }));
    expect(onRemove).toHaveBeenLastCalledWith(['2']);
    await userEvent.click(screen.getByRole('button', { name: 'Remove study1' }));
    expect(onRemove).toHaveBeenLastCalledWith(['1', '2']);
});

test('a file that could not be read says why', () => {
    const bad = upload('1', 'f/a.nii.gz', { check_status: 'problem', problem: 'This is not a readable NIfTI file.' });
    render(<UploadedFolders view={view([bad])} disabled={false} onRemove={vi.fn()} />);
    expect(screen.getByText('1 file · 1 could not be read')).toBeInTheDocument();
    expect(screen.getByText(/This is not a readable NIfTI file/)).toBeInTheDocument();
});
