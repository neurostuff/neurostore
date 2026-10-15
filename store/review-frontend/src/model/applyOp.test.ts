import type { Provenance } from '../contract/generated/review-bundle';
import type { Evidence } from '../contract/generated/review-ops';
import { entityRows, ev, notReported, row } from '../test/bundles';
import { applyBatch, applyOp, isLocalOp, type ApplyContext, type LocalOp } from './applyOp';
import { getIn } from './paths';
import { codePointPaper, utf16Paper } from './offsets';

const TEXT = 'Twenty patients and eighteen controls performed a Stroop task.';

const record = {
    local_id: 'P1',
    description: ev('A study', [[0, 6]]),
    design: { description: ev('One session') },
    groups: [
        { local_id: 'grp_a', name: ev('Patients'), species: notReported(), age_mean: ev(34.2, [[7, 15]]) },
        { local_id: 'grp_b', name: ev('Controls') },
    ],
    tasks: [{ local_id: 'tsk_1', name: ev('Stroop') }],
    analyses: [{ local_id: 'a_1', tasks: ['tsk_1'], groups: [{ group: 'grp_a', n: ev(20) }] }],
};

const context: ApplyContext = {
    text: utf16Paper(TEXT),
    entities: entityRows(
        row('grp_a', 'Group', 'groups'),
        row('grp_b', 'Group', 'groups'),
        row('tsk_1', 'Task', 'tasks'),
        row('a_1', 'Analysis', 'analyses')
    ),
    provenance: { 'entity:grp_b': { state: 'edited', user_id: 'u0', at: 'then' } },
    annotations: {
        'entity:grp_b': { status: 'present', sets: [{ spans: [{ start_char: 0, end_char: 6, text: 'Twenty' }] }] },
    },
    userId: 'u1',
    at: 'now',
    coordinateParse: { analyses: [{ key: 'analysis#1' }] },
};

const mark = (state: Provenance['state']) => ({ state, user_id: 'u1', at: 'now' });
const slot = (entity: string, path: string) => ({ kind: 'slot', entity, path }) as const;
const tasksOf = (entity: string, target_entity: string) =>
    ({ kind: 'relationship', entity, path: 'tasks', target_entity }) as const;

const evidence: Evidence = {
    status: 'present',
    sets: [{ source: 'model_quote', spans: [{ start_char: 20, end_char: 28 }] }],
    unlocated_quotes: 2,
};
const filled = {
    status: 'present',
    sets: [{ source: 'model_quote', spans: [{ start_char: 20, end_char: 28, text: 'eighteen' }] }],
    unlocated_quotes: 2,
};

const op = (body: object) => ({ client_op_id: 'op-00000001', ...body }) as LocalOp;
const setEvidence = (target: object, value: Evidence = evidence) =>
    op({ type: 'set_evidence', target, evidence: value });
const setValue = (target: object, value: object) => op({ type: 'set_value', target, value });
const verdict = (target: object, verdict: 'accept' | 'reject', reason?: string) =>
    op({ type: 'verdict', target, verdict, ...(reason ? { reason } : {}) });
const apply = (o: LocalOp) => applyOp(record, o, context);

