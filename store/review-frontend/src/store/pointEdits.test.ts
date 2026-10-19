import type { Op } from '../contract/generated/review-ops';
import type { CoordinateAnalysis, CoordinatePoint } from '../model/coordinates';
import {
    coordinateBundle,
    coordinateResult,
    FACES,
    HOUSES,
    INSULA,
    key,
    LOCALIZER,
    PRECUNEUS,
    SCRAMBLED,
} from '../test/coordinates';
import { heldClient } from '../test/heldClient';
import { createReviewStores } from './reviewStores';
import { selectCanUndo, selectSaveLabel, selectShownPoints } from './sessionStore';

const open = () => createReviewStores(coordinateBundle(), { now: () => 'now' });

const at = (point: CoordinatePoint, z: number): CoordinatePoint => ({
    ...point,
    coordinates: [point.coordinates[0], point.coordinates[1], z],
});

const target = (analysis_key: string) => ({ kind: 'coordinate_analysis', analysis_key }) as const;

const editPoints = (client_op_id: string, analysis: string, points: CoordinatePoint[]): Op => ({
    client_op_id,
    type: 'coordinate',
    target: target(analysis),
    action: 'edit_points',
    payload: { points },
});

const sentPoints = (op: Op | undefined) =>
    (op as { payload: { points: CoordinatePoint[] } } | undefined)?.payload.points;
const targetOf = (op: Op | undefined) => (op as { target: { analysis_key: string } } | undefined)?.target.analysis_key;

describe('point edits collected before they are sent', () => {
    it('show at once, send nothing, and go out as one edit_points of the latest points, one undo step', () => {
        const { session } = open();
        const edits = [41, 42, 43].map((z) => [at(PRECUNEUS, z), INSULA]);
        for (const points of edits) expect(session.getState().collect(FACES.key, points)).toBe(true);
        expect(session.getState().pending).toEqual([]);
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(edits[2]);
        expect(selectSaveLabel(session.getState())).toBe('3 unsaved');
        expect(session.getState().sendCollected()).toBe(true);
        expect(session.getState().pending).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                target: target(FACES.key),
                payload: { points: edits[2] },
            }),
        ]);
        expect(session.getState().collected).toEqual([]);
        expect(session.getState().undoStack).toHaveLength(1);
    });

    it('send one edit_points for each analysis edited, in the order first edited', () => {
        const { session } = open();
        session.getState().collect(HOUSES.key, []);
        session.getState().collect(FACES.key, [INSULA]);
        session.getState().collect(HOUSES.key, [at(PRECUNEUS, 1)]);
        session.getState().sendCollected();
        expect(session.getState().pending.map((op) => [targetOf(op), sentPoints(op)])).toEqual([
            [HOUSES.key, [at(PRECUNEUS, 1)]],
            [FACES.key, [INSULA]],
        ]);
        expect(session.getState().undoStack).toHaveLength(1);
    });

    it('take back each edit in turn on undo before they are sent, sending nothing, and redo it again', () => {
        const { session } = open();
        const edits = [41, 42].map((z) => [at(PRECUNEUS, z), INSULA]);
        for (const points of edits) session.getState().collect(FACES.key, points);
        session.getState().undo();
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(edits[0]);
        session.getState().undo();
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(FACES.points);
        expect(selectCanUndo(session.getState())).toBe(false);
        session.getState().redo();
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(edits[0]);
        expect(session.getState().pending).toEqual([]);
        expect(session.getState().sendCollected()).toBe(true);
        expect(sentPoints(session.getState().pending[0])).toEqual(edits[0]);
    });

    it('send nothing for an analysis edited back to its points', () => {
        const { session } = open();
        session.getState().collect(FACES.key, [INSULA]);
        session.getState().collect(FACES.key, FACES.points!);
        expect(session.getState().sendCollected()).toBe(false);
        expect(session.getState().pending).toEqual([]);
    });
});

