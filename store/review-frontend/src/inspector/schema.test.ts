import extractionSchema from '../test/golden/schemas/extraction-record.schema.json';
import { classOf, pick, referenceTarget, skeletonOf, wrapperSchemaAt, type Schema } from '../model/schema';
import { editorFor, parseScalar, wrapperSpec } from './schema';

const root = extractionSchema as Schema;
const row = (entity_class: string, schema_class = entity_class) => ({ entity_class, schema_class });

describe('slot schemas from the extraction record schema', () => {
    it.each([
        ['Group', 'age_mean', 'ExtractedNumber'],
        ['Study', 'description', 'ExtractedString'],
        ['Analysis', 'groups[#0].n', 'ExtractedInteger'],
        ['Group', 'species', 'ExtractedSpecies'],
    ])('finds the wrapper of %s.%s', (className, path, title) => {
        expect(wrapperSchemaAt(root, className, path)?.title).toBe(title);
    });

    it('finds no wrapper for a path the class lacks', () => {
        expect(wrapperSchemaAt(root, 'Group', 'no_such_slot')).toBeUndefined();
    });

    it('reads the statuses, unreported reasons and value sources from the wrapper', () => {
        const spec = wrapperSpec(root, wrapperSchemaAt(root, 'Group', 'age_mean')!);
        expect(spec.statuses).toEqual(['extracted', 'not_reported']);
        expect(spec.reasons).toEqual(['ambiguous', 'outside_text', 'cited_elsewhere', 'undetermined']);
        expect(spec.sources).toEqual(['reported', 'generated']);
        expect(spec.value).toEqual({ kind: 'number', integer: false });
    });

    it.each([
        ['Analysis', 'measure', 'Measure'],
        ['Acquisition', 'device', 'Device'],
        ['Analysis', 'groups[#0].group', 'Group'],
    ])('names the target class of the reference slot %s.%s', (className, path, target) => {
        expect(referenceTarget(row(className), path)).toBe(target);
    });

    it('finds a reference slot by the schema class of a subclassed entity', () => {
        expect(referenceTarget(row('Acquisition', 'MRI'), 'device')).toBe('Device');
    });
});

describe('editor kinds from a value schema', () => {
    it.each<[string, Schema, unknown]>([
        ['text', { type: ['string', 'null'] }, { kind: 'text' }],
        [
            'integer',
            { type: ['integer', 'null'], minimum: 0, maximum: 10 },
            { kind: 'number', integer: true, minimum: 0, maximum: 10 },
        ],
        ['number', { type: 'number', exclusiveMinimum: 0 }, { kind: 'number', integer: false, exclusiveMinimum: 0 }],
        ['boolean', { type: ['boolean', 'null'] }, { kind: 'boolean' }],
        [
            'closed enum',
            { anyOf: [{ enum: ['a', 'b'] }, { type: 'null' }] },
            { kind: 'enum', options: ['a', 'b'], open: false },
        ],
        [
            'open enum',
            { anyOf: [{ $ref: '#/$defs/E' }, { type: 'string' }, { type: 'null' }] },
            { kind: 'enum', options: ['x', 'y'], open: true },
        ],
        [
            'list',
            { type: ['array', 'null'], items: { type: 'integer' } },
            { kind: 'list', item: { kind: 'number', integer: true } },
        ],
        ['any', {}, undefined],
    ])('gives a %s editor', (_, value, expected) => {
        const fragmentRoot = { $defs: { E: { enum: ['x', 'y'], type: 'string' } } };
        expect(editorFor(fragmentRoot, value)).toEqual(expected);
    });
});

