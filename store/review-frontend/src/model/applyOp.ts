import type { Annotation, Provenance, ReviewBundle } from '../contract/generated/review-bundle';
import type {
    AnyTarget,
    Evidence,
    Op,
    RelationshipTarget,
    SetEvidenceOp,
    SetValueOp,
    SlotTarget,
    VerdictOp,
} from '../contract/generated/review-ops';
import { type CoordinateParse, knownAnalysis } from './coordinates';
import type { PaperText } from './offsets';
import {
    entityPath,
    getIn,
    isKeyedPath,
    isObject,
    ownerOf,
    parsePath,
    readPath,
    setIn,
    writePath,
    type Json,
    type Step,
} from './paths';
import { isExtractedValue, isReferenceSlot, type ExtractedValue } from './record';
import { targetKey } from './targetKey';

export type ProvenanceMap = Record<string, Provenance>;
export type AnnotationMap = Record<string, Annotation>;
type EntityRow = ReviewBundle['entities'][number];

export interface Documents {
    record: Json;
    provenance: ProvenanceMap;
    annotations: AnnotationMap;
}

export interface ApplyContext {
    text: PaperText;
    provenance: ProvenanceMap;
    annotations: AnnotationMap;
    userId: string;
    at: string;
    coordinateParse?: CoordinateParse | null;
    coordinateRevision?: CoordinateParse | null;
    entities: EntityRow[];
}

/** The paper and the batch's author and time: an ApplyContext without the documents. */
export type Paper = Omit<ApplyContext, 'provenance' | 'annotations'>;

const LOCAL_TYPES = ['verdict', 'note', 'set_value', 'set_evidence'] as const;
const LOCAL = new Set<string>(LOCAL_TYPES);
const VALUE_FIELDS = new Set(['extraction_status', 'value', 'value_source', 'unreported_reason']);
const NO_EVIDENCE: Evidence = { status: 'not_applicable' };

export type LocalOp = Extract<Op, { type: (typeof LOCAL_TYPES)[number] }>;
type NoteOp = Extract<Op, { type: 'note' }>;

/** An op the store applies at once: a local type, on a path the server does not have to resolve. */
export const isLocalOp = (op: Op): op is LocalOp =>
    LOCAL.has(op.type) && !('target' in op && 'path' in op.target && isKeyedPath(op.target.path));

/** A refused op: the index it has in its batch, its client_op_id and the core's message. */
export class OpRefused extends Error {
    readonly index: number;
    readonly clientOpId: string;

    constructor(index: number, clientOpId: string, message: string) {
        super(message);
        this.name = 'OpRefused';
        this.index = index;
        this.clientOpId = clientOpId;
    }
}

const quoted = (text: string) => `'${text}'`;

function entityAt(record: Json, id: string): { at: Step[]; item: Json } {
    const at = entityPath(record, id);
    if (!at) throw new Error(`no entity has local_id ${quoted(id)}`);
    return { at, item: getIn(record, at) as Json };
}

function asWrapper(value: unknown, target: SlotTarget): ExtractedValue {
    if (!isExtractedValue(value)) {
        throw new Error(`${quoted(target.path)} on ${quoted(target.entity)} is not an extracted value`);
    }
    return value;
}

function wrapperAt(item: Json, target: SlotTarget): ExtractedValue {
    return asWrapper(readPath(item, target.path), target);
}

function optionalWrapperAt(item: Json, target: SlotTarget): ExtractedValue | undefined {
    const value = readPath(item, target.path);
    return value === undefined || value === null ? undefined : asWrapper(value, target);
}

/** The ids a relationship target links from its reference slot, after checking the slot and the entities. */
function relationship(record: Json, target: RelationshipTarget, context: ApplyContext, mustExist: boolean): unknown[] {
    const { item } = entityAt(record, target.entity);
    const { owner, attribute, position } = ownerOf(item, target.path);
    const where = `${quoted(target.path)} on ${quoted(target.entity)}`;
    if (!isObject(owner)) throw new Error(`${where} goes through a missing object`);
    const row = context.entities.find((entity) => entity.local_id === target.entity);
    const nested = parsePath(target.path).length > 1;
    if (position !== null || !row || !isReferenceSlot(row, nested, attribute)) {
        throw new Error(`${where} is not a reference slot`);
    }
    entityAt(record, target.target_entity);
    const value = owner[attribute];
    const ids = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
    if (mustExist && !ids.includes(target.target_entity)) {
        throw new Error(`${quoted(target.entity)} ${target.path} does not reference ${quoted(target.target_entity)}`);
    }
    return ids;
}

function check(record: Json, target: AnyTarget, context: ApplyContext) {
    switch (target.kind) {
        case 'slot':
            readPath(entityAt(record, target.entity).item, target.path);
            return;
        case 'entity':
            entityAt(record, target.entity);
            return;
        case 'relationship':
            relationship(record, target, context, true);
            return;
        case 'coordinate_analysis':
            knownAnalysis(context.coordinateParse, context.coordinateRevision, target.analysis_key);
    }
}

