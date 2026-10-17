import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import coordinateSchema from '../test/golden/schemas/coordinate-parse.schema.json';
import extractionSchema from '../test/golden/schemas/extraction-record.schema.json';
import type { ExtractedValue } from '../model/record';
import { theme } from '../theme';
import type { Schema } from '../model/schema';
import { SlotEditor, type SlotEditorProps } from './SlotEditor';

const wrapper = (value: Schema): Schema => ({
    properties: {
        extraction_status: { enum: ['extracted', 'not_reported'] },
        unreported_reason: { anyOf: [{ enum: ['ambiguous', 'outside_text'] }, { type: 'null' }] },
        value_source: { anyOf: [{ enum: ['reported', 'generated'] }, { type: 'null' }] },
        value,
    },
});

const extracted = (value: unknown): ExtractedValue => ({
    extraction_status: 'extracted',
    value,
    value_source: 'reported',
    evidence: { status: 'not_found' },
});

function setup(value: Schema, current: ExtractedValue | undefined, props: Partial<SlotEditorProps> = {}) {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
        <ThemeProvider theme={theme}>
            <SlotEditor
                label="slot"
                schema={wrapper(value)}
                value={current}
                mode="edit"
                onSave={onSave}
                onCancel={onCancel}
                {...props}
            />
        </ThemeProvider>
    );
    const editor = screen.getByRole('group', { name: 'edit slot' });
    const press = (key: string, target: Element = document.activeElement ?? editor) =>
        fireEvent.keyDown(target, { key });
    return { onSave, onCancel, editor, press };
}

