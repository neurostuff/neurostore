import type { Op } from '../contract/generated/review-ops';
import { slotKey } from '../model/targetKey';
import { ev, makeBundle } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { createOpClient } from './opClient';
import { createSessionStore } from './sessionStore';
import { newSet } from '../test/stores';

const TEXT = 'Twenty patients and eighteen controls performed a Stroop task during fMRI scanning at 3 T.';
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const source = makeBundle({ description: ev('A study'), task: ev('Stroop') }, TEXT, {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
});

const setTask = (id: string, value: string): Op => ({
    client_op_id: id,
    type: 'set_value',
    target: { kind: 'slot', entity: 'study', path: 'task' },
    value: { extraction_status: 'extracted', value },
});

async function open(server: FakeServer) {
    const session = createSessionStore(await server.backend.getBundle('S1'));
    return { session, client: createOpClient(session, server.api()) };
}

async function started() {
    const server = fakeServer([source]);
    await server.backend.startReview('S1');
    return server;
}

const taskOf = (record: unknown) => (record as { task: { value: unknown } }).task.value;

/** The spans the saved evidence of the study's `slot` holds, in order. */
const spansOf = (record: unknown, slot: string) =>
    (record as Record<string, { evidence: { sets: { spans: { start_char: number; end_char: number }[] }[] } }>)[
        slot
    ].evidence.sets.flatMap((set) => set.spans.map((s): [number, number] => [s.start_char, s.end_char]));

describe('the session store saving through its op client, with no view', () => {
    it('holds the documents and the save, and no focus, step or panel', async () => {
        const { session } = await open(await started());
        const viewKeys = ['focus', 'step', 'panel', 'coordinates'];
        expect(Object.keys(session.getState()).filter((key) => viewKeys.includes(key))).toEqual([]);
    });

    it('applies an emitted edit at once, and takes the record the server confirms', async () => {
        const server = await started();
        const { session, client } = await open(server);
        expect(session.getState().emit(setTask('t-1', 'n-back'))).toBe(true);
        expect(taskOf(session.getState().record)).toBe('n-back');
        expect(session.getState().pending).toHaveLength(1);
        await client.flush();
        const saved = await server.backend.getBundle('S1');
        expect(session.getState().pending).toEqual([]);
        expect(session.getState().ops).toEqual(saved.ops);
        expect(session.getState().record).toEqual(saved.record);
        expect(taskOf(saved.record)).toBe('n-back');
    });

    it('adds evidence to a slot named by its key', async () => {
        const server = await started();
        const { session, client } = await open(server);
        expect(
            session
                .getState()
                .addEvidence(
                    slotKey('study', 'task'),
                    at('Stroop task'),
                    newSet(session.getState(), slotKey('study', 'task'))
                )
        ).toBe(true);
        await client.flush();
        expect(session.getState().index.slot(slotKey('study', 'task'))?.spans).toEqual([at('Stroop task')]);
        expect(session.getState().record).toEqual((await server.backend.getBundle('S1')).record);
    });

    it('rebases a pending edit onto what another tab saved, and saves it on top', async () => {
        const server = await started();
        const a = await open(server);
        const b = await open(server);
        a.session
            .getState()
            .addEvidence(
                slotKey('study', 'description'),
                at('Twenty patients'),
                newSet(a.session.getState(), slotKey('study', 'description'))
            );
        await a.client.flush();
        b.session.getState().emit(setTask('t-1', 'n-back'));
        await b.client.flush();
        const saved = await server.backend.getBundle('S1');
        expect(server.requests.filter((r) => r.status === 409)).toHaveLength(1);
        expect(b.session.getState().pending).toEqual([]);
        expect(b.session.getState().record).toEqual(saved.record);
        expect(taskOf(saved.record)).toBe('n-back');
        expect(b.session.getState().index.slot(slotKey('study', 'description'))?.spans).toEqual([
            at('Twenty patients'),
        ]);
    });

    it('rebases added evidence onto the evidence another tab saved for the slot, keeping both', async () => {
        const server = await started();
        const a = await open(server);
        const b = await open(server);
        a.session.getState().addEvidence(slotKey('study', 'description'), at('Twenty patients'), 0);
        await a.client.flush();
        b.session.getState().addEvidence(slotKey('study', 'description'), at('Stroop task'), 0);
        await b.client.flush();
        const saved = await server.backend.getBundle('S1');
        expect(server.requests.filter((r) => r.status === 409)).toHaveLength(1);
        expect(spansOf(saved.record, 'description')).toEqual([at('Twenty patients'), at('Stroop task')]);
        expect(b.session.getState().record).toEqual(saved.record);
    });

    it('drops from pending, on a rebase, an edit the server already stores', async () => {
        const server = await started();
        const { session } = await open(server);
        session.getState().emit(setTask('t-1', 'n-back'));
        const { review } = await server.backend.getBundle('S1');
        server.backend.postOps(review!.id, { expected_last_seq: 0, ops: session.getState().pending });
        session.getState().rebase(await server.backend.getBundle('S1'));
        expect(session.getState().pending).toEqual([]);
        expect(taskOf(session.getState().record)).toBe('n-back');
    });

    it('forgets what it could redo once a new edit is made', async () => {
        const server = await started();
        const { session, client } = await open(server);
        session.getState().emit(setTask('t-1', 'n-back'));
        await client.flush();
        session.getState().undo();
        await client.flush();
        expect(session.getState().redoStack).toHaveLength(1);
        session.getState().emit(setTask('t-2', 'go/no-go'));
        expect(session.getState().redoStack).toEqual([]);
        session.getState().redo();
        expect(taskOf(session.getState().record)).toBe('go/no-go');
    });

    it('undoes a saved edit by saving its inverse, and redoes it the same way', async () => {
        const server = await started();
        const { session, client } = await open(server);
        session.getState().emit(setTask('t-1', 'n-back'));
        await client.flush();
        session.getState().undo();
        expect(taskOf(session.getState().record)).toBe('Stroop');
        await client.flush();
        expect(taskOf((await server.backend.getBundle('S1')).record)).toBe('Stroop');
        session.getState().redo();
        await client.flush();
        expect(taskOf((await server.backend.getBundle('S1')).record)).toBe('n-back');
        expect(session.getState().record).toEqual((await server.backend.getBundle('S1')).record);
        expect(session.getState().redoStack).toEqual([]);
    });
});