function filled(evidence: Evidence, text: PaperText): Annotation {
    const { sets = [], ...rest } = evidence;
    if (evidence.status === 'present' && sets.length === 0) throw new Error('present evidence needs at least one set');
    const filledSets = sets.map(({ spans, ...set }) => ({
        ...set,
        spans: spans.map(({ start_char: start, end_char: end }) => {
            if (start >= end) throw new Error(`span start_char ${start} is not before end_char ${end}`);
            if (end > text.length) {
                throw new Error(`span ${start}-${end} is outside the paper's ${text.length} characters`);
            }
            return { start_char: start, end_char: end, text: text.slice(start, end) };
        }),
    }));
    return (filledSets.length ? { ...rest, sets: filledSets } : rest) as Annotation;
}

const isNoEvidence = (evidence: Annotation) =>
    evidence.status === NO_EVIDENCE.status && Object.keys(evidence).length === 1;

function marked(context: ApplyContext, key: string, state: Provenance['state']): ProvenanceMap {
    return { ...context.provenance, [key]: { state, user_id: context.userId, at: context.at } };
}

/** The provenance after an accept: an edited or added target keeps its state, any other becomes verified. */
function accepted(context: ApplyContext, key: string): ProvenanceMap {
    const state = context.provenance[key]?.state;
    return state === 'edited' || state === 'added' ? context.provenance : marked(context, key, 'verified');
}

/** The provenance after a verdict: a clear drops the target's entry, a restore puts back the one it carries. */
function judged(context: ApplyContext, key: string, op: VerdictOp): ProvenanceMap {
    switch (op.verdict) {
        case 'accept':
            return accepted(context, key);
        case 'reject':
            return marked(context, key, 'removed');
        case 'clear':
            return Object.fromEntries(Object.entries(context.provenance).filter(([k]) => k !== key));
        case 'restore':
            return { ...context.provenance, [key]: op.previous as Provenance };
    }
}

function verdict(record: Json, op: VerdictOp, context: ApplyContext): Documents {
    check(record, op.target, context);
    const provenance = judged(context, targetKey(op.target), op);
    return { record, provenance, annotations: context.annotations };
}

function note(record: Json, op: NoteOp, context: ApplyContext): Documents {
    check(record, op.target, context);
    return { record, provenance: context.provenance, annotations: context.annotations };
}

function setValue(record: Json, op: SetValueOp, context: ApplyContext): Documents {
    const { target } = op;
    const { at, item } = entityAt(record, target.entity);
    const before = optionalWrapperAt(item, target) ?? {};
    const wrapper: Json = {
        ...Object.fromEntries(Object.entries(before).filter(([field]) => !VALUE_FIELDS.has(field))),
        ...op.value,
    };
    if (wrapper.extraction_status === 'not_reported') {
        delete wrapper.value;
        wrapper.evidence = { ...NO_EVIDENCE };
    } else if (((wrapper.evidence as Evidence | undefined)?.status ?? 'not_applicable') === 'not_applicable') {
        wrapper.evidence = { status: 'not_found' };
    }
    return {
        record: setIn(record, at, writePath(item, target.path, wrapper)),
        provenance: marked(context, targetKey(target), 'edited'),
        annotations: context.annotations,
    };
}

function setEvidence(record: Json, op: SetEvidenceOp, context: ApplyContext): Documents {
    const { target } = op;
    const evidence = filled(op.evidence, context.text);
    const key = targetKey(target);
    const provenance = marked(context, key, 'edited');
    if (target.kind === 'slot') {
        const { at, item } = entityAt(record, target.entity);
        const wrapper = wrapperAt(item, target);
        if (evidence.status === 'present' && wrapper.extraction_status !== 'extracted') {
            throw new Error(`${target.path}: evidence needs an extracted value; set a value first`);
        }
        const next = writePath(item, target.path, { ...wrapper, evidence });
        return { record: setIn(record, at, next), provenance, annotations: context.annotations };
    }
    check(record, target, context);
    const annotations = Object.fromEntries(Object.entries(context.annotations).filter(([k]) => k !== key));
    if (!isNoEvidence(evidence)) annotations[key] = evidence;
    return { record, provenance, annotations };
}

/** The documents after `op`, applied as the review core applies it; throws the core's refusal. */
export function applyOp(record: Json, op: LocalOp, context: ApplyContext): Documents {
    switch (op.type) {
        case 'verdict':
            return verdict(record, op, context);
        case 'note':
            return note(record, op, context);
        case 'set_value':
            return setValue(record, op, context);
        case 'set_evidence':
            return setEvidence(record, op, context);
    }
}

/**
 * The documents after `ops` in order, each op applied on the one before: the first op that is refused
 * throws an OpRefused naming it, and the documents passed in are not changed.
 */
export function applyBatch(documents: Documents, ops: Op[], paper: Paper): Documents {
    return ops.reduce((current, op, index) => {
        if (!isLocalOp(op)) throw new OpRefused(index, op.client_op_id, `a ${op.type} op is applied by the server`);
        try {
            return applyOp(current.record, op, { ...current, ...paper });
        } catch (error) {
            throw new OpRefused(index, op.client_op_id, (error as Error).message);
        }
    }, documents);
}
