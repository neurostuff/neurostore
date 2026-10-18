import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import type { ReviewBundle } from '../../contract/generated/review-bundle';
import type { Evidence, Op } from '../../contract/generated/review-ops';
import { applyBatch, type Documents } from '../../model/applyOp';
import type { CoordinateParse } from '../../model/coordinates';
import { codePointPaper } from '../../model/offsets';
import type { Json } from '../../model/paths';
import { slotKey } from '../../model/targetKey';
import { ReviewScreen } from '../../review/ReviewScreen';
import { createReviewStores, type ReviewStores } from '../../store/reviewStores';
import { newSet } from '../stores';
import { renderWithStores } from '../render';
import { validateOpBatch } from '../schemas';

/** One batch on the golden bundle: the documents after it, or the refusal it meets. */
interface Entry extends Partial<Documents> {
    name: string;
    ops: Op[];
    expect: string;
}

const BUNDLE = path.resolve(__dirname, 'bundle.json');
const OPS = path.resolve(__dirname, 'ops.json');
const bundle: ReviewBundle = JSON.parse(readFileSync(BUNDLE, 'utf8'));
const at = (words: string): [number, number] => [bundle.text.indexOf(words), bundle.text.indexOf(words) + words.length];
const span = (words: string) => ({ start_char: at(words)[0], end_char: at(words)[1] });
/** The time golden.py applies each batch at. */
const AT = '2026-10-14T12:00:00Z';
const documents = (): Documents => ({
    record: bundle.record as Json,
    provenance: bundle.review!.provenance,
    annotations: bundle.review!.annotations,
});

function applied(ops: Op[]): Documents {
    return applyBatch(documents(), ops, {
        text: codePointPaper(bundle.text),
        userId: bundle.review!.user_id,
        at: AT,
        coordinateParse: bundle.coordinate_parse as CoordinateParse,
        entities: bundle.entities,
    });
}

const after = ({ record, provenance, annotations }: Documents) => ({ record, provenance, annotations });

function mintIds(name: string) {
    let minted = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        minted += 1;
        return `${name}-${minted}` as ReturnType<typeof crypto.randomUUID>;
    });
}

function emitted(name: string, drive: (stores: ReviewStores) => void): Entry {
    mintIds(name);
    const stores = createReviewStores(bundle, { now: () => AT });
    drive(stores);
    return { name, ops: stores.session.getState().pending, expect: 'ok', ...after(stores.session.getState()) };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));

/** The batch the inspector emits when the reviewer drives it through the keyboard and its editors. */
function inspected(name: string, drive: (stores: ReviewStores) => void): Entry {
    cleanup();
    mintIds(name);
    const { stores } = renderWithStores(createElement(ReviewScreen), bundle, { now: () => AT });
    drive(stores);
    const entry = { name, ops: stores.session.getState().pending, expect: 'ok', ...after(stores.session.getState()) };
    cleanup();
    return entry;
}

const numbered = (name: string, ops: object[]) =>
    ops.map((op, i) => ({ client_op_id: `${name}-${i + 1}`, ...op }) as Op);

const local = (name: string, ...ops: object[]): Entry => {
    const batch = numbered(name, ops);
    return { name, ops: batch, expect: 'ok', ...after(applied(batch)) };
};

const refused = (name: string, message: string, ...ops: object[]): Entry => ({
    name,
    ops: numbered(name, ops),
    expect: message,
});

const slot = (entity: string, path: string) => ({ kind: 'slot', entity, path });
const entity = (id: string) => ({ kind: 'entity', entity: id });
const link = (path: string, target_entity: string) => ({ kind: 'relationship', entity: 'an_1', path, target_entity });
const setValue = (target: object, value: object) => ({ type: 'set_value', target, value });
const setEvidence = (target: object, evidence: Evidence) => ({ type: 'set_evidence', target, evidence });
const present = (...spans: { start_char: number; end_char: number }[]): Evidence => ({
    status: 'present',
    sets: [{ spans: spans as [(typeof spans)[0]] }],
});
const verdict = (target: object, verdict: 'accept' | 'reject', reason?: string) => ({
    type: 'verdict',
    target,
    verdict,
    ...(reason ? { reason } : {}),
});
const note = (target: object, text: string) => ({ type: 'note', target, note: text });
const reported = (value: unknown) => ({ extraction_status: 'extracted', value, value_source: 'reported' });

const addTo =
    (entity: string, path: string, words: string, asNewSet = false) =>
    (stores: ReviewStores) => {
        const key = slotKey(entity, path);
        stores.view.getState().focusSlot(key);
        const setIndex = asNewSet ? newSet(stores.session.getState(), key) : 0;
        expect(stores.session.getState().addEvidence(key, at(words), setIndex)).toBe(true);
    };

