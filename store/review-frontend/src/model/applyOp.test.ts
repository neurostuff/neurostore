import type { Evidence, Op } from '../contract/generated/review-ops';
import { ev, notReported } from '../test/bundles';
import { applyOp } from './applyOp';
import { getIn } from './paths';

const record = {
    local_id: 'P1',
    description: ev('A study', [[0, 4]]),
    design: { description: ev('One session') },
    groups: [
        { local_id: 'grp_a', name: ev('Patients'), species: notReported() },
        { local_id: 'grp_b', name: ev('Controls') },
    ],
    analyses: [{ local_id: 'a_1', groups: [{ group: 'grp_a', n: ev(20) }] }],
};

const evidence: Evidence = {
    status: 'present',
    sets: [{ source: 'model_quote', spans: [{ start_char: 5, end_char: 9 }] }],
    unlocated_quotes: 2,
};

const setEvidence = (target: { kind: 'slot'; entity: string; path: string } | { kind: 'entity'; entity: string }) =>
    ({ client_op_id: 'op-00000001', type: 'set_evidence', target, evidence }) as Op;

describe('applyOp', () => {
    it.each([
        ['study', 'description', ['description']],
        ['study', 'design.description', ['design', 'description']],
        ['grp_b', 'name', ['groups', 1, 'name']],
        ['a_1', 'groups[#0].n', ['analyses', 0, 'groups', 0, 'n']],
    ] as const)('writes set_evidence on %s %s into the slot, keeping the rest of the slot', (entity, path, at) => {
        const next = applyOp(record, setEvidence({ kind: 'slot', entity, path }));
        const before = getIn(record, at) as object;
        expect(getIn(next, at)).toEqual({ ...before, evidence });
        expect(before).not.toHaveProperty('evidence', evidence);
    });

    it('copies only the objects on the way to the slot', () => {
        const next = applyOp(record, setEvidence({ kind: 'slot', entity: 'grp_b', path: 'name' }));
        expect(next.groups).not.toBe(record.groups);
        expect((next.groups as unknown[])[0]).toBe(record.groups[0]);
        expect(next.analyses).toBe(record.analyses);
    });

    it('leaves the record unchanged for evidence on an entity, which the review keeps', () => {
        expect(applyOp(record, setEvidence({ kind: 'entity', entity: 'grp_a' }))).toBe(record);
    });

    it('refuses present evidence on a slot that is not extracted, and a path that is not a slot', () => {
        expect(() => applyOp(record, setEvidence({ kind: 'slot', entity: 'grp_a', path: 'species' }))).toThrow(
            'set a value first'
        );
        expect(() => applyOp(record, setEvidence({ kind: 'slot', entity: 'grp_a', path: 'age' }))).toThrow('no slot');
        expect(() => applyOp(record, setEvidence({ kind: 'slot', entity: 'grp_x', path: 'name' }))).toThrow(
            'no entity grp_x'
        );
    });

    it('refuses op types it does not apply yet', () => {
        const note = { client_op_id: 'op-00000002', type: 'note', target: { kind: 'paper' }, note: 'x' } as Op;
        expect(() => applyOp(record, note)).toThrow('note');
    });
});
