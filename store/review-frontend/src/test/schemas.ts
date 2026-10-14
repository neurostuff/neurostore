import Ajv2020 from 'ajv/dist/2020';
import bundleSchema from '../../../backend/neurostore/review/schema/review-bundle.schema.json';
import opsSchema from '../../../backend/neurostore/review/schema/review-ops.schema.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema({ ...opsSchema, $id: new URL('review-ops.schema.json', bundleSchema.$id).href });

export const validateBundle = ajv.compile(bundleSchema);
export const validateOpBatch = ajv.compile({ ...opsSchema, $id: undefined });
