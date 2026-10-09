import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import BrainMapDetailPanel, {
    filterKeyValueRowsByFieldQuery,
    type KeyValueRow,
} from 'pages/StudyIBMA/components/BrainMapDetailPanel';
import { IMAGE_SPACE_OPTIONS, IMAGE_VALUE_TYPE_OPTIONS } from 'pages/StudyIBMA/components/EditImageFieldsDialog';
import { vi } from 'vitest';

vi.mock('hooks/metaAnalyses/useGetNeurovaultImages', () => ({
    default: () => ({ data: [], isLoading: false }),
}));
vi.mock('components/Dialogs/BaseDialog');

const rows: KeyValueRow[] = [
    { key: 'filename', value: 'map.nii.gz' },
    { key: 'value_type', value: 'Z' },
    { key: 'map_type', value: 'T' },
    { key: 'modality', value: 'fMRI' },
];

describe('filterKeyValueRowsByFieldQuery', () => {
    it('returns all rows when the query is empty or whitespace', () => {
        expect(filterKeyValueRowsByFieldQuery(rows, '')).toHaveLength(4);
        expect(filterKeyValueRowsByFieldQuery(rows, '   ')).toHaveLength(4);
    });

    it('filters rows by field key case-insensitively', () => {
        const filtered = filterKeyValueRowsByFieldQuery(rows, 'type');
        expect(filtered.map((row) => row.key)).toEqual(['value_type', 'map_type']);
    });

    it('filters rows by value case-insensitively', () => {
        const filtered = filterKeyValueRowsByFieldQuery(rows, 'fmri');
        expect(filtered.map((row) => row.key)).toEqual(['modality']);
    });

    it('matches when either the field key or value contains the query', () => {
        const filtered = filterKeyValueRowsByFieldQuery(rows, 'map');
        expect(filtered.map((row) => row.key)).toEqual(['filename', 'map_type']);
    });

    it('returns no rows when nothing matches', () => {
        expect(filterKeyValueRowsByFieldQuery(rows, 'nonexistent')).toEqual([]);
    });
});

const image = (overrides: Partial<ImageReturn> = {}): ImageReturn => ({
    id: 'img-1',
    filename: 'map.nii.gz',
    url: 'https://example.com/map.nii.gz',
    space: 'MNI',
    value_type: 'Z map',
    public: true,
    created_at: '',
    updated_at: null,
    user: null,
    username: null,
    metadata: null,
    add_date: null,
    entities: undefined,
    analysis_name: null,
    analysis: 'analysis-1',
    ...overrides,
});

describe('BrainMapDetailPanel image editor', () => {
    it('opens an edit dialog from the Image title', async () => {
        render(<BrainMapDetailPanel image={image()} onClose={vi.fn()} onEditImage={vi.fn()} />);

        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Edit image' }));

        expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Edit image');
        expect(screen.getByRole('textbox', { name: 'filename' })).toHaveValue('map.nii.gz');
        expect(screen.getByRole('textbox', { name: 'url' })).toHaveValue('https://example.com/map.nii.gz');
        expect(screen.getByRole('combobox', { name: 'space' })).toHaveTextContent('MNI');
        expect(screen.getByRole('combobox', { name: 'value_type' })).toHaveTextContent('Z map');
    });

    it('limits value_type to the stored map type options', async () => {
        render(<BrainMapDetailPanel image={image()} onClose={vi.fn()} onEditImage={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Edit image' }));
        await userEvent.click(screen.getByRole('combobox', { name: 'value_type' }));

        const options = screen.getAllByRole('option').map((option) => option.textContent);
        expect(options).toEqual([...IMAGE_VALUE_TYPE_OPTIONS]);
    });

    it('saves edited filename, url, space, and value_type', async () => {
        const onEditImage = vi.fn();
        render(<BrainMapDetailPanel image={image()} onClose={vi.fn()} onEditImage={onEditImage} />);
        await userEvent.click(screen.getByRole('button', { name: 'Edit image' }));

        await userEvent.clear(screen.getByRole('textbox', { name: 'filename' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'filename' }), 'renamed.nii.gz');
        await userEvent.click(screen.getByRole('combobox', { name: 'space' }));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([...IMAGE_SPACE_OPTIONS]);
        await userEvent.click(screen.getByRole('option', { name: 'TAL' }));
        await userEvent.click(screen.getByRole('combobox', { name: 'value_type' }));
        await userEvent.click(screen.getByRole('option', { name: 'T map' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onEditImage).toHaveBeenCalledWith({
            filename: 'renamed.nii.gz',
            url: 'https://example.com/map.nii.gz',
            space: 'TAL',
            value_type: 'T map',
        });
    });

    it('shows a loading state on Save while the update is in progress', async () => {
        let resolveSave: () => void = () => {};
        const onEditImage = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSave = resolve;
                })
        );
        render(<BrainMapDetailPanel image={image()} onClose={vi.fn()} onEditImage={onEditImage} />);
        await userEvent.click(screen.getByRole('button', { name: 'Edit image' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        resolveSave();
        await waitFor(() => expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument());
    });
});
