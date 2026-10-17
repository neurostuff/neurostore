import { act, fireEvent, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { coordinateBundle, FACES, HOUSES, INSULA, PRECUNEUS } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup(bundle = coordinateBundle()) {
    const view = renderWithStores(<ReviewScreen />, bundle, { now: () => 'now' });
    const pending = () => view.stores.session.getState().pending;
    return { ...view, pending };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));
const toolbar = () => screen.getByRole('toolbar', { name: 'coordinate actions' });
const form = () => screen.getByRole('group', { name: `edit analysis ${FACES.name}` });
const target = { kind: 'coordinate_analysis', analysis_key: FACES.key };

describe('Edit analysis', () => {
    it('opens one form for the name, the coordinate space and the role, from the toolbar', () => {
        setup();
        fireEvent.click(within(toolbar()).getByRole('button', { name: 'Edit analysis' }));
        expect(within(form()).getByRole('textbox', { name: 'name' })).toHaveValue(FACES.name);
        expect(within(form()).getByRole('combobox', { name: 'coordinate space' })).toHaveValue('MNI');
        expect(within(form()).getByRole('combobox', { name: 'role' })).toHaveValue('result');
    });

    it('opens from the edit icon on an analysis’s card, focusing that analysis', () => {
        const { stores } = setup();
        const card = screen.getByRole('article', { name: HOUSES.name });
        fireEvent.click(within(card).getByRole('button', { name: `edit analysis ${HOUSES.name}` }));
        expect(stores.view.getState().coordinates?.analysis).toBe(HOUSES.key);
        const opened = screen.getByRole('group', { name: `edit analysis ${HOUSES.name}` });
        expect(within(opened).getByRole('textbox', { name: 'name' })).toHaveValue(HOUSES.name);
    });

    it('opens from its key, which the help lists', () => {
        setup();
        press('n');
        expect(within(form()).getByRole('textbox', { name: 'name' })).toHaveFocus();
        press('Escape');
        press('?', { shiftKey: true });
        const rows = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).getAllByRole('row');
        expect(
            rows.map((row) => [row.firstElementChild?.textContent, row.lastElementChild?.textContent])
        ).toContainEqual(['n', 'coordinates']);
    });

    it('sends the name and space as edit_points with the points kept, and the role as relabel, in one batch', () => {
        const { pending, stores } = setup();
        press('n');
        fireEvent.change(within(form()).getByRole('textbox', { name: 'name' }), {
            target: { value: 'Faces > Places' },
        });
        fireEvent.change(within(form()).getByRole('combobox', { name: 'coordinate space' }), {
            target: { value: 'TAL' },
        });
        fireEvent.change(within(form()).getByRole('combobox', { name: 'role' }), { target: { value: 'anchor' } });
        press('Enter');
        expect(pending()).toEqual([
            expect.objectContaining({ type: 'set_value', target: { kind: 'slot', entity: 'ana_faces', path: 'name' } }),
            expect.objectContaining({ type: 'coordinate', action: 'relabel', role: 'anchor', target }),
            expect.objectContaining({
                type: 'coordinate',
                action: 'edit_points',
                target,
                payload: { points: [PRECUNEUS, INSULA], name: 'Faces > Places', coordinate_space: 'TAL' },
            }),
        ]);
        expect(coordinateOpErrors(pending())).toEqual([]);
        expect(new Set(pending().map((op) => stores.session.getState().groupOf[op.client_op_id])).size).toBe(1);
        expect(screen.queryByRole('group', { name: `edit analysis ${FACES.name}` })).not.toBeInTheDocument();
    });

    it('sends only what changed, and nothing when nothing did', () => {
        const { pending } = setup();
        press('n');
        press('Enter');
        expect(pending()).toEqual([]);
        press('n');
        fireEvent.change(within(form()).getByRole('combobox', { name: 'role' }), { target: { value: 'anchor' } });
        press('Enter');
        expect(pending()).toEqual([expect.objectContaining({ action: 'relabel', role: 'anchor' })]);
    });

    it('refuses an empty name', () => {
        const { pending } = setup();
        press('n');
        fireEvent.change(within(form()).getByRole('textbox', { name: 'name' }), { target: { value: ' ' } });
        press('Enter');
        expect(within(form()).getByRole('textbox', { name: 'name' })).toHaveAccessibleDescription('required');
        expect(pending()).toEqual([]);
    });

    it('calls the role action Change role', () => {
        setup();
        expect(within(toolbar()).getByRole('button', { name: 'Change role' })).toBeInTheDocument();
        expect(within(toolbar()).queryByRole('button', { name: 'Relabel' })).not.toBeInTheDocument();
    });
});

describe('the analysis name, click to edit', () => {
    it.each([
        ['card', () => screen.getByRole('article', { name: FACES.name })],
        ['inspector', () => screen.getByRole('region', { name: FACES.name })],
    ])('renames from the %s: a click opens the name, Enter sends it as edit_points', (_, where) => {
        const { pending } = setup();
        const name = within(where()).getByRole('button', { name: `rename ${FACES.name}` });
        fireEvent.click(name);
        const field = within(where()).getByRole('textbox', { name: 'analysis name' });
        expect(field).toHaveFocus();
        fireEvent.change(field, { target: { value: 'Faces > Places' } });
        press('Enter', {}, field);
        expect(pending()).toEqual([
            expect.objectContaining({ type: 'set_value' }),
            expect.objectContaining({
                action: 'edit_points',
                target,
                payload: { points: [PRECUNEUS, INSULA], name: 'Faces > Places' },
            }),
        ]);
    });

    it('refuses an empty name, saying it is required', () => {
        const { pending } = setup();
        const card = screen.getByRole('article', { name: FACES.name });
        fireEvent.click(within(card).getByRole('button', { name: `rename ${FACES.name}` }));
        const field = within(card).getByRole('textbox', { name: 'analysis name' });
        fireEvent.change(field, { target: { value: ' ' } });
        press('Enter', {}, field);
        expect(pending()).toEqual([]);
        expect(within(card).getByRole('textbox', { name: 'analysis name' })).toHaveAccessibleDescription('required');
    });

    it('Esc leaves the name as it was', () => {
        const { pending } = setup();
        const card = screen.getByRole('article', { name: FACES.name });
        fireEvent.click(within(card).getByRole('button', { name: `rename ${FACES.name}` }));
        const field = within(card).getByRole('textbox', { name: 'analysis name' });
        fireEvent.change(field, { target: { value: 'Other' } });
        press('Escape', {}, field);
        expect(pending()).toEqual([]);
        expect(within(card).queryByRole('textbox', { name: 'analysis name' })).not.toBeInTheDocument();
    });
});