describe('parsing what is typed', () => {
    it.each<[string, Parameters<typeof parseScalar>[0], string, ReturnType<typeof parseScalar>]>([
        ['an integer', { kind: 'number', integer: true }, '12', { value: 12 }],
        [
            'a fraction where an integer is wanted',
            { kind: 'number', integer: true },
            '1.5',
            { error: 'must be a whole number' },
        ],
        ['text where a number is wanted', { kind: 'number', integer: false }, 'abc', { error: 'must be a number' }],
        [
            'a number under the minimum',
            { kind: 'number', integer: false, minimum: 0 },
            '-1',
            { error: 'must be at least 0' },
        ],
        [
            'a number over the maximum',
            { kind: 'number', integer: false, maximum: 5 },
            '6',
            { error: 'must be at most 5' },
        ],
        [
            'a number at an exclusive minimum',
            { kind: 'number', integer: false, exclusiveMinimum: 0 },
            '0',
            { error: 'must be more than 0' },
        ],
        [
            'a number at an exclusive maximum',
            { kind: 'number', integer: false, exclusiveMaximum: 1 },
            '1',
            { error: 'must be less than 1' },
        ],
        ['text under minLength', { kind: 'text', minLength: 3 }, 'ab', { error: 'must be at least 3 characters' }],
        ['text over maxLength', { kind: 'text', maxLength: 2 }, 'abc', { error: 'must be at most 2 characters' }],
        ['text off the pattern', { kind: 'text', pattern: '^[a-z]+$' }, 'A1', { error: 'must match ^[a-z]+$' }],
        [
            'a value off a closed enum',
            { kind: 'enum', options: ['a', 'b'], open: false },
            'c',
            { error: 'must be one of: a, b' },
        ],
        ['own wording in an open enum', { kind: 'enum', options: ['a'], open: true }, 'mine', { value: 'mine' }],
        ['a boolean word', { kind: 'boolean' }, 'false', { value: false }],
        ['nothing', { kind: 'text' }, '  ', { error: 'enter a value, or set the status to not reported' }],
    ])('%s', (_, spec, raw, expected) => {
        expect(parseScalar(spec, raw)).toEqual(expected);
    });
});

describe('picking a class from its value, on schema fragments', () => {
    const subclass = (name: string, discriminator: string, extra: Schema = {}): Schema => ({
        type: 'object',
        properties: { local_id: {}, [discriminator]: { enum: [name] }, modality: {}, ...extra },
        required: ['local_id', discriminator, 'modality'],
    });
    const defs = {
        $defs: {
            MRI: subclass('MRI', 'acquisition_type'),
            EEG: subclass('EEG', 'acquisition_type'),
            DecodingDetails: {
                type: 'object',
                properties: { details_type: { enum: ['DecodingDetails'] }, x: {} },
                required: ['details_type', 'x'],
            },
            ConnectivityDetails: {
                type: 'object',
                properties: { details_type: { enum: ['ConnectivityDetails'] }, y: {} },
                required: ['details_type'],
            },
            Wide: { type: 'object', properties: { a: {}, c: {} }, required: ['a', 'c'] },
            Plain: { type: 'object', properties: { a: {}, b: {} }, required: ['a'] },
            ExtractedWhole: {
                type: 'object',
                properties: { extraction_status: {}, value: {}, evidence: {} },
                required: ['extraction_status', 'evidence'],
            },
            ExtractedHalf: {
                type: 'object',
                properties: { extraction_status: {}, value: {} },
                required: ['extraction_status'],
            },
            Holder: {
                type: 'object',
                properties: { whole: { $ref: '#/$defs/ExtractedWhole' }, half: { $ref: '#/$defs/ExtractedHalf' } },
            },
        },
    };

    it('takes the branch whose required keys and properties fit the value', () => {
        expect(pick(defs, ['Plain', 'Wide'], { a: 'x', c: 'y' })).toBe('Wide');
        expect(pick(defs, ['Plain', 'Wide'], { a: 'x', b: 'y' })).toBe('Plain');
    });

    it('rejects a branch whose single-value property differs from the value', () => {
        expect(pick(defs, ['MRI', 'EEG'], { local_id: 'a', acquisition_type: 'EEG', modality: 'x' })).toBe('EEG');
        expect(pick(defs, ['MRI', 'EEG'], { local_id: 'a', acquisition_type: 'MRI', modality: 'x' })).toBe('MRI');
        expect(pick(defs, ['ConnectivityDetails', 'DecodingDetails'], { details_type: 'DecodingDetails' })).toBe(
            'DecodingDetails'
        );
    });

    it('lets a key one branch fixes decide, even when that branch lacks required keys', () => {
        expect(pick(defs, ['ConnectivityDetails', 'DecodingDetails'], { details_type: 'DecodingDetails' })).toBe(
            'DecodingDetails'
        );
        expect(pick(defs, ['MRI', 'EEG'], { local_id: 'a', acquisition_type: 'EEG' })).toBe('EEG');
    });

    it('falls back to the first object branch when none fits', () => {
        expect(pick(defs, ['MRI', 'EEG'], { z: 1 })).toBe('MRI');
    });

    it('reads the refs of a property schema, directly or through its items', () => {
        expect(
            classOf(
                defs,
                { anyOf: [{ $ref: '#/$defs/Plain' }, { $ref: '#/$defs/Wide' }, { type: 'null' }] },
                { a: 'x', c: 'y' }
            )
        ).toBe('Wide');
        expect(
            classOf(
                defs,
                { type: ['array', 'null'], items: { anyOf: [{ $ref: '#/$defs/Plain' }, { $ref: '#/$defs/Wide' }] } },
                { a: 'x', c: 'y' }
            )
        ).toBe('Wide');
    });

    it('takes a wrapper to be a class with both extraction_status and evidence', () => {
        expect(wrapperSchemaAt(defs, 'Holder', 'whole')?.properties).toHaveProperty('evidence');
        expect(wrapperSchemaAt(defs, 'Holder', 'half')).toBeUndefined();
    });

    it('drops oneOf: a oneOf alone allows any value', () => {
        expect(editorFor(defs, { oneOf: [{ type: 'string' }] })).toBeUndefined();
    });

    it('sets a new entity’s required slots: wrappers not reported, a single-value discriminator to its value', () => {
        const withNeeds = {
            $defs: {
                ...defs.$defs,
                Needy: {
                    type: 'object',
                    properties: { local_id: {}, whole: { $ref: '#/$defs/ExtractedWhole' }, kind: { enum: ['Needy'] } },
                    required: ['local_id', 'whole', 'kind'],
                },
            },
        };
        expect(skeletonOf(withNeeds, 'Needy').entity).toEqual({
            whole: { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } },
            kind: 'Needy',
        });
    });
});