describe('point edits to an analysis a pending op changes', () => {
    const sent = editPoints('op-first', FACES.key, [at(PRECUNEUS, 42), INSULA]);
    const edited: CoordinateAnalysis = {
        ...FACES,
        key: key(0xa11),
        derived_from: [FACES.key],
        points: [at(PRECUNEUS, 42), INSULA],
    };

    it('wait while it is pending, then follow the analysis to the key its result gives', () => {
        const { session } = open();
        session.getState().emitBatch([sent]);
        const later = [at(PRECUNEUS, 42), at(INSULA, 7)];
        session.getState().collect(FACES.key, later);
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(later);
        expect(session.getState().sendCollected()).toBe(false);
        expect(session.getState().pending).toEqual([sent]);
        session.getState().confirm(coordinateResult([sent], [edited, HOUSES, LOCALIZER, SCRAMBLED]), [sent]);
        expect(selectShownPoints(session.getState(), edited.key)).toEqual(later);
        expect(session.getState().sendCollected()).toBe(true);
        expect(session.getState().pending.map((op) => [targetOf(op), sentPoints(op)])).toEqual([[edited.key, later]]);
    });

    it('land on the part holding the edited point once the split is in', () => {
        const { session } = open();
        const split: Op = {
            client_op_id: 'op-split',
            type: 'coordinate',
            target: target(FACES.key),
            action: 'split',
            payload: { parts: [{ indices: [0] }, { indices: [1] }] },
        };
        session.getState().emitBatch([split]);
        session.getState().collect(FACES.key, [PRECUNEUS, at(INSULA, 7)]);
        const parts = [PRECUNEUS, INSULA].map((point, i) => ({
            ...FACES,
            key: key(0xa21 + i),
            name: `${FACES.name} (part ${i + 1})`,
            derived_from: [FACES.key],
            points: [point],
        }));
        session.getState().confirm(coordinateResult([split], [...parts, HOUSES, LOCALIZER, SCRAMBLED]), [split]);
        expect(session.getState().sendCollected()).toBe(true);
        expect(session.getState().pending.map((op) => [targetOf(op), sentPoints(op)])).toEqual([
            [parts[1].key, [at(INSULA, 7)]],
        ]);
    });

    it('are kept when it is refused, held with its message over the server’s points, on one banner line', () => {
        const { session } = open();
        session.getState().emitBatch([sent]);
        const later = [at(PRECUNEUS, 42), at(INSULA, 7)];
        session.getState().collect(FACES.key, later);
        session.getState().refuse([{ op: sent, message: 'too far out' }]);
        expect(session.getState().collected).toEqual([
            { key: FACES.key, name: FACES.name, base: FACES.points, points: later, held: { message: 'too far out' } },
        ]);
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(later);
        expect(session.getState().sendCollected()).toBe(false);
        expect(session.getState().notices).toEqual([
            { kind: 'refused', slot: `coordinate_analysis:${FACES.key}`, message: 'too far out', op: sent },
        ]);
    });

    it('keep the refused points themselves when nothing was edited after them', () => {
        const { session } = open();
        session.getState().emitBatch([sent]);
        session.getState().refuse([{ op: sent, message: 'too far out' }]);
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual(sentPoints(sent));
        expect(session.getState().collected).toEqual([
            expect.objectContaining({ key: FACES.key, base: FACES.points, held: { message: 'too far out' } }),
        ]);
    });

    it('go out once the reviewer edits the analysis again, over the server’s points; Discard shows the server’s', () => {
        const { session } = open();
        session.getState().emitBatch([sent]);
        session.getState().refuse([{ op: sent, message: 'too far out' }]);
        session.getState().collect(FACES.key, [at(PRECUNEUS, 41), INSULA]);
        expect(session.getState().sendCollected()).toBe(true);
        expect(session.getState().pending.map(sentPoints)).toEqual([[at(PRECUNEUS, 41), INSULA]]);

        const other = open().session;
        other.getState().emitBatch([sent]);
        other.getState().refuse([{ op: sent, message: 'too far out' }]);
        other.getState().discardCollected(FACES.key);
        expect(other.getState().collected).toEqual([]);
        expect(selectShownPoints(other.getState(), FACES.key)).toEqual(FACES.points);
    });

    it('leave the edits of another analysis and the ops queued behind it as they are', () => {
        const { session } = open();
        const name: Op = {
            client_op_id: 'op-name',
            type: 'set_value',
            target: { kind: 'slot', entity: 'ana_houses', path: 'name' },
            value: { extraction_status: 'extracted', value: 'Houses', value_source: 'reported' },
        };
        const relabel: Op = {
            client_op_id: 'op-relabel',
            type: 'coordinate',
            target: target(FACES.key),
            action: 'relabel',
            role: 'anchor',
        };
        const split: Op = {
            client_op_id: 'op-split',
            type: 'coordinate',
            target: target(FACES.key),
            action: 'split',
            payload: { parts: [{ indices: [0] }, { indices: [1] }] },
        };
        session.getState().emitBatch([sent]);
        session.getState().emitBatch([relabel]);
        session.getState().emitBatch([split]);
        session.getState().emit(name);
        session.getState().collect(HOUSES.key, [INSULA]);
        session.getState().refuse([{ op: sent, message: 'too far out' }]);
        expect(session.getState().pending).toEqual([relabel, split, name]);
        expect(session.getState().collected).toEqual([
            { key: HOUSES.key, name: HOUSES.name, base: HOUSES.points, points: [INSULA] },
            expect.objectContaining({ key: FACES.key, held: { message: 'too far out' } }),
        ]);
    });

    it.each<[string, Op, string]>([
        [
            'relabel',
            { client_op_id: 'op-r', type: 'coordinate', target: target(FACES.key), action: 'relabel', role: 'anchor' },
            FACES.key,
        ],
        [
            'merge',
            {
                client_op_id: 'op-m',
                type: 'coordinate',
                target: target(FACES.key),
                action: 'merge',
                payload: { with: [HOUSES.key] },
            },
            HOUSES.key,
        ],
    ])('keep, unheld, the point edits made while a refused %s was pending', (_, op, edited) => {
        const { session } = open();
        session.getState().emitBatch([op]);
        session.getState().collect(edited, [INSULA]);
        session.getState().refuse([{ op, message: 'no' }]);
        expect(session.getState().collected).toEqual([expect.objectContaining({ key: edited, points: [INSULA] })]);
        expect(session.getState().collected[0].held).toBeUndefined();
        expect(session.getState().sendCollected()).toBe(true);
    });

    it('keep, held, the edits on an analysis a refused move would have changed', () => {
        const { session } = open();
        const from = editPoints('op-from', FACES.key, [INSULA]);
        const to = editPoints('op-to', HOUSES.key, [...HOUSES.points!, PRECUNEUS]);
        session.getState().emitBatch([from, to]);
        session.getState().collect(FACES.key, [at(INSULA, 7)]);
        session.getState().refuse([{ op: from, message: 'no' }]);
        expect(selectShownPoints(session.getState(), FACES.key)).toEqual([at(INSULA, 7)]);
        expect(session.getState().collected[0].held).toEqual({ message: 'no' });
    });

    it('are kept, and the reviewer told, when the result gives the analysis no replacement', () => {
        const { session } = open();
        session.getState().emitBatch([sent]);
        session.getState().collect(FACES.key, [at(PRECUNEUS, 42), at(INSULA, 7)]);
        session.getState().confirm(coordinateResult([sent], [HOUSES, LOCALIZER, SCRAMBLED]), [sent]);
        expect(session.getState().collected).toEqual([
            expect.objectContaining({
                key: FACES.key,
                held: { message: 'the analysis was replaced before they could be sent', guess: HOUSES.key },
            }),
        ]);
        expect(session.getState().sendCollected()).toBe(false);
        expect(session.getState().pending).toEqual([]);
        expect(selectSaveLabel(session.getState())).toBe('1 unsaved');
        expect(session.getState().notices).toEqual([
            { kind: 'kept', slot: FACES.name, message: 'the analysis was replaced before they could be sent' },
        ]);
    });

    it('that were kept can be applied to the guess, or discarded', () => {
        const { session } = open();
        session.getState().emitBatch([sent]);
        const later = [at(PRECUNEUS, 42), at(INSULA, 7)];
        session.getState().collect(FACES.key, later);
        session.getState().confirm(coordinateResult([sent], [HOUSES, LOCALIZER, SCRAMBLED]), [sent]);
        expect(session.getState().applyCollected(FACES.key, HOUSES.key)).toBe(true);
        expect(selectShownPoints(session.getState(), HOUSES.key)).toEqual(later);
        expect(session.getState().sendCollected()).toBe(true);
        expect(session.getState().pending.map((op) => [targetOf(op), sentPoints(op)])).toEqual([[HOUSES.key, later]]);
    });
});

