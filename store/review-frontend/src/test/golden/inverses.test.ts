import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Op } from '../../contract/generated/review-ops';
import { entityPath, getIn, readPath, setIn, parsePath, type Json } from '../../model/paths';
import { targetKey } from '../../model/targetKey';
import { type Documents } from '../../model/applyOp';
import { inverseOf } from '../memoryBackend';
import type { InverseOp } from '../../store/undoSteps';

interface Step {
    request: { method: string; path: string; body: unknown };
    response: { status: number; body: unknown };
}

interface Scenario {
    name: string;
    steps: Step[];
}

interface StoredWithInverse {
    seq: number;
    op: Op;
    before: unknown;
    after: unknown;
    inverse: InverseOp[];
}

const SCENARIOS: Scenario[] = JSON.parse(readFileSync(path.resolve(__dirname, 'op-scenarios.json'), 'utf8'));

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
/** The golden file's masking of timestamps, applied to what the fake computes. */
const masked = (value: unknown): unknown => {
    if (typeof value === 'string') return ISO.test(value) ? '<iso>' : value;
    if (Array.isArray(value)) return value.map(masked);
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, masked(item)]));
    return value;
};

/** `record` with the wrapper at a slot's path replaced by `wrapper`; undefined removes it. */
function withWrapper(record: Json, target: { entity: string; path: string }, wrapper: unknown): Json {
    return setIn(record, [...(entityPath(record, target.entity) ?? []), ...parsePath(target.path)], wrapper);
}

/** The documents an op ran against (`logged` is its logged before) or produced (its logged after). */
function documentsAround(record: Json, op: Op, logged: unknown): Documents {
    if (op.type === 'verdict') {
        const entry = op.target.kind === 'coordinate_analysis' ? (logged as { provenance: unknown }).provenance : logged;
        return { record, provenance: { [targetKey(op.target)]: entry }, annotations: {} } as Documents;
    }
    if (op.type === 'set_evidence' && op.target.kind === 'slot') {
        const current = readPath(getIn(record, entityPath(record, op.target.entity) ?? []), op.target.path);
        const wrapper = { ...(current as Json), evidence: logged };
        return { record: withWrapper(record, op.target, wrapper), provenance: {}, annotations: {} } as Documents;
    }
    if (op.type === 'set_evidence')
        return { record, provenance: {}, annotations: { [targetKey(op.target)]: logged } } as Documents;
    if (op.type === 'set_value') return { record: withWrapper(record, op.target, logged), provenance: {}, annotations: {} } as Documents;
    return { record, provenance: {}, annotations: {} };
}

const MIRRORED = new Set(['set_value', 'set_evidence', 'verdict']);

/** Every op of a golden POST response that carries an inverse the fake mirrors, with the documents around it. */
const cases = SCENARIOS.flatMap((scenario) =>
    scenario.steps.flatMap((step) => {
        const body = step.response.body as { ops?: StoredWithInverse[]; record?: Json } | null;
        if (step.request.method !== 'POST' || !body?.ops || !body.record) return [];
        return body.ops
            .filter((stored) => stored.inverse && MIRRORED.has(stored.op.type))
            .map((stored) => ({ name: `${scenario.name}, op ${stored.seq}`, record: body.record!, stored }));
    })
);

describe('the fake server computes the inverses the backend recorded', () => {
    it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, { record, stored }) => {
        const before = documentsAround(record, stored.op, stored.before);
        const after = documentsAround(record, stored.op, stored.after);
        expect(masked(inverseOf(stored.op, before, after))).toEqual(masked(stored.inverse));
    });

    it('has cases for set_value, set_evidence and verdict', () => {
        expect(new Set(cases.map((c) => c.stored.op.type))).toEqual(new Set(MIRRORED));
    });
});