function entries(): Entry[] {
    return [
        emitted('golden-positional-nested-slot', addTo('an_1', 'groups[#0].n', 'Twenty patients')),
        emitted('golden-dotted-slot', addTo('study', 'design.description', 'during fMRI')),
        emitted('golden-study-slot', addTo('study', 'description', 'performed a Stroop task')),
        emitted('golden-e-keeps-model-quote', addTo('grp_a', 'age_mean', 'on average')),
        emitted('golden-shift-e-new-set', addTo('grp_a', 'age_mean', '34.2 years', true)),
        refused(
            'golden-not-reported-refused',
            'set a value first',
            setEvidence(slot('grp_b', 'age_mean'), present({ start_char: 20, end_char: 28 }))
        ),
        local('golden-set-value-keeps-evidence', setValue(slot('grp_a', 'age_mean'), reported(35))),
        local(
            'golden-set-value-not-reported',
            setValue(slot('grp_a', 'age_mean'), {
                extraction_status: 'not_reported',
                unreported_reason: 'outside_text',
            })
        ),
        local('golden-set-value-not-applicable-to-not-found', setValue(slot('grp_b', 'age_mean'), reported(30))),
        local('golden-set-value-absent-slot', setValue(slot('grp_b', 'age_standard_deviation'), reported(4.1))),
        local(
            'golden-set-value-not-reported-drops-value',
            setValue(slot('grp_a', 'age_mean'), {
                extraction_status: 'not_reported',
                unreported_reason: 'outside_text',
                value: 35,
            })
        ),
        refused(
            'golden-set-value-refused-not-a-value',
            "'groups[#0]' on 'an_1' is not an extracted value",
            setValue(slot('an_1', 'groups[#0]'), reported(1))
        ),
        refused(
            'golden-set-value-refused-no-item',
            "field path 'groups[#4].n': no item at position 4",
            setValue(slot('an_1', 'groups[#4].n'), reported(1))
        ),
        local('golden-entity-evidence', setEvidence(entity('grp_a'), present(span('Twenty patients')))),
        local('golden-entity-evidence-cleared', setEvidence(entity('grp_b'), { status: 'not_applicable' })),
        local(
            'golden-entity-evidence-keeps-unlocated-quotes',
            setEvidence(entity('grp_b'), { status: 'not_applicable', unlocated_quotes: 2 })
        ),
        local('golden-not-reported-not-found', setEvidence(slot('grp_b', 'age_mean'), { status: 'not_found' })),
        local(
            'golden-not-reported-not-applicable',
            setEvidence(slot('grp_b', 'age_mean'), { status: 'not_applicable' })
        ),
        local('golden-span-ends-at-text-end', setEvidence(slot('study', 'description'), present(span('3T scanner.')))),
        local('golden-relationship-evidence', setEvidence(link('tasks', 'tsk_1'), present(span('a Stroop task')))),
        refused(
            'golden-span-outside-refused',
            `span 140-200 is outside the paper's ${bundle.text.length} characters`,
            setEvidence(slot('grp_a', 'age_mean'), present({ start_char: 140, end_char: 200 }))
        ),
        refused(
            'golden-span-empty-refused',
            'span start_char 10 is not before end_char 10',
            setEvidence(slot('grp_a', 'age_mean'), present({ start_char: 10, end_char: 10 }))
        ),
        refused(
            'golden-relationship-evidence-refused',
            "'an_1' tasks does not reference 'grp_a'",
            setEvidence(link('tasks', 'grp_a'), present(span('Twenty patients')))
        ),
        refused(
            'golden-relationship-unknown-target',
            "no entity has local_id 'nope'",
            setEvidence(link('tasks', 'nope'), present(span('a Stroop task')))
        ),
        local('golden-accept-unchecked', verdict(slot('an_1', 'name'), 'accept')),
        local('golden-accept-edited-entity', verdict(entity('grp_b'), 'accept')),
        local('golden-reject-edited-entity', verdict(entity('grp_b'), 'reject', 'wrong_entity')),
        local(
            'golden-reject-after-set-value',
            setValue(slot('grp_a', 'age_mean'), reported(36)),
            verdict(slot('grp_a', 'age_mean'), 'reject', 'wrong_entity')
        ),
        local(
            'golden-accept-after-edit',
            setValue(slot('grp_a', 'name'), reported('cases')),
            verdict(slot('grp_a', 'name'), 'accept')
        ),
        local('golden-reject-with-reason', verdict(entity('grp_a'), 'reject', 'wrong_entity')),
        local('golden-accept-relationship', verdict(link('measure', 'msr_1'), 'accept')),
        refused('golden-verdict-refused', "no entity has local_id 'grp_x'", verdict(entity('grp_x'), 'accept')),
        local('golden-note-paper', note({ kind: 'paper' }, 'the tables are in the supplement')),
        local('golden-note-slot', note(slot('grp_a', 'age_mean'), 'check the table')),
        refused(
            'golden-note-refused',
            "field path 'name.value.x' goes through a non-object",
            note(slot('grp_a', 'name.value.x'), 'x')
        ),
        inspected('golden-ui-enter-integer', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('an_1', 'groups[#0].n')));
            press('Enter', {}, document.body);
            fireEvent.change(screen.getByRole('spinbutton', { name: /: n$/ }), { target: { value: '21' } });
            press('Enter');
        }),
        inspected('golden-ui-n-outside-text', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('grp_a', 'age_mean')));
            press('n', {}, document.body);
            fireEvent.change(screen.getByRole('combobox', { name: 'Why not' }), {
                target: { value: 'outside_text' },
            });
            press('Enter');
        }),
        inspected('golden-ui-open-enum', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('grp_a', 'species')));
            press('Enter', {}, document.body);
            fireEvent.change(screen.getByRole('combobox', { name: 'In the paper?' }), {
                target: { value: 'extracted' },
            });
            fireEvent.change(screen.getByRole('combobox', { name: 'Species' }), { target: { value: 'macaque' } });
            press('Enter');
        }),
        inspected('golden-ui-list-add', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('grp_a', 'inclusion_criteria')));
            press('Enter', {}, document.body);
            const add = screen.getByRole('textbox', { name: 'add to Inclusion criteria' });
            fireEvent.change(add, { target: { value: 'adults only' } });
            press('Enter', {}, add);
            press('Enter', {}, add);
        }),
        inspected('golden-ui-shift-a', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('grp_a', 'name')));
            press('A', { shiftKey: true }, document.body);
        }),
        inspected('golden-ui-semicolon-slot', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('grp_a', 'name')));
            press(';', {}, document.body);
            fireEvent.change(screen.getByRole('textbox', { name: 'note on Name' }), {
                target: { value: 'the label is the paper’s' },
            });
            press('Enter');
        }),
        inspected('golden-ui-reject-other-note', (stores) => {
            act(() => stores.view.getState().focusSlot(slotKey('grp_a', 'name')));
            press('r', {}, document.body);
            const panel = screen.getByRole('group', { name: 'reject Name' });
            press('5', {}, within(panel).getByRole('radio', { name: '1 wrong value' }));
            fireEvent.change(within(panel).getByRole('textbox', { name: 'note' }), {
                target: { value: 'the paper calls them patients' },
            });
            press('Enter');
        }),
    ];
}

