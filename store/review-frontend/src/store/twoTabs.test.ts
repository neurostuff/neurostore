import type { Op } from '../contract/generated/review-ops';
import { slotKey } from '../model/targetKey';
import { ev, makeBundle } from '../test/bundles';
import { fakeServer } from '../test/fakeServer';
import { createOpClient } from './opClient';
import { createReviewStores, type ReviewStores } from './context';

const TEXT = 'Twenty patients and eighteen controls performed a Stroop task during fMRI scanning at 3 T.';
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const source = makeBundle(
    { description: ev('A study'), design: { description: ev('fMRI'), field: ev('3 T') }, task: ev('Stroop') },
    TEXT,
    { source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' } }
);

function edit(store: ReviewStores, path: string, words: string) {
    store.view.getState().focusSlot(slotKey('study', path));
    expect(store.session.getState().addEvidence(store.view.getState().focus.key, at(words), 'new')).toBe(true);
    return store.session.getState().pending.at(-1)!;
}

describe('two tabs saving to one review', () => {
    it('converge through stale rebases: every op lands once, and each tab ends on the server’s record', async () => {
        vi.useFakeTimers();
        const server = fakeServer([source]);
        const review = (await server.backend.startReview('S1')).summary;
        const open = async () => {
            const store = createReviewStores(await server.backend.getBundle('S1'));
            const client = createOpClient(store.session, server.api());
            return { store, client };
        };
        const a = await open();
        const b = await open();
        const made: Op[] = [];
        const rounds: [string, string, string, string][] = [
            ['description', 'Twenty patients', 'design.field', '3 T'],
            ['task', 'Stroop task', 'design.description', 'during fMRI'],
            ['description', 'eighteen controls', 'description', 'performed'],
        ];
        for (const [pathA, wordsA, pathB, wordsB] of rounds) {
            made.push(edit(a.store, pathA, wordsA), edit(b.store, pathB, wordsB));
            await Promise.all([a.client.flush(), b.client.flush()]);
        }
        made.push(edit(a.store, 'task', 'a Stroop'));
        await a.client.flush();
        const afterA = await server.backend.getBundle('S1');
        expect(a.store.session.getState().record).toEqual(afterA.record);
        made.push(edit(b.store, 'design.field', 'at 3 T'));
        await b.client.flush();

        const final = await server.backend.getBundle('S1');
        const ids = final.ops.map((s) => s.op.client_op_id);
        expect(ids).toHaveLength(made.length);
        expect(new Set(ids)).toEqual(new Set(made.map((op) => op.client_op_id)));
        expect(final.ops.map((s) => s.seq)).toEqual(made.map((_, i) => i + 1));
        expect(final.review?.last_seq).toBe(made.length);
        expect(b.store.session.getState().record).toEqual(final.record);
        expect(b.store.session.getState().ops).toEqual(final.ops);
        expect([a.store.session.getState().pending, b.store.session.getState().pending]).toEqual([[], []]);
        expect(server.requests.some((r) => r.path === `/api/review/sources/S1/bundle`)).toBe(true);
        expect(server.invalid()).toEqual([]);
        expect(review.id).toBe(final.review?.id);
        expect(server.requests.filter((r) => r.status === 409)).toHaveLength(5);
        vi.useRealTimers();
    });
    it('keeps both tabs’ spans when each adds evidence to the same slot from a stale record', async () => {
        const server = fakeServer([source]);
        await server.backend.startReview('S1');
        const open = async () => {
            const store = createReviewStores(await server.backend.getBundle('S1'));
            return { store, client: createOpClient(store.session, server.api()) };
        };
        const a = await open();
        const b = await open();
        for (const [tab, words] of [
            [a, 'Twenty patients'],
            [b, 'eighteen controls'],
        ] as const) {
            tab.store.view.getState().focusSlot(slotKey('study', 'description'));
            expect(
                tab.store.session.getState().addEvidence(tab.store.view.getState().focus.key, at(words), 'first')
            ).toBe(true);
        }
        await a.client.flush();
        await b.client.flush();
        const final = await server.backend.getBundle('S1');
        const spans = final.record as { description?: { evidence?: { sets?: { spans: unknown[] }[] } } };
        expect(spans.description?.evidence?.sets).toEqual([
            {
                spans: [
                    {
                        start_char: at('Twenty patients')[0],
                        end_char: at('Twenty patients')[1],
                        text: 'Twenty patients',
                    },
                    {
                        start_char: at('eighteen controls')[0],
                        end_char: at('eighteen controls')[1],
                        text: 'eighteen controls',
                    },
                ],
            },
        ]);
        expect(b.store.session.getState().record).toEqual(final.record);
        expect(server.invalid()).toEqual([]);
        expect(server.requests.filter((r) => r.status === 409)).toHaveLength(1);
    });
});
