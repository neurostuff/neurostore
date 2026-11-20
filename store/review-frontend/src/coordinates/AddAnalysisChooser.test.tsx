import { act, fireEvent, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { ev, row } from '../test/bundles';
import {
    COORD_TEXT,
    coordinateBundle,
    coordinateResult,
    ENTITIES,
    FACES,
    HOUSES,
    key,
    LOCALIZER,
    RECORD,
    SCRAMBLED,
} from '../test/coordinates';
import { newPointsGrid } from '../test/grid';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';
import { selectText } from '../test/selection';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    const session = () => view.stores.session.getState();
    const select = (phrase: string) =>
        selectText(view.textRoot(), [COORD_TEXT.indexOf(phrase), COORD_TEXT.indexOf(phrase) + phrase.length]);
    return { ...view, session, pending: () => session().pending, select };
}

const chooser = () => screen.getByRole('group', { name: 'add an analysis' });
const SENTENCE = 'The precuneus peaked at x = 4, y = -60, z = 40 in the localizer.';
const textForm = () => screen.getByRole('group', { name: 'new analysis from the selected text' });

describe('adding an analysis, from the coordinates step itself', () => {
    it('offers the selected text or any table, saying to select the sentence first', () => {
        setup();
        expect(within(chooser()).getByRole('button', { name: 'From the selected text' })).toBeDisabled();
        expect(within(chooser()).getByText('select its sentence in the paper first')).toBeInTheDocument();
        fireEvent.click(within(chooser()).getByRole('button', { name: 'To Table 2' }));
        expect(screen.getByRole('group', { name: 'new analysis in Table 2' })).toBeInTheDocument();
    });

    it('takes the selection when there is one', async () => {
        const { select } = setup();
        select(SENTENCE);
        fireEvent.click(within(chooser()).getByRole('button', { name: 'From the selected text' }));
        expect((await newPointsGrid(textForm())).data).toEqual([expect.objectContaining({ x: 4, y: -60, z: 40 })]);
    });

    it('adds a null result with no points, whole-brain, its record Analysis given the outcome and scope once made', async () => {
        const { select, pending, session } = setup();
        select(SENTENCE);
        fireEvent.click(within(chooser()).getByRole('button', { name: 'From the selected text' }));
        fireEvent.change(within(textForm()).getByRole('textbox', { name: 'name' }), {
            target: { value: 'Whole brain' },
        });
        await newPointsGrid(textForm());
        fireEvent.click(within(textForm()).getByRole('switch', { name: 'no significant result: no points' }));
        expect(within(textForm()).queryByRole('group', { name: 'points of the new analysis' })).not.toBeInTheDocument();
        fireEvent.change(within(textForm()).getByRole('combobox', { name: 'spatial scope' }), {
            target: { value: 'whole_brain' },
        });
        fireEvent.click(within(textForm()).getByRole('button', { name: 'Add analysis' }));
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'add',
                payload: { analysis: expect.objectContaining({ origin: 'text', name: 'Whole brain', points: [] }) },
            }),
        ]);
        expect(coordinateOpErrors(pending())).toEqual([]);
        const sent = pending();
        const added = { key: key(0x77), origin: 'text', name: 'Whole brain', role: 'result', points: [] };
        const record = {
            analyses: [
                ...RECORD.analyses,
                { local_id: 'rv_000000000077', name: ev('Whole brain'), source_table_analysis: ev(added.key) },
            ],
        };
        const entities = [...ENTITIES, row('rv_000000000077', 'Analysis', 'analyses')];
        const result = coordinateResult(sent, [FACES, HOUSES, LOCALIZER, SCRAMBLED, added], { record, entities });
        const removeAdded = {
            type: 'coordinate',
            target: { kind: 'coordinate_parse' },
            action: 'restore',
            payload: { remove: [added.key], insert: [], reasons: {}, record: { remove: [], insert: [] } },
        };
        act(() => session().confirm({ ...result, ops: [{ ...result.ops[0], inverse: [removeAdded] as never }] }, sent));
        expect(pending()).toEqual([
            expect.objectContaining({
                type: 'set_value',
                target: { kind: 'slot', entity: 'rv_000000000077', path: 'outcome' },
                value: expect.objectContaining({ extraction_status: 'extracted', value: 'no_significant_effect' }),
            }),
            expect.objectContaining({
                type: 'set_value',
                target: { kind: 'slot', entity: 'rv_000000000077', path: 'spatial_scope' },
                value: expect.objectContaining({ value: 'whole_brain' }),
            }),
        ]);
        expect(new Set(pending().map((op) => session().groupOf[op.client_op_id])).size).toBe(1);
        expect(screen.getByRole('article', { name: 'Whole brain' })).toHaveAttribute('aria-current', 'true');
        expect(session().undoStack.map((step) => step.ops)).toEqual([
            [sent[0].client_op_id],
            pending().map((op) => op.client_op_id),
        ]);
    });
});
