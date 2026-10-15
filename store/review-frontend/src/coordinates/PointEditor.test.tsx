import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { theme } from '../theme';
import { PointEditor } from './PointEditor';

const POINT = {
    coordinates: [-12, -11, 46],
    values: [{ kind: 't', value: 2.28, correction: 'fwe' }],
    cluster_size: 59,
    cluster_measure: 'voxels',
    row: 3,
    column_group: 0,
};

function setup(point: Record<string, unknown> | null = POINT) {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
        <ThemeProvider theme={theme}>
            <PointEditor label="point 1" point={point} onSave={onSave} onCancel={onCancel} />
        </ThemeProvider>
    );
    const editor = screen.getByRole('group', { name: 'edit point 1' });
    const press = (key: string, target: Element = document.activeElement ?? editor) =>
        fireEvent.keyDown(target, { key });
    const change = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
    return { onSave, onCancel, editor, press, change };
}

describe('PointEditor', () => {
    it('edits the coordinates as x, y and z, focusing x', () => {
        setup();
        expect(screen.getByRole('spinbutton', { name: 'x' })).toHaveValue(-12);
        expect(screen.getByRole('spinbutton', { name: 'x' })).toHaveFocus();
        expect(screen.getByRole('spinbutton', { name: 'y' })).toHaveValue(-11);
        expect(screen.getByRole('spinbutton', { name: 'z' })).toHaveValue(46);
    });

    it('gives each attribute the editor its schema calls for', () => {
        setup();
        expect(screen.getByRole('spinbutton', { name: 'cluster size' })).toHaveValue(59);
        expect(screen.getByRole('combobox', { name: 'cluster measure' })).toHaveValue('voxels');
        expect(screen.getByRole('combobox', { name: 'space' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'label' })).toHaveValue('');
        expect(screen.getByRole('switch', { name: 'is subpeak' })).not.toBeChecked();
        const values = screen.getByRole('list', { name: 'values' });
        expect(within(values).getByRole('combobox', { name: 'kind 1' })).toHaveValue('t');
        expect(within(values).getByRole('spinbutton', { name: 'value 1' })).toHaveValue(2.28);
    });

    it('saves the whole point on Enter, keeping where it was read from and what it does not edit', () => {
        const { onSave, press, change } = setup();
        change(screen.getByRole('spinbutton', { name: 'z' }), '48');
        change(screen.getByRole('textbox', { name: 'label' }), 'Precuneus');
        change(screen.getByRole('spinbutton', { name: 'value 1' }), '3.1');
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({
            coordinates: [-12, -11, 48],
            values: [{ kind: 't', value: 3.1, correction: 'fwe' }],
            cluster_size: 59,
            cluster_measure: 'voxels',
            label: 'Precuneus',
            row: 3,
            column_group: 0,
        });
    });

    it('drops an optional attribute that is cleared', () => {
        const { onSave, press, change } = setup();
        change(screen.getByRole('spinbutton', { name: 'cluster size' }), '');
        change(screen.getByRole('combobox', { name: 'cluster measure' }), '');
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({
            coordinates: [-12, -11, 46],
            values: [{ kind: 't', value: 2.28, correction: 'fwe' }],
            row: 3,
            column_group: 0,
        });
    });

    it('refuses a missing coordinate and a value out of the schema’s range, saying why', () => {
        const { onSave, press, change } = setup();
        change(screen.getByRole('spinbutton', { name: 'y' }), '');
        change(screen.getByRole('spinbutton', { name: 'cluster size' }), '-1');
        press('Enter');
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByRole('spinbutton', { name: 'y' })).toHaveAccessibleDescription('required');
        expect(screen.getByRole('spinbutton', { name: 'cluster size' })).toHaveAccessibleDescription(
            'must be at least 0'
        );
    });

    it('adds and removes values, each needing a kind and a value', () => {
        const { onSave, press, change } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'add values' }));
        const values = screen.getByRole('list', { name: 'values' });
        change(within(values).getByRole('combobox', { name: 'kind 2' }), 'p');
        press('Enter');
        expect(onSave).not.toHaveBeenCalled();
        expect(within(values).getByRole('spinbutton', { name: 'value 2' })).toHaveAccessibleDescription('required');
        change(within(values).getByRole('spinbutton', { name: 'value 2' }), '0.001');
        fireEvent.click(within(values).getByRole('button', { name: 'remove values 1' }));
        press('Enter', screen.getByRole('spinbutton', { name: 'x' }));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ values: [{ kind: 'p', value: 0.001 }] }));
    });

    it('starts a new point empty', () => {
        const { onSave, press, change } = setup(null);
        expect(screen.getByRole('spinbutton', { name: 'x' })).toHaveValue(null);
        change(screen.getByRole('spinbutton', { name: 'x' }), '1');
        change(screen.getByRole('spinbutton', { name: 'y' }), '2');
        change(screen.getByRole('spinbutton', { name: 'z' }), '3');
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({ coordinates: [1, 2, 3] });
    });

    it('cancels on Esc', () => {
        const { onSave, onCancel, press } = setup();
        press('Escape');
        expect(onCancel).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
    });
});
