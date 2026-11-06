import Ajv2019, { type ErrorObject } from 'ajv/dist/2019.js';
import type { CreateEntityOp } from '../contract/generated/review-ops';
import { entityPath, getIn, setIn, type Json } from '../model/paths';
import extractionSchema from './golden/schemas/extraction-record.schema.json' with { type: 'json' };

/** The golden extraction-record schema. */
export const EXTRACTION_SCHEMA = extractionSchema;

const ajv = new Ajv2019({ allErrors: true, strict: false, logger: false });
const validateRecord = ajv.compile(extractionSchema);

/**
 * An error as `extraction-record /<path>: <message>`. Only a missing required property is worded as the server words
 * it (`'x' is a required property`); other messages are Ajv's.
 */
const worded = ({ instancePath, keyword, params, message }: ErrorObject) =>
    `extraction-record ${instancePath || '/'}: ${
        keyword === 'required'
            ? `'${(params as { missingProperty: string }).missingProperty}' is a required property`
            : message
    }`;

/** What is wrong with an extraction record under the golden extraction-record schema; empty when nothing is. */
export function recordProblems(record: unknown): string[] {
    return validateRecord(record) ? [] : (validateRecord.errors ?? []).map(worded);
}

/** The local_id a created entity is placed with when its op names none, as the server mints one. */
export const CREATED_ID = 'created_entity';

/** `record` with `op`'s entity at the end of its list, given CREATED_ID when it has no local_id. */
export function withCreated(record: Json, op: CreateEntityOp): Json {
    const at = [...entityPath(record, op.parent)!, ...op.list.split('.')];
    const entity = { local_id: CREATED_ID, ...op.entity };
    return setIn(record, at, [...((getIn(record, at) as unknown[] | undefined) ?? []), entity]);
}

/** The problems `op`'s entity brings into `record`: those of the record with it placed that the record lacks. */
export function problemsWithCreated(record: Json, op: CreateEntityOp): string[] {
    const old = new Set(recordProblems(record));
    return recordProblems(withCreated(record, op)).filter((problem) => !old.has(problem));
}