describe('SlotEditor', () => {
    it('edits a string in a text field and saves it on Enter', () => {
        const { onSave, press } = setup({ type: ['string', 'null'] }, extracted('Patients'));
        const field = screen.getByRole('textbox', { name: 'slot' });
        expect(field).toHaveValue('Patients');
        expect(field).toHaveFocus();
        fireEvent.change(field, { target: { value: 'Cases' } });
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({
            extraction_status: 'extracted',
            value: 'Cases',
            value_source: 'reported',
        });
    });

    it('edits a number in a numeric field with the schema’s bounds, and refuses one outside them', () => {
        const { onSave, press } = setup({ type: ['integer', 'null'], minimum: 0, maximum: 500 }, extracted(20));
        const field = screen.getByRole('spinbutton', { name: 'slot' });
        expect(field).toHaveAttribute('min', '0');
        expect(field).toHaveAttribute('max', '500');
        expect(field).toHaveAttribute('step', '1');
        fireEvent.change(field, { target: { value: '-1' } });
        press('Enter');
        expect(onSave).not.toHaveBeenCalled();
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAccessibleDescription('must be at least 0');
        fireEvent.change(field, { target: { value: '2.5' } });
        press('Enter');
        expect(field).toHaveAccessibleDescription('must be a whole number');
        fireEvent.change(field, { target: { value: '18' } });
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({ extraction_status: 'extracted', value: 18, value_source: 'reported' });
    });

    it('edits a boolean with a switch', () => {
        const { onSave, press } = setup({ type: ['boolean', 'null'] }, extracted(false));
        const toggle = screen.getByRole('switch', { name: 'slot' });
        expect(toggle).not.toBeChecked();
        fireEvent.click(toggle);
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({ extraction_status: 'extracted', value: true, value_source: 'reported' });
    });

    it('edits a closed enum with a select of its values', () => {
        const { onSave, press } = setup({ anyOf: [{ enum: ['left', 'right'] }, { type: 'null' }] }, extracted('left'));
        const select = screen.getByRole('combobox', { name: 'slot' });
        expect(
            within(select)
                .getAllByRole('option')
                .map((o) => o.textContent)
        ).toEqual(['left', 'right']);
        fireEvent.change(select, { target: { value: 'right' } });
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({
            extraction_status: 'extracted',
            value: 'right',
            value_source: 'reported',
        });
    });

    it('edits an open enum as text, suggesting the schema’s values', () => {
        const { onSave, press } = setup(
            { anyOf: [{ enum: ['human', 'rat'] }, { type: 'string' }, { type: 'null' }] },
            extracted('human')
        );
        const field = screen.getByRole('combobox', { name: 'slot' });
        const list = document.getElementById(field.getAttribute('list') ?? '');
        expect([...(list?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual(['human', 'rat']);
        fireEvent.change(field, { target: { value: 'zebrafish' } });
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({
            extraction_status: 'extracted',
            value: 'zebrafish',
            value_source: 'reported',
        });
    });

    it('edits a list of primitives as chips, adding on Enter and removing with a button', () => {
        const { onSave, press } = setup({ type: ['array', 'null'], items: { type: 'integer' } }, extracted([1, 2]));
        fireEvent.click(screen.getByRole('button', { name: 'remove 1' }));
        const add = screen.getByRole('textbox', { name: 'add to slot' });
        fireEvent.change(add, { target: { value: '1.5' } });
        press('Enter', add);
        expect(add).toHaveAccessibleDescription('must be a whole number');
        fireEvent.change(add, { target: { value: '7' } });
        press('Enter', add);
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'remove 7' })).toBeInTheDocument();
        expect(add).toHaveValue('');
        press('Enter', add);
        expect(onSave).toHaveBeenCalledWith({
            extraction_status: 'extracted',
            value: [2, 7],
            value_source: 'reported',
        });
    });

    it('gives a text field the schema’s length bounds', () => {
        setup({ type: 'string', minLength: 2, maxLength: 5 }, extracted('abc'));
        const field = screen.getByRole('textbox', { name: 'slot' });
        expect(field).toHaveAttribute('minlength', '2');
        expect(field).toHaveAttribute('maxlength', '5');
    });

    it('describes an empty closed enum on its select', () => {
        const { press } = setup(
            { enum: ['MRI', 'EEG'] },
            { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } }
        );
        fireEvent.change(screen.getByRole('combobox', { name: 'extraction status' }), {
            target: { value: 'extracted' },
        });
        const select = screen.getByRole('combobox', { name: 'slot' });
        press('Enter', select);
        expect(select).toHaveAccessibleDescription('enter a value, or set the status to not reported');
    });

    it('Enter on the Cancel button cancels, and saves nothing', async () => {
        const user = userEvent.setup();
        const { onSave, onCancel } = setup({ type: 'string' }, extracted('a'));
        fireEvent.change(screen.getByRole('textbox', { name: 'slot' }), { target: { value: 'b' } });
        screen.getByRole('button', { name: 'Cancel' }).focus();
        await user.keyboard('{Enter}');
        expect(onCancel).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('cancels on Esc without saving', () => {
        const { onSave, onCancel, press } = setup({ type: 'string' }, extracted('a'));
        fireEvent.change(screen.getByRole('textbox', { name: 'slot' }), { target: { value: 'b' } });
        press('Escape');
        expect(onCancel).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('saves a value without a value source when the slot has none', () => {
        const { onSave, press } = setup(
            { type: 'string' },
            { extraction_status: 'extracted', value: 'a', evidence: { status: 'not_found' } }
        );
        press('Enter', screen.getByRole('textbox', { name: 'slot' }));
        expect(onSave).toHaveBeenCalledWith({ extraction_status: 'extracted', value: 'a' });
    });

    it('keeps the value source a slot has when its value is edited', () => {
        const { onSave, press } = setup({ type: 'string' }, { ...extracted('a'), value_source: 'generated' });
        press('Enter', screen.getByRole('textbox', { name: 'slot' }));
        expect(onSave).toHaveBeenCalledWith({ extraction_status: 'extracted', value: 'a', value_source: 'generated' });
    });

    it('sets the value source from the schema’s values', () => {
        const { onSave, press } = setup({ type: 'string' }, extracted('a'));
        const source = screen.getByRole('combobox', { name: 'value source' });
        expect(
            within(source)
                .getAllByRole('option')
                .map((o) => o.textContent)
        ).toEqual(['reported', 'generated']);
        fireEvent.change(source, { target: { value: 'generated' } });
        press('Enter', screen.getByRole('textbox', { name: 'slot' }));
        expect(onSave).toHaveBeenCalledWith({ extraction_status: 'extracted', value: 'a', value_source: 'generated' });
    });

    it('marks the slot not reported with a reason from the schema, focusing the reason', () => {
        const { onSave, press } = setup({ type: 'string' }, extracted('a'), { mode: 'not_reported' });
        expect(screen.getByRole('combobox', { name: 'extraction status' })).toHaveValue('not_reported');
        expect(screen.queryByRole('textbox', { name: 'slot' })).not.toBeInTheDocument();
        const reason = screen.getByRole('combobox', { name: 'unreported reason' });
        expect(reason).toHaveFocus();
        expect(
            within(reason)
                .getAllByRole('option')
                .map((o) => o.textContent)
        ).toEqual(['none', 'ambiguous', 'outside_text']);
        fireEvent.change(reason, { target: { value: 'outside_text' } });
        press('Enter');
        expect(onSave).toHaveBeenCalledWith({ extraction_status: 'not_reported', unreported_reason: 'outside_text' });
    });

    it('switches a not reported slot to extracted, refusing it until a value is typed', () => {
        const { onSave, press } = setup(
            { type: 'string' },
            { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } }
        );
        fireEvent.change(screen.getByRole('combobox', { name: 'extraction status' }), {
            target: { value: 'extracted' },
        });
        const field = screen.getByRole('textbox', { name: 'slot' });
        press('Enter', field);
        expect(onSave).not.toHaveBeenCalled();
        expect(field).toHaveAccessibleDescription('enter a value, or set the status to not reported');
    });

    it('falls back to an editor of the value’s own type when the schema allows any value', () => {
        setup({}, extracted(3));
        expect(screen.getByRole('spinbutton', { name: 'slot' })).toHaveValue(3);
    });

    it.each(['inspector', 'coordinates'])('names no schema class in the %s code', (dir) => {
        const classes = [extractionSchema, coordinateSchema]
            .flatMap((schema) => Object.keys((schema as Schema).$defs as Schema))
            .filter((name) => name !== 'ExtractedValue');
        const at = path.join(__dirname, '..', dir);
        const sources = readdirSync(at).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
        expect(sources.length).toBeGreaterThan(2);
        for (const file of sources) {
            const source = readFileSync(path.join(at, file), 'utf8');
            expect(
                classes.filter((name) => new RegExp(`\\b${name}\\b`).test(source)),
                file
            ).toEqual([]);
        }
    });
});