describe('applyOp set_evidence', () => {
    it.each([
        ['study', 'description', ['description']],
        ['study', 'design.description', ['design', 'description']],
        ['grp_b', 'name', ['groups', 1, 'name']],
        ['a_1', 'groups[#0].n', ['analyses', 0, 'groups', 0, 'n']],
    ] as const)('writes on %s %s the evidence with span text from the paper, keeping the rest', (entity, path, at) => {
        const next = apply(setEvidence(slot(entity, path)));
        expect(getIn(next.record, at)).toEqual({ ...(getIn(record, at) as object), evidence: filled });
        expect(next.provenance).toEqual({ ...context.provenance, [`slot:${entity}:${path}`]: mark('edited') });
        expect(next.annotations).toBe(context.annotations);
    });

    it('copies only the objects on the way to the slot', () => {
        const next = apply(setEvidence(slot('grp_b', 'name'))).record;
        expect(next.groups).not.toBe(record.groups);
        expect((next.groups as unknown[])[0]).toBe(record.groups[0]);
        expect(next.analyses).toBe(record.analyses);
    });

    it('puts evidence on an entity or a relationship in the annotations, leaving the record alone', () => {
        const onEntity = apply(setEvidence({ kind: 'entity', entity: 'grp_a' }));
        expect(onEntity.record).toBe(record);
        expect(onEntity.annotations).toEqual({ ...context.annotations, 'entity:grp_a': filled });
        expect(onEntity.provenance['entity:grp_a']).toEqual(mark('edited'));
        const onLink = apply(setEvidence(tasksOf('a_1', 'tsk_1')));
        expect(onLink.annotations['relationship:a_1:tasks:tsk_1']).toEqual(filled);
    });

    it('clears an annotation with {status: not_applicable}, and marks the target edited', () => {
        const next = apply(setEvidence({ kind: 'entity', entity: 'grp_b' }, { status: 'not_applicable' }));
        expect(next.annotations).toEqual({});
        expect(next.provenance['entity:grp_b']).toEqual(mark('edited'));
    });

    it('refuses spans outside the text, spans whose start is not before their end, and present with no set', () => {
        const spans = (start_char: number, end_char: number): Evidence => ({
            status: 'present',
            sets: [{ spans: [{ start_char, end_char }] }],
        });
        expect(() => apply(setEvidence(slot('grp_a', 'name'), spans(0, 500)))).toThrow(
            `span 0-500 is outside the paper's ${TEXT.length} characters`
        );
        expect(() => apply(setEvidence(slot('grp_a', 'name'), spans(9, 9)))).toThrow(
            'span start_char 9 is not before end_char 9'
        );
        expect(() => apply(setEvidence(slot('grp_a', 'name'), { status: 'present' }))).toThrow(
            'present evidence needs at least one set'
        );
    });

    it('refuses present evidence on a slot that is not extracted, a path that is not a slot, and no entity', () => {
        expect(() => apply(setEvidence(slot('grp_a', 'species')))).toThrow(
            'species: evidence needs an extracted value; set a value first'
        );
        expect(() => apply(setEvidence(slot('grp_a', 'age')))).toThrow("'age' on 'grp_a' is not an extracted value");
        expect(() => apply(setEvidence(slot('grp_x', 'name')))).toThrow("no entity has local_id 'grp_x'");
        expect(() => apply(setEvidence(tasksOf('a_1', 'grp_a')))).toThrow("'a_1' tasks does not reference 'grp_a'");
    });

    it('reads a span in code points on a paper with characters outside the BMP, and accepts one ending at its end', () => {
        const astral = { ...context, text: codePointPaper('a\u{1F600} Stroop task.') };
        const spans = (start_char: number, end_char: number): Evidence => ({
            status: 'present',
            sets: [{ spans: [{ start_char, end_char }] }],
        });
        const quoted = applyOp(record, setEvidence(slot('grp_a', 'age_mean'), spans(3, 9)), astral);
        expect(getIn(quoted.record, ['groups', 0, 'age_mean', 'evidence', 'sets', 0, 'spans', 0])).toEqual({
            start_char: 3,
            end_char: 9,
            text: 'Stroop',
        });
        const ending = applyOp(record, setEvidence(slot('grp_a', 'age_mean'), spans(10, 15)), astral);
        expect(getIn(ending.record, ['groups', 0, 'age_mean', 'evidence', 'sets', 0, 'spans', 0])).toMatchObject({
            text: 'task.',
        });
        expect(() => applyOp(record, setEvidence(slot('grp_a', 'age_mean'), spans(10, 16)), astral)).toThrow(
            "span 10-16 is outside the paper's 15 characters"
        );
    });
});

