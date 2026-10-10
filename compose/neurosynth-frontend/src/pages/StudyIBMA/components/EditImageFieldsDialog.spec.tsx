import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import EditImageFieldsDialog, {
    IMAGE_SPACE_OPTIONS,
    IMAGE_VALUE_TYPE_OPTIONS,
    imageValueTypeLabel,
} from 'pages/StudyIBMA/components/EditImageFieldsDialog';
import { vi } from 'vitest';

vi.mock('components/Dialogs/BaseDialog');

const image = (overrides: Partial<ImageReturn> = {}): ImageReturn => ({
    id: 'img-1',
    filename: 'map.nii.gz',
    url: 'https://example.com/map.nii.gz',
    space: 'MNI',
    value_type: 'Z map',
    ...overrides,
});

describe('imageValueTypeLabel', () => {
    it('returns an empty string for missing values', () => {
        expect(imageValueTypeLabel(null)).toBe('');
        expect(imageValueTypeLabel(undefined)).toBe('');
        expect(imageValueTypeLabel('')).toBe('');
    });

    it('maps stored codes and existing labels', () => {
        expect(imageValueTypeLabel('Z')).toBe('Z map');
        expect(imageValueTypeLabel('T map')).toBe('T map');
    });

    it('returns an empty string for an unknown value', () => {
        expect(imageValueTypeLabel('not-a-map')).toBe('');
    });
});

describe('EditImageFieldsDialog', () => {
    it('renders nothing when closed', () => {
        render(<EditImageFieldsDialog image={image()} isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />);
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('renders title and image fields when open', () => {
        render(<EditImageFieldsDialog image={image()} isOpen onClose={vi.fn()} onSave={vi.fn()} />);
        expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Edit image');
        expect(screen.getByRole('textbox', { name: 'filename' })).toHaveValue('map.nii.gz');
        expect(screen.getByRole('textbox', { name: 'url' })).toHaveValue('https://example.com/map.nii.gz');
        expect(screen.getByRole('combobox', { name: 'space' })).toHaveTextContent('MNI');
        expect(screen.getByRole('combobox', { name: 'value_type' })).toHaveTextContent('Z map');
    });

    it('maps a stored value_type code to its label', () => {
        render(
            <EditImageFieldsDialog
                image={image({ value_type: 'T', space: 'unknown' })}
                isOpen
                onClose={vi.fn()}
                onSave={vi.fn()}
            />
        );
        expect(screen.getByRole('combobox', { name: 'value_type' })).toHaveTextContent('T map');
        expect(screen.getByRole('combobox', { name: 'space' }).textContent?.replace(/\u200b/g, '').trim()).toBe('');
    });

    it('lists the stored space and value_type options', async () => {
        render(<EditImageFieldsDialog image={image()} isOpen onClose={vi.fn()} onSave={vi.fn()} />);

        await userEvent.click(screen.getByRole('combobox', { name: 'space' }));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([...IMAGE_SPACE_OPTIONS]);
        await userEvent.keyboard('{Escape}');

        await userEvent.click(screen.getByRole('combobox', { name: 'value_type' }));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([...IMAGE_VALUE_TYPE_OPTIONS]);
    });

    it('saves edited fields and closes', async () => {
        const onClose = vi.fn();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EditImageFieldsDialog image={image()} isOpen onClose={onClose} onSave={onSave} />);

        await userEvent.clear(screen.getByRole('textbox', { name: 'filename' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'filename' }), 'renamed.nii.gz');
        await userEvent.click(screen.getByRole('combobox', { name: 'space' }));
        await userEvent.click(screen.getByRole('option', { name: 'TAL' }));
        await userEvent.click(screen.getByRole('combobox', { name: 'value_type' }));
        await userEvent.click(screen.getByRole('option', { name: 'T map' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith({
            filename: 'renamed.nii.gz',
            url: 'https://example.com/map.nii.gz',
            space: 'TAL',
            value_type: 'T map',
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('saves blank fields as null', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(
            <EditImageFieldsDialog
                image={image({ filename: '  ', url: '', space: null, value_type: null })}
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledWith({
            filename: null,
            url: null,
            space: null,
            value_type: null,
        });
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = vi.fn();
        const onSave = vi.fn();
        render(<EditImageFieldsDialog image={image()} isOpen onClose={onClose} onSave={onSave} />);

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onSave).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('disables Save when onSave is not provided', () => {
        render(<EditImageFieldsDialog image={image()} isOpen onClose={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('shows a loading state and ignores Save while isLoading is true', async () => {
        const onSave = vi.fn();
        render(<EditImageFieldsDialog image={image()} isOpen isLoading onClose={vi.fn()} onSave={onSave} />);

        const saveButton = screen.getByRole('progressbar').closest('button');
        expect(saveButton).toBeTruthy();
        await userEvent.click(saveButton as HTMLElement);
        expect(onSave).not.toHaveBeenCalled();
    });

    it('keeps the dialog open when save fails', async () => {
        const onClose = vi.fn();
        const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<EditImageFieldsDialog image={image()} isOpen onClose={onClose} onSave={onSave} />);

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
        errorSpy.mockRestore();
    });
});
