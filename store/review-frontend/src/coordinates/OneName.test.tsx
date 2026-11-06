import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ReviewScreen } from '../review/ReviewScreen';
import { coordinateBundle, FACES, INSULA, PRECUNEUS } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';
import { answerPending, withoutIds } from '../test/undoHelpers';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    const session = () => view.stores.session.getState();
    const viewState = () => view.stores.view.getState();
    return { ...view, session, viewState, pending: () => session().pending };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));
const card = () => screen.getByRole('article', { name: FACES.name });
const coordinateTarget = { kind: 'coordinate_analysis', analysis_key: FACES.key };
const nameTarget = { kind: 'slot', entity: 'ana_faces', path: 'name' };

const RENAMED: Op[] = [
    expect.objectContaining({
        type: 'set_value',
        target: nameTarget,
        value: expect.objectContaining({ extraction_status: 'extracted', value: 'Faces > Places' }),
    }),
    expect.objectContaining({
        type: 'coordinate',
        action: 'edit_points',
        target: coordinateTarget,
        payload: { points: [PRECUNEUS, INSULA], name: 'Faces > Places' },
    }),
];

function oneIntent(view: ReturnType<typeof setup>) {
    const { pending, groupOf, undoStack } = view.session();
    expect(new Set(pending.map((op) => groupOf[op.client_op_id])).size).toBe(1);
    expect(undoStack).toHaveLength(1);
}

describe('a coordinate analysis and the record Analysis that names it', () => {
    it('the coordinate card names the record Analysis, and its link opens it', () => {
        const { viewState } = setup();
        const described = within(card()).getByRole('button', { name: 'open the record’s Faces > Houses' });
        fireEvent.click(described);
        expect(viewState().focus.entity).toBe('ana_faces');
        expect(viewState().coordinates).toBeNull();
    });

    it('the Analysis card shows its coordinate analysis, and its link goes back to it', () => {
        const { viewState } = setup();
        act(() => viewState().setStep('analyses'));
        act(() => viewState().focusEntity('ana_faces'));
        const back = screen.getByRole('button', { name: `open the coordinates of ${FACES.name}` });
        expect(back).toHaveTextContent('2 points');
        fireEvent.click(back);
        expect(viewState().step).toBe('coordinates');
        expect(viewState().coordinates?.analysis).toBe(FACES.key);
    });
});

describe('one name for one analysis', () => {
    it('renaming the coordinate analysis renames its record Analysis too, in one intent', () => {
        const view = setup();
        fireEvent.click(within(card()).getByRole('button', { name: `rename ${FACES.name}` }));
        const field = within(card()).getByRole('textbox', { name: 'analysis name' });
        fireEvent.change(field, { target: { value: 'Faces > Places' } });
        press('Enter', {}, field);
        expect(view.pending()).toEqual(RENAMED);
        expect(coordinateOpErrors(view.pending())).toEqual([]);
        oneIntent(view);
    });

    it('the record Analysis’s name keeps the value source its editor gives it', () => {
        const view = setup();
        act(() => view.viewState().setStep('analyses'));
        act(() => view.viewState().focusSlot('slot:ana_faces:name'));
        press('Enter', {}, document.body);
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Faces > Places' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'The value is' }), { target: { value: 'generated' } });
        press('Enter');
        expect(view.pending()[0]).toMatchObject({
            type: 'set_value',
            target: nameTarget,
            value: { value: 'Faces > Places', value_source: 'generated' },
        });
        oneIntent(view);
    });

    it('the Edit analysis form renames both too', () => {
        const view = setup();
        press('n');
        const form = screen.getByRole('group', { name: `edit analysis ${FACES.name}` });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Faces > Places' } });
        press('Enter');
        expect(view.pending()).toEqual(RENAMED);
        oneIntent(view);
    });

    it('renaming the record Analysis renames its coordinate analysis too, in one intent', () => {
        const view = setup();
        act(() => view.viewState().setStep('analyses'));
        act(() => view.viewState().focusSlot('slot:ana_faces:name'));
        press('Enter', {}, document.body);
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Faces > Places' } });
        press('Enter');
        expect(view.pending()).toEqual(RENAMED);
        oneIntent(view);
    });

    const restoreName = { type: 'set_value', target: nameTarget, value: { extraction_status: 'extracted' } };
    const restoreCoordinates = {
        type: 'coordinate',
        target: { kind: 'coordinate_parse' },
        action: 'restore',
        payload: { remove: [], insert: [], reasons: {}, record: { remove: [], insert: [] } },
    };
    function undoesBoth(view: ReturnType<typeof setup>) {
        act(
            () =>
                void answerPending(
                    view.stores,
                    (op) => [op.type === 'set_value' ? restoreName : restoreCoordinates] as never
                )
        );
        act(() => view.session().undo());
        expect(withoutIds(view.pending())).toEqual([restoreCoordinates, restoreName]);
        expect(new Set(view.pending().map((op) => view.session().groupOf[op.client_op_id])).size).toBe(1);
    }

    it('one undo restores both names', () => {
        const view = setup();
        press('n');
        const form = screen.getByRole('group', { name: `edit analysis ${FACES.name}` });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Faces > Places' } });
        press('Enter');
        undoesBoth(view);
    });

    it('one undo restores both names renamed from the record Analysis', () => {
        const view = setup();
        act(() => view.viewState().setStep('analyses'));
        act(() => view.viewState().focusSlot('slot:ana_faces:name'));
        press('Enter', {}, document.body);
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Faces > Places' } });
        press('Enter');
        undoesBoth(view);
    });

    it('an analysis no record Analysis names is renamed alone', () => {
        const view = setup();
        act(() => view.viewState().focusAnalysis('analysis#00000000000000c3'));
        press('n');
        const form = screen.getByRole('group', { name: 'edit analysis Precuneus localizer' });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Localizer' } });
        press('Enter');
        expect(view.pending()).toEqual([expect.objectContaining({ action: 'edit_points' })]);
    });
});