describe('applyOp set_value', () => {
    const ageAt = ['groups', 0, 'age_mean'];

    it('writes the value fields as a group, keeps the evidence, and marks the slot edited', () => {
        const next = apply(setValue(slot('grp_a', 'age_mean'), { extraction_status: 'extracted', value: 35 }));
        expect(getIn(next.record, ageAt)).toEqual({
            extraction_status: 'extracted',
            value: 35,
            evidence: record.groups[0].age_mean!.evidence,
        });
        expect(next.provenance['slot:grp_a:age_mean']).toEqual(mark('edited'));
    });

    it('drops the value and sets the evidence to not_applicable for not_reported', () => {
        const next = apply(
            setValue(slot('grp_a', 'age_mean'), {
                extraction_status: 'not_reported',
                unreported_reason: 'outside_text',
            })
        );
        expect(getIn(next.record, ageAt)).toEqual({
            extraction_status: 'not_reported',
            unreported_reason: 'outside_text',
            evidence: { status: 'not_applicable' },
        });
    });

    it('gives extracted with not_applicable or absent evidence the evidence not_found', () => {
        const fromNotReported = apply(
            setValue(slot('grp_a', 'species'), { extraction_status: 'extracted', value: 'human' })
        );
        expect(getIn(fromNotReported.record, ['groups', 0, 'species'])).toEqual({
            extraction_status: 'extracted',
            value: 'human',
            evidence: { status: 'not_found' },
        });
    });

    it('creates an absent slot, and the absent objects on its way', () => {
        const value = { extraction_status: 'extracted', value: 7 };
        const flat = apply(setValue(slot('grp_b', 'age_mean'), value));
        expect(getIn(flat.record, ['groups', 1, 'age_mean'])).toEqual({ ...value, evidence: { status: 'not_found' } });
        const nested = apply(setValue(slot('a_1', 'effect.statistic.df'), value));
        expect(getIn(nested.record, ['analyses', 0, 'effect'])).toEqual({
            statistic: { df: { ...value, evidence: { status: 'not_found' } } },
        });
    });

    it('refuses a path that holds no extracted value, an item past the end, and no entity', () => {
        const value = { extraction_status: 'extracted', value: 1 };
        expect(() => apply(setValue(slot('a_1', 'groups[#0]'), value))).toThrow(
            "'groups[#0]' on 'a_1' is not an extracted value"
        );
        expect(() => apply(setValue(slot('a_1', 'groups[#3].n'), value))).toThrow(
            "field path 'groups[#3].n': no item at position 3"
        );
        expect(() => apply(setValue(slot('grp_x', 'name'), value))).toThrow("no entity has local_id 'grp_x'");
    });
});

describe('applyOp verdict', () => {
    it('accepts an unchecked target as verified, and rejects one as removed', () => {
        expect(apply(verdict(slot('grp_a', 'name'), 'accept')).provenance['slot:grp_a:name']).toEqual(mark('verified'));
        const rejected = apply(verdict({ kind: 'entity', entity: 'grp_a' }, 'reject', 'wrong_value'));
        expect(rejected.provenance['entity:grp_a']).toEqual(mark('removed'));
        expect(rejected.record).toBe(record);
        expect(rejected.annotations).toBe(context.annotations);
    });

    it('never downgrades an edited or added target to verified', () => {
        expect(apply(verdict({ kind: 'entity', entity: 'grp_b' }, 'accept')).provenance).toEqual(context.provenance);
        const edited = applyOp(
            record,
            setValue(slot('grp_a', 'name'), { extraction_status: 'extracted', value: 'x' }),
            context
        );
        const accepted = applyOp(edited.record, verdict(slot('grp_a', 'name'), 'accept'), { ...context, ...edited });
        expect(accepted.provenance['slot:grp_a:name']).toEqual(mark('edited'));
        const added = { ...context, provenance: { 'entity:grp_a': mark('added') } };
        expect(applyOp(record, verdict({ kind: 'entity', entity: 'grp_a' }, 'accept'), added).provenance).toEqual(
            added.provenance
        );
    });

    it('accepts a relationship, the paper and a coordinate analysis', () => {
        expect(apply(verdict(tasksOf('a_1', 'tsk_1'), 'accept')).provenance).toHaveProperty(
            ['relationship:a_1:tasks:tsk_1'],
            mark('verified')
        );
        expect(apply(verdict({ kind: 'paper' }, 'accept')).provenance.paper).toEqual(mark('verified'));
        expect(
            apply(verdict({ kind: 'coordinate_analysis', analysis_key: 'analysis#1' }, 'accept')).provenance
        ).toHaveProperty(['coordinate_analysis:analysis#1'], mark('verified'));
    });

    it('refuses a target that is not in the documents', () => {
        expect(() => apply(verdict({ kind: 'entity', entity: 'grp_x' }, 'accept'))).toThrow(
            "no entity has local_id 'grp_x'"
        );
        expect(() => apply(verdict(slot('grp_a', 'name.value.x'), 'accept'))).toThrow(
            "field path 'name.value.x' goes through a non-object"
        );
        expect(() => apply(verdict(tasksOf('a_1', 'grp_b'), 'accept'))).toThrow(
            "'a_1' tasks does not reference 'grp_b'"
        );
        expect(() => apply(verdict({ ...tasksOf('a_1', 'tsk_1'), path: 'name' }, 'accept'))).toThrow(
            "'name' on 'a_1' is not a reference slot"
        );
        expect(() => apply(verdict({ kind: 'coordinate_analysis', analysis_key: 'analysis#9' }, 'accept'))).toThrow(
            "the coordinate parse has no analysis 'analysis#9'"
        );
    });
});

