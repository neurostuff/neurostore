import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../../contract/generated/review-bundle';
import type { Op } from '../../contract/generated/review-ops';
import { slotKey } from '../../model/targetKey';
import { createReviewStore, type EvidenceMode, type ReviewStore } from '../../store/reviewStore';
import { validateOpBatch } from '../schemas';

interface Entry {
    name: string;
    ops: Op[];
    expect: string;
}

const BUNDLE = path.resolve(__dirname, 'bundle.json');
const OPS = path.resolve(__dirname, 'ops.json');
const bundle: ReviewBundle = JSON.parse(readFileSync(BUNDLE, 'utf8'));
const at = (words: string): [number, number] => [bundle.text.indexOf(words), bundle.text.indexOf(words) + words.length];
const span = (words: string) => ({ start_char: at(words)[0], end_char: at(words)[1] });

function emitted(name: string, drive: (store: ReviewStore) => void): Entry {
    let minted = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        minted += 1;
        return `${name}-${minted}` as ReturnType<typeof crypto.randomUUID>;
    });
    const store = createReviewStore(bundle);
    drive(store);
    return { name, ops: store.getState().pending, expect: 'ok' };
}

const addTo = (entity: string, path: string, words: string, mode: EvidenceMode) => (store: ReviewStore) => {
    store.getState().focusSlot(slotKey(entity, path));
    expect(store.getState().addEvidence(at(words), mode)).toBe(true);
};

function entries(): Entry[] {
    return [
        emitted('golden-positional-nested-slot', addTo('an_1', 'groups[#0].n', 'Twenty patients', 'first')),
        emitted('golden-dotted-slot', addTo('study', 'design.description', 'during fMRI', 'first')),
        emitted('golden-study-slot', addTo('study', 'description', 'performed a Stroop task', 'first')),
        emitted('golden-e-keeps-model-quote', addTo('grp_a', 'age_mean', 'on average', 'first')),
        emitted('golden-shift-e-new-set', addTo('grp_a', 'age_mean', '34.2 years', 'new')),
        {
            name: 'golden-not-reported-refused',
            ops: [
                {
                    client_op_id: 'golden-not-reported-refused-1',
                    type: 'set_evidence',
                    target: { kind: 'slot', entity: 'grp_b', path: 'age_mean' },
                    evidence: { status: 'present', sets: [{ spans: [{ start_char: 20, end_char: 28 }] }] },
                },
            ],
            expect: 'set a value first',
        },
    ];
}

describe('the golden op file the backend replays', () => {
    const golden = entries();

    it('holds what the store emits for the golden bundle; regenerate with UPDATE_GOLDEN=1', () => {
        const rendered = JSON.stringify(golden, null, 2) + '\n';
        if (process.env.UPDATE_GOLDEN) writeFileSync(OPS, rendered);
        expect(existsSync(OPS)).toBe(true);
        expect(readFileSync(OPS, 'utf8')).toBe(rendered);
    });

    it('sends only ops the op schema accepts', () => {
        for (const entry of golden) expect(validateOpBatch({ ops: entry.ops }), entry.name).toBe(true);
    });

    it('echoes the model_quote source of the set it adds to, and leaves a new set without one', () => {
        const byName = Object.fromEntries(golden.map((entry) => [entry.name, entry.ops]));
        expect(byName['golden-e-keeps-model-quote']).toMatchObject([
            {
                evidence: {
                    sets: [
                        {
                            source: 'model_quote',
                            spans: [span('Patients were 34.2 years old on average.'), span('on average')],
                        },
                    ],
                },
            },
        ]);
        const [newSet] = byName['golden-shift-e-new-set'];
        expect(newSet).toMatchObject({ evidence: { sets: [{ source: 'model_quote' }, {}] } });
        expect(newSet.type === 'set_evidence' && newSet.evidence.sets?.[1]).not.toHaveProperty('source');
    });

    it('emits nothing for evidence on the not reported slot', () => {
        const store = createReviewStore(bundle);
        store.getState().focusSlot(slotKey('grp_b', 'age_mean'));
        expect(store.getState().addEvidence(at('eighteen controls'), 'first')).toBe(false);
        expect(store.getState().pending).toEqual([]);
    });
});
