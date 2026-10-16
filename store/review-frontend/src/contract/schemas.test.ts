import { coordinateSchema, pointFields } from '../coordinates/schema';
import { extractionSchema } from '../inspector/schema';
import type { Schema } from '../inspector/schema';
import { referenceSlots } from './references';
import { loadSchemas, schemaOf, SCHEMA_NAMES, type SchemaName } from './schemas';

const extraction: Schema = {
    $defs: {
        Study: {
            type: 'object',
            properties: { local_id: { type: 'string' }, owner: { type: 'string', 'x-reference': 'Group' } },
        },
    },
};

const coordinate: Schema = {
    type: 'object',
    properties: { analyses: { type: 'array', items: { $ref: '#/$defs/TableAnalysis' } } },
    $defs: {
        TableAnalysis: { type: 'object', properties: { points: { type: 'array', items: { $ref: '#/$defs/Point' } } } },
        Point: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] },
    },
};

const served: Record<SchemaName, Schema> = { 'extraction-record': extraction, 'coordinate-parse': coordinate };

describe('loadSchemas', () => {
    it('asks for both schemas before either answers', async () => {
        const asked: string[] = [];
        const answers: (() => void)[] = [];
        const loading = loadSchemas(
            (name) =>
                new Promise((resolve) => {
                    asked.push(name);
                    answers.push(() => resolve(served[name]));
                })
        );
        expect(asked).toEqual([...SCHEMA_NAMES]);
        answers.forEach((answer) => answer());
        expect(await loading).toEqual(served);
    });

    it('makes the loaded schemas the ones the editors and reference slots are read from', async () => {
        await loadSchemas(async (name) => served[name]);
        expect(schemaOf('extraction-record')).toBe(extraction);
        expect(extractionSchema()).toBe(extraction);
        expect(coordinateSchema()).toBe(coordinate);
        expect(referenceSlots()).toEqual([{ class: 'Study', slot: 'owner', target: 'Group', multivalued: false }]);
        expect(pointFields().map((field) => field.name)).toEqual(['label']);
    });
});