const NOT_REPORTED = { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } };

describe('the skeleton of a new entity', () => {
    it('fills an analysis’s required lists, objects and union, its references and branch taken from a sibling', () => {
        const sibling = {
            measure: 'm_1',
            model_estimation: 'me_1',
            details: { details_type: 'DecodingDetails', decoded_variable: NOT_REPORTED, performance_metrics: [] },
        };
        expect(skeletonOf(root, 'Analysis', sibling)).toEqual({
            entity: {
                name: NOT_REPORTED,
                definition: NOT_REPORTED,
                prespecification: NOT_REPORTED,
                spatial_scope: NOT_REPORTED,
                measure: 'm_1',
                groups: [],
                effect: { cells: [], statistic: { family: NOT_REPORTED } },
                details: { decoded_variable: NOT_REPORTED, performance_metrics: [], details_type: 'DecodingDetails' },
                model_estimation: 'me_1',
            },
            open: [],
        });
    });

    it('leaves the required references open with no sibling to take them from, and takes the first branch', () => {
        const { entity, open } = skeletonOf(root, 'Analysis');
        expect(open).toEqual([
            { path: 'measure', target: 'Measure' },
            { path: 'model_estimation', target: 'ModelEstimation' },
        ]);
        expect(entity).not.toHaveProperty('measure');
        expect(entity.details).toEqual({ details_type: 'MassUnivariateDetails' });
    });

    it('gives a required list with a least size that many skeleton items, and takes a oneOf like an anyOf', () => {
        const listed = {
            $defs: {
                ExtractedWhole: {
                    type: 'object',
                    properties: { extraction_status: {}, value: {}, evidence: {} },
                    required: ['extraction_status', 'evidence'],
                },
                Item: {
                    type: 'object',
                    properties: { whole: { $ref: '#/$defs/ExtractedWhole' } },
                    required: ['whole'],
                },
                Other: { type: 'object', properties: { kind: { const: 'Other' } }, required: ['kind'] },
                Listed: {
                    type: 'object',
                    properties: {
                        local_id: {},
                        items: { type: 'array', minItems: 2, items: { $ref: '#/$defs/Item' } },
                        either: { oneOf: [{ $ref: '#/$defs/Other' }, { $ref: '#/$defs/Item' }] },
                    },
                    required: ['local_id', 'items', 'either'],
                },
            },
        };
        expect(skeletonOf(listed, 'Listed').entity).toEqual({
            items: [{ whole: NOT_REPORTED }, { whole: NOT_REPORTED }],
            either: { kind: 'Other' },
        });
    });
});
