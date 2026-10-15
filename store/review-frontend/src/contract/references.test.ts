import extractionSchema from './extraction-record.runtime.schema.json';
import fixture from './references.fixture.json';
import { REFERENCE_SLOTS, referenceSlotsOf } from './references';

describe('the references of the extraction-record schema', () => {
    it('has one row per x-reference property', () => {
        expect(REFERENCE_SLOTS).toHaveLength(41);
    });

    it('lists Analysis.tasks as a multivalued reference to Task', () => {
        expect(REFERENCE_SLOTS).toContainEqual({ class: 'Analysis', slot: 'tasks', target: 'Task', multivalued: true });
    });

    it('does not list Study.groups, which is not a reference', () => {
        expect(REFERENCE_SLOTS.some((r) => r.class === 'Study' && r.slot === 'groups')).toBe(false);
    });

    it('is the row set the Python study_schema.jsonschema.references call gives', () => {
        const sorted = (rows: typeof REFERENCE_SLOTS) =>
            [...rows].sort((a, b) => `${a.class}.${a.slot}`.localeCompare(`${b.class}.${b.slot}`));
        expect(sorted(REFERENCE_SLOTS)).toEqual(sorted(fixture));
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
        expect(referenceSlotsOf(extractionSchema)).toEqual(REFERENCE_SLOTS);
    });
});