describe('an op queued behind the op that changes its analysis’s key', () => {
    it('is sent to the key the result gives', () => {
        const { session } = open();
        const sent = editPoints('op-first', FACES.key, [at(PRECUNEUS, 42), INSULA]);
        const relabel: Op = {
            client_op_id: 'op-relabel',
            type: 'coordinate',
            target: target(FACES.key),
            action: 'relabel',
            role: 'anchor',
        };
        session.getState().emitBatch([sent]);
        session.getState().emitBatch([relabel]);
        const edited = { ...FACES, key: key(0xa11), derived_from: [FACES.key], points: sentPoints(sent) };
        session.getState().confirm(coordinateResult([sent], [edited, HOUSES, LOCALIZER, SCRAMBLED]), [sent]);
        expect(session.getState().pending).toEqual([{ ...relabel, target: target(edited.key) }]);
    });
});

describe('point edits collected, on leaving', () => {
    let client: ReturnType<typeof heldClient> | undefined;
    afterEach(() => client?.stop());

    it.each([
        ['another analysis', (stores: ReturnType<typeof open>) => stores.view.getState().focusAnalysis(HOUSES.key)],
        ['the step', (stores: ReturnType<typeof open>) => stores.view.getState().setStep('analyses')],
        ['a record card', (stores: ReturnType<typeof open>) => stores.view.getState().focusEntity('ana_faces')],
    ])('are sent at once when the reviewer leaves for %s', (_, leave) => {
        const stores = open();
        client = heldClient(stores);
        stores.session.getState().collect(FACES.key, [INSULA]);
        leave(stores);
        expect(stores.session.getState().collected).toEqual([]);
        expect(stores.session.getState().pending.map(sentPoints)).toEqual([[INSULA]]);
    });

    it('are not sent when the focus follows the analysis to its new key', () => {
        const stores = open();
        const sent = editPoints('op-first', FACES.key, [at(PRECUNEUS, 42), INSULA]);
        stores.session.getState().emitBatch([sent]);
        stores.session.getState().collect(FACES.key, [at(PRECUNEUS, 42), at(INSULA, 7)]);
        const edited = { ...FACES, key: key(0xa11), derived_from: [FACES.key], points: sentPoints(sent) };
        stores.session.getState().confirm(coordinateResult([sent], [edited, HOUSES, LOCALIZER, SCRAMBLED]), [sent]);
        expect(stores.view.getState().coordinates?.analysis).toBe(edited.key);
        expect(stores.session.getState().collected).toHaveLength(1);
        expect(stores.session.getState().pending).toEqual([]);
    });
});
