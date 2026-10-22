import extractionSchema from '../test/golden/schemas/extraction-record.schema.json';
import fixture from './references.fixture.json';
import { referenceSlots, referenceSlotsOf, type Reference } from './references';

describe('the references of the extraction-record schema', () => {
    it('has one row per x-reference property', () => {
        expect(referenceSlots()).toHaveLength(41);
    });

    it('lists Analysis.tasks as a multivalued reference to Task', () => {
        expect(referenceSlots()).toContainEqual({
            class: 'Analysis',
            slot: 'tasks',
            target: 'Task',
            multivalued: true,
        });
    });

    it('does not list Study.groups, which is not a reference', () => {
        expect(referenceSlots().some((r) => r.class === 'Study' && r.slot === 'groups')).toBe(false);
    });

    it('is the row set the Python study_schema.jsonschema.references call gives', () => {
        const sorted = (rows: Reference[]) =>
            [...rows].sort((a, b) => `${a.class}.${a.slot}`.localeCompare(`${b.class}.${b.slot}`));
        expect(sorted(referenceSlots())).toEqual(sorted(fixture));
    });

    it('reads the rows from any schema, from its x-reference properties', () => {
        const schema = {
            $defs: {
                Thing: {
                    properties: {
                        owner: { type: 'string', 'x-reference': 'Person' },
                        friends: { type: 'array', items: { type: 'string' }, 'x-reference': 'Person' },
                        name: { type: 'string' },
                    },
                },
            },
        };
        expect(referenceSlotsOf(schema)).toEqual([
            { class: 'Thing', slot: 'friends', target: 'Person', multivalued: true },
            { class: 'Thing', slot: 'owner', target: 'Person', multivalued: false },
        ]);
        expect(referenceSlotsOf(extractionSchema)).toEqual(referenceSlots());
    });
});
