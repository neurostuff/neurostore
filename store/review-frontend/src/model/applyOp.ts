import type { Op } from '../contract/generated/review-ops';
import { entityPath, getIn, parsePath, setIn, type Json } from './paths';
import { isExtractedValue } from './record';

export function applyOp(record: Json, op: Op): Json {
    if (op.type !== 'set_evidence') throw new Error(`applyOp cannot apply ${op.type} ops yet`);
    const { target, evidence } = op;
    if (target.kind !== 'slot') return record;
    const at = entityPath(record, target.entity);
    if (!at) throw new Error(`no entity ${target.entity}`);
    const steps = [...at, ...parsePath(target.path)];
    const wrapper = getIn(record, steps);
    if (!isExtractedValue(wrapper)) throw new Error(`${target.entity} has no slot ${target.path}`);
    if (evidence.status === 'present' && wrapper.extraction_status !== 'extracted') {
        throw new Error(`${target.path}: evidence needs an extracted value; set a value first`);
    }
    return setIn(record, steps, { ...wrapper, evidence });
}