describe('applyOp note', () => {
    it('changes no document', () => {
        const next = apply(op({ type: 'note', target: slot('grp_a', 'name'), note: 'check the table' }));
        expect(next).toEqual({ record, provenance: context.provenance, annotations: context.annotations });
        expect(next.record).toBe(record);
    });

    it('refuses a target that is not in the documents', () => {
        expect(() => apply(op({ type: 'note', target: { kind: 'entity', entity: 'grp_x' }, note: 'x' }))).toThrow(
            "no entity has local_id 'grp_x'"
        );
    });
});

const thrown = (run: () => unknown) => {
    try {
        run();
    } catch (error) {
        return error;
    }
};

describe('applyOp relationships', () => {
    it('refuses a reference slot the entity’s class does not have, though another class has one of that name', () => {
        expect(thrown(() => apply(setEvidence(tasksOf('grp_a', 'tsk_1'))))).toMatchObject({
            message: "'tasks' on 'grp_a' is not a reference slot",
        });
    });
});

describe('applyBatch', () => {
    const documents = { record, provenance: context.provenance, annotations: context.annotations };
    const paper = {
        text: context.text,
        userId: context.userId,
        at: context.at,
        coordinateParse: context.coordinateParse,
        entities: context.entities,
    };
    const named = (id: string, body: object) => ({ ...op(body), client_op_id: id });

    it('applies the ops in order, each on the documents the one before made', () => {
        const next = applyBatch(
            documents,
            [
                setValue(slot('grp_a', 'age_mean'), { extraction_status: 'extracted', value: 35 }),
                verdict(slot('grp_a', 'age_mean'), 'accept'),
            ],
            paper
        );
        expect(getIn(next.record, ['groups', 0, 'age_mean', 'value'])).toBe(35);
        expect(next.provenance['slot:grp_a:age_mean']).toEqual(mark('edited'));
    });

    it('throws naming the first op that cannot apply, and leaves the documents as they were', () => {
        const batch = [
            verdict(slot('grp_a', 'name'), 'accept'),
            named('second', verdict({ kind: 'entity', entity: 'grp_x' }, 'accept')),
        ];
        const before = structuredClone(documents);
        expect(thrown(() => applyBatch(documents, batch, paper))).toMatchObject({
            index: 1,
            clientOpId: 'second',
            message: "no entity has local_id 'grp_x'",
        });
        expect(documents).toEqual(before);
    });

    it.each([
        ['a structural op', { type: 'create_entity', parent: 'study', list: 'groups', entity: {} }],
        [
            'an op on a keyed path',
            setValue(slot('grp_a', 'groups[name=x].age_mean'), { extraction_status: 'extracted' }),
        ],
    ])('refuses %s, which the server applies', (_, body) => {
        expect(thrown(() => applyBatch(documents, [op(body)], paper))).toMatchObject({
            index: 0,
            message: `a ${(body as { type: string }).type} op is applied by the server`,
        });
    });

    it('takes a keyed path out of the ops applied locally', () => {
        expect(isLocalOp(setValue(slot('grp_a', 'age_mean'), {}) as never)).toBe(true);
        expect(isLocalOp(setValue(slot('grp_a', 'groups[name=x].age_mean'), {}) as never)).toBe(false);
    });
});
