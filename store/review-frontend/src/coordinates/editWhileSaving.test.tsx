import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses, type CoordinatePoint } from '../model/coordinates';
import type { OpClient } from '../store/opClient';
import {
    coordinateResult,
    CUNEUS,
    FACES,
    HOUSES,
    INSULA,
    key,
    LOCALIZER,
    PRECUNEUS,
    SCRAMBLED,
} from '../test/coordinates';
import type { ReviewStores } from '../store/reviewStores';
import { selectSaveLabel, selectShownPoints } from '../store/sessionStore';
import { addAnalysis, mergeAnalyses, relabelAnalysis } from './actions';
import { json } from '../test/fakeFetch';
import { at, openSaving, SLOW } from '../test/savingView';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 30_000 });

let client: OpClient | undefined;
afterEach(() => client?.stop());

async function open() {
    const view = await openSaving();
    client = view.client;
    return view;
}

const pointsOf = (ops: Op[]) => ops.map((op) => (op as { payload: { points: CoordinatePoint[] } }).payload.points);

describe('the point grid while edits save', () => {
    it('stays editable while a batch is out, and the edits made meanwhile arrive after it, in order', async () => {
        const { hot, posted, saved, editable, hold, faces } = await open();
        const release = hold();
        act(() => hot().edit(0, 'z', 42));
        act(() => void client!.flush());
        await waitFor(() => expect(posted()).toHaveLength(1), SLOW);
        expect(editable()).toBe(true);
        act(() => hot().edit(1, 'z', 7));
        expect(editable()).toBe(true);
        expect(hot().rows.map((row) => row.z)).toEqual([42, 7]);
        act(() => release());
        await saved();
        expect(posted().map(pointsOf)).toEqual([[[at(PRECUNEUS, 42), INSULA]], [[at(PRECUNEUS, 42), at(INSULA, 7)]]]);
        expect(faces()?.points).toEqual([at(PRECUNEUS, 42), at(INSULA, 7)]);
    });

    it('coalesces quick edits into one batch whose points the server ends with', async () => {
        const { hot, posted, saved, faces } = await open();
        act(() => hot().edit(0, 'z', 41));
        act(() => hot().edit(0, 'z', 42));
        act(() => hot().edit(1, 'x', -30));
        expect(posted()).toEqual([]);
        await saved();
        expect(posted().map(pointsOf)).toEqual([[[at(PRECUNEUS, 42), { ...INSULA, coordinates: [-30, 20, 2] }]]]);
        expect(faces()?.points).toEqual([at(PRECUNEUS, 42), { ...INSULA, coordinates: [-30, 20, 2] }]);
    });

    it('sends at once on Shift+J, without waiting for the pause', async () => {
        const { hot, stores } = await open();
        act(() => hot().edit(0, 'z', 42));
        act(() => void fireEvent.keyDown(document.body, { key: 'J', shiftKey: true }));
        expect(stores.session.getState().collected).toEqual([]);
        expect(stores.session.getState().pending).toEqual([
            expect.objectContaining({ action: 'edit_points', payload: { points: [at(PRECUNEUS, 42), INSULA] } }),
        ]);
    });

    it('says on the card head that the edits are unsaved, then saving, then saved', async () => {
        const { hot, hold, status, saved } = await open();
        expect(status()).toHaveTextContent('saved');
        const release = hold();
        act(() => hot().edit(0, 'z', 42));
        expect(status()).toHaveTextContent('unsaved');
        act(() => void client!.flush());
        expect(status()).toHaveTextContent('saving…');
        act(() => release());
        await saved();
        expect(status()).toHaveTextContent(/^saved$/);
    });

    it('lands an edit made while its split is out on the part holding the edited point', async () => {
        const { hot, posted, saved, stores, hold, server } = await open();
        act(() => stores.view.getState().selectPoints([0]));
        const release = hold();
        fireEvent.click(
            within(screen.getByRole('group', { name: `${FACES.name}: card head` })).getByRole('button', {
                name: 'Split',
            })
        );
        await waitFor(() => expect(posted()).toHaveLength(1), SLOW);
        act(() => hot().edit(1, 'z', 7));
        act(() => release());
        await saved();
        const parts = currentAnalyses(stores.session.getState().bundle).filter((a) => a.name.includes('(part'));
        expect(parts.map((part) => part.points)).toEqual([[PRECUNEUS], [at(INSULA, 7)]]);
        const [split] = (await server.backend.getBundle('P1')).ops;
        const made = (split.after as { analyses: { analysis: { key: string } }[] }).analyses;
        expect(posted()[1]).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                target: { kind: 'coordinate_analysis', analysis_key: made[1].analysis.key },
            }),
        ]);
    });

    it('keeps the reviewer’s points, says why on the card head and one banner line, and Discard brings back the server’s', async () => {
        const { hot, hold, posted, stores, status } = await open();
        const release = hold();
        act(() => hot().edit(0, 'z', 42));
        act(() => void client!.flush());
        act(() => hot().edit(1, 'z', 7));
        act(() =>
            release(({ ops: [op] }) =>
                json(
                    {
                        status: 422,
                        title: 'Unprocessable Entity',
                        detail: 'op 0 is refused',
                        errors: [
                            {
                                field: 'ops/0',
                                code: 'REJECTED',
                                message: 'too far out',
                                context: { op_index: 0, client_op_id: op.client_op_id },
                            },
                        ],
                    },
                    422
                )
            )
        );
        await waitFor(() => expect(stores.session.getState().pending).toEqual([]), SLOW);
        expect(posted()).toHaveLength(1);
        expect(hot().rows.map((row) => row.z)).toEqual([42, 7]);
        expect(status()).toHaveTextContent('not saved: too far out');
        const lines = within(screen.getByRole('status', { name: '' })).getAllByRole('listitem');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toHaveTextContent(
            /^Couldn’t change Faces > Houses: the server refused this edit \(too far out\)$/
        );
        fireEvent.click(
            within(screen.getByRole('group', { name: `${FACES.name}: card head` })).getByRole('button', {
                name: 'Discard my point edits',
            })
        );
        expect(hot().rows.map((row) => row.z)).toEqual([40, 2]);
        expect(status()).toHaveTextContent(/^saved$/);
        expect(posted()).toHaveLength(1);
    });

    it('undoes, with a batch out, each edit not yet sent and then the batch sent, back to the points it had', async () => {
        const { hot, saved, hold, faces, stores } = await open();
        const release = hold();
        act(() => hot().edit(0, 'z', 42));
        act(() => void client!.flush());
        act(() => hot().edit(1, 'z', 7));
        act(() => stores.session.getState().undo());
        expect(hot().rows.map((row) => row.z)).toEqual([42, 2]);
        act(() => stores.session.getState().undo());
        act(() => release());
        await saved();
        await waitFor(() => expect(faces()?.points).toEqual([PRECUNEUS, INSULA]), SLOW);
        expect(hot().rows.map((row) => row.z)).toEqual([40, 2]);
    });

    it('sends a Split right after an edit behind it, on the key the edit gave', async () => {
        const { hot, posted, saved, stores, server } = await open();
        act(() => hot().edit(1, 'z', 7));
        act(() => stores.view.getState().selectPoints([0]));
        fireEvent.click(
            within(screen.getByRole('group', { name: `${FACES.name}: card head` })).getByRole('button', {
                name: 'Split',
            })
        );
        await saved();
        const [edited] = (await server.backend.getBundle('P1')).ops;
        const made = (edited.after as { analyses: { analysis: { key: string } }[] }).analyses;
        expect(posted().map((ops) => ops.map((op) => 'action' in op && op.action))).toEqual([
            ['edit_points'],
            ['split'],
        ]);
        expect(posted()[1][0]).toMatchObject({
            target: { kind: 'coordinate_analysis', analysis_key: made[0].analysis.key },
        });
        const parts = currentAnalyses(stores.session.getState().bundle).filter((a) => a.name.includes('(part'));
        expect(parts.map((part) => part.points)).toEqual([[PRECUNEUS], [at(INSULA, 7)]]);
    });

    const actionOps = () =>
        stores()
            .session.getState()
            .pending.map((op) => ('action' in op ? op.action : op.type));
    let stores: () => ReviewStores;

    it.each<[string, (view: Awaited<ReturnType<typeof open>>) => void]>([
        ['Accept', () => void fireEvent.keyDown(document.body, { key: 'a' })],
        ['Change role', (view) => void relabelAnalysis(view.stores, 'anchor')],
        [
            'Merge',
            (view) => {
                view.stores.view.getState().toggleMerge(HOUSES.key);
                mergeAnalyses(view.stores);
            },
        ],
        [
            'Add analysis',
            (view) => void addAnalysis(view.stores, { table: 't1' }, { name: 'New', role: 'result' }, [CUNEUS]),
        ],
        [
            'a click on another analysis’s card',
            () => void fireEvent.click(screen.getByRole('article', { name: HOUSES.name })),
        ],
    ])('sends the edits collected before %s', async (_, act_) => {
        const view = await open();
        stores = () => view.stores;
        act(() => view.hot().edit(0, 'z', 42));
        act(() => act_(view));
        expect(view.stores.session.getState().collected).toEqual([]);
        expect(actionOps()[0]).toBe('edit_points');
    });

    it('says saved on its card head while another analysis’s change saves', async () => {
        const { stores: own, status } = await open();
        act(
            () =>
                void own.session.getState().emitBatch([
                    {
                        client_op_id: 'op-relabel',
                        type: 'coordinate',
                        target: { kind: 'coordinate_analysis', analysis_key: HOUSES.key },
                        action: 'relabel',
                        role: 'anchor',
                    },
                ])
        );
        expect(status()).toHaveTextContent(/^saved$/);
    });

    it('offers to apply edits kept to the analysis now in its place, holding the points they were made on, or to discard them', async () => {
        const { stores: own, hold } = await open();
        const release = hold();
        const sent: Op = {
            client_op_id: 'op-first-01',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'edit_points',
            payload: { points: [at(PRECUNEUS, 42), INSULA] },
        };
        act(() => void own.session.getState().emitBatch([sent]));
        const later = [at(PRECUNEUS, 42), at(INSULA, 7)];
        act(() => void own.session.getState().collect(FACES.key, later));
        const merged = { ...HOUSES, key: key(0xb22), points: [CUNEUS, at(PRECUNEUS, 42), INSULA] };
        act(() => own.session.getState().confirm(coordinateResult([sent], [merged, LOCALIZER, SCRAMBLED]), [sent]));
        const head = () => screen.getByRole('group', { name: `${HOUSES.name}: card head` });
        const kept = within(head()).getByRole('note', { name: `kept point edits on ${FACES.name}` });
        expect(kept).toHaveTextContent(`Point edits on ${FACES.name} kept, not sent`);
        expect(selectSaveLabel(own.session.getState())).toBe('1 unsaved');
        fireEvent.click(within(kept).getByRole('button', { name: `Apply to ${HOUSES.name}` }));
        expect(selectShownPoints(own.session.getState(), merged.key)).toEqual([CUNEUS, ...later]);
        expect(
            within(head()).queryByRole('note', { name: `kept point edits on ${FACES.name}` })
        ).not.toBeInTheDocument();
        act(() => release());
    });

    it('drops kept edits on Discard, leaving nothing unsaved', async () => {
        const { stores: own } = await open();
        const sent: Op = {
            client_op_id: 'op-first-01',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'edit_points',
            payload: { points: [at(PRECUNEUS, 42), INSULA] },
        };
        act(() => {
            own.session.setState({ pending: [sent] });
            own.session.getState().collect(FACES.key, [at(PRECUNEUS, 42), at(INSULA, 7)]);
            own.session.getState().confirm(coordinateResult([sent], [HOUSES, LOCALIZER, SCRAMBLED]), [sent]);
        });
        const kept = screen.getByRole('note', { name: `kept point edits on ${FACES.name}` });
        fireEvent.click(within(kept).getByRole('button', { name: 'Discard' }));
        expect(screen.queryByRole('note', { name: `kept point edits on ${FACES.name}` })).not.toBeInTheDocument();
        expect(own.session.getState().collected).toEqual([]);
    });
});