describe('the golden op file the backend replays', () => {
    const golden = entries();

    it('holds what the store emits for the golden bundle; regenerate with UPDATE_GOLDEN=1', () => {
        const rendered = JSON.stringify(golden, null, 2) + '\n';
        if (process.env.UPDATE_GOLDEN === '1') writeFileSync(OPS, rendered);
        expect(existsSync(OPS)).toBe(true);
        expect(readFileSync(OPS, 'utf8')).toBe(rendered);
    });

    it('records what applyOp gives for each batch: the documents after it, or the refusal it meets', () => {
        const recorded: Entry[] = JSON.parse(readFileSync(OPS, 'utf8'));
        expect(recorded.map((entry) => entry.name)).toEqual(golden.map((entry) => entry.name));
        for (const entry of recorded) {
            if (entry.expect === 'ok') {
                expect(after(applied(entry.ops)), entry.name).toEqual(after(entry as Documents));
            } else {
                expect(() => applied(entry.ops), entry.name).toThrow(entry.expect);
            }
        }
    });

    it('covers each op type applied locally, with a refusal for each', () => {
        const types = (ok: boolean) =>
            new Set(golden.filter((e) => (e.expect === 'ok') === ok).flatMap((e) => e.ops.map((op) => op.type)));
        for (const type of ['set_value', 'set_evidence', 'verdict', 'note']) {
            expect(types(true), type).toContain(type);
            expect(types(false), type).toContain(type);
        }
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
        const stores = createReviewStores(bundle);
        stores.view.getState().focusSlot(slotKey('grp_b', 'age_mean'));
        expect(
            stores.session.getState().addEvidence(stores.view.getState().focus.key, at('eighteen controls'), 0)
        ).toBe(false);
        expect(stores.session.getState().pending).toEqual([]);
    });
});
