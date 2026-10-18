import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import type { Json } from './paths';
import { declaredOf } from '../store/declared';
import { setSchemas } from '../contract/schemas';
import { GOLDEN_SCHEMAS } from '../test/goldenSchemas';
import { withPropertyOrder } from '../test/schemaOrder';
import { buildRecordIndex, withHidden, withSlotFrom } from './record';

const TEXT = 'x'.repeat(200);

const record = {
    description: ev('A study', [[0, 10]], 'generated'),
    design: {
        description: notReported(),
        timepoints: [{ local_id: 'tp_1', name: ev('Baseline', [[20, 28]]) }],
    },
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [[50, 58]]), species: ev('human', [], 'generated') },
        { local_id: 'grp_b', name: ev('Controls', [[60, 68]]) },
    ],
    devices: [{ local_id: 'dev_1', model: ev('Prisma', [[5, 9]]) }],
    acquisitions: [{ local_id: 'acq_1', acquisition_type: 'MRI', device: 'dev_1', modality: ev('fMRI', [[70, 74]]) }],
    measures: [{ local_id: 'mea_1', source_label: ev('BOLD', [[80, 84]]) }],
    model_estimations: [
        { local_id: 'mod_1', terms: [{ local_id: 'trm_1', name: ev('group', [[90, 95]]), interaction_with: [] }] },
    ],
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Patients > Controls', [[120, 140]]),
            definition: ev('def', [[150, 160]], 'generated'),
            prespecification: notReported(),
            outcome: {
                extraction_status: 'extracted',
                value: 'x',
                value_source: 'reported',
                evidence: { status: 'not_found' },
            },
            spatial_scope: notReported('outside_text'),
            measure: 'mea_1',
            acquisitions: ['acq_1'],
            groups: [
                {
                    group: 'grp_a',
                    n: ev(20, [
                        [100, 102],
                        [50, 58],
                    ]),
                },
            ],
            effect: { cells: [{ term: 'trm_1', level: ev('Patients', [[130, 138]]) }] },
            details: { details_type: 'MassUnivariateDetails' },
        },
        { local_id: 'a_hidden', name: ev('Other', [[170, 175]]) },
    ],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('dev_1', 'Device', 'devices'),
    row('acq_1', 'Acquisition', 'acquisitions', { schema_class: 'MRI' }),
    row('mea_1', 'Measure', 'measures'),
    row('mod_1', 'ModelEstimation', 'model_estimations'),
    row('trm_1', 'ModelTerm', 'terms', { parent: 'mod_1' }),
    row('a_1', 'Analysis', 'analyses'),
    row('a_hidden', 'Analysis', 'analyses'),
    row('tp_1', 'Timepoint', 'design.timepoints')
);

describe('buildRecordIndex', () => {
    const index = buildRecordIndex(
        makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_hidden'], entities: [] } })
    );

    it('takes every entity, its classes and its order from the bundle’s entity index, grouped by class', () => {
        expect(index.entities.map((e) => [e.id, e.entityClass, e.schemaClass])).toEqual([
            ['study', 'Study', 'Study'],
            ['grp_a', 'Group', 'Group'],
            ['grp_b', 'Group', 'Group'],
            ['dev_1', 'Device', 'Device'],
            ['acq_1', 'Acquisition', 'MRI'],
            ['mea_1', 'Measure', 'Measure'],
            ['mod_1', 'ModelEstimation', 'ModelEstimation'],
            ['trm_1', 'ModelTerm', 'ModelTerm'],
            ['a_1', 'Analysis', 'Analysis'],
            ['a_hidden', 'Analysis', 'Analysis'],
            ['tp_1', 'Timepoint', 'Timepoint'],
        ]);
        expect(index.entity('a_hidden')?.hidden).toBe(true);
        expect(index.entity('a_1')?.hidden).toBe(false);
        expect(index.entity('grp_a')?.name).toBe('Patients');
        expect(index.entity('study')?.localId).toBe('P1');
    });

    it('lists the slots its class declares that the record leaves out, unset, so a reference can be linked', () => {
        const acquisitions = buildRecordIndex(
            makeBundle({ acquisitions: [{ local_id: 'acq_1', name: ev('Scan A') }] }, TEXT, {
                entities: entityRows(row('acq_1', 'Acquisition', 'acquisitions')),
            }),
            (r) =>
                r.entity_class === 'Acquisition'
                    ? [{ path: 'name', wrapper: {} }, { path: 'modality', wrapper: {} }, { path: 'device' }]
                    : []
        );
        expect(acquisitions.entity('acq_1')?.slots.map((s) => [s.path, s.kind, s.references])).toEqual(
            expect.arrayContaining([
                ['device', 'reference', []],
                ['modality', 'value', []],
                ['name', 'value', []],
            ])
        );
        expect(acquisitions.slot('slot:acq_1:modality')?.value).toBeUndefined();
        expect(acquisitions.entity('acq_1')?.slots).toHaveLength(3);
    });

    it('lists no slot for an entity’s stable_id, whether the record carries it or the schema declares it', () => {
        const stableId = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b90';
        const stamped = buildRecordIndex(
            makeBundle({ groups: [{ local_id: 'grp_a', stable_id: stableId, name: ev('Patients') }] }, TEXT, {
                entities: entityRows(row('grp_a', 'Group', 'groups')),
            }),
            declaredOf
        );
        const paths = stamped.entity('grp_a')?.slots.map((s) => s.path) ?? [];
        expect(paths).toContain('name');
        expect(paths.filter((path) => path.startsWith('stable_id'))).toEqual([]);
        expect(stamped.slot('slot:grp_a:stable_id')).toBeUndefined();
    });

    it('treats an object the entity index does not list as no entity', () => {
        const only = buildRecordIndex(
            makeBundle(record, TEXT, { entities: entityRows(row('grp_a', 'Group', 'groups')) })
        );
        expect(only.entities.map((e) => e.id)).toEqual(['study', 'grp_a']);
        expect(only.slot('slot:study:groups[#1].name')).toBeUndefined();
    });

    it('lists an entity’s slots by path, stopping at child entities', () => {
        expect(index.entity('study')?.slots.map((s) => s.path)).toEqual(['description', 'design.description']);
        expect(
            index
                .entity('a_1')
                ?.slots.map((s) => s.path)
                .sort()
        ).toEqual(
            [
                'acquisitions',
                'definition',
                'effect.cells[#0].level',
                'effect.cells[#0].term',
                'groups[#0].group',
                'groups[#0].n',
                'measure',
                'name',
                'outcome',
                'prespecification',
                'spatial_scope',
            ].sort()
        );
        expect(index.slot('slot:a_1:groups[#0].n')?.entity).toBe('a_1');
    });

    it('lists an Analysis’s slots in the order its class declares them, list items in their list’s place', () => {
        expect(index.entity('a_1')?.slots.map((s) => s.path)).toEqual([
            'acquisitions',
            'definition',
            'effect.cells[#0].level',
            'effect.cells[#0].term',
            'groups[#0].group',
            'groups[#0].n',
            'measure',
            'name',
            'outcome',
            'prespecification',
            'spatial_scope',
        ]);
    });

    it('marks reference slots from the extraction-record x-reference annotations, including inherited and nested classes', () => {
        const refs = (key: string) => {
            const slot = index.slot(key);
            return slot && [slot.kind, slot.references];
        };
        expect(refs('slot:a_1:measure')).toEqual(['reference', ['mea_1']]);
        expect(refs('slot:a_1:acquisitions')).toEqual(['reference', ['acq_1']]);
        expect(refs('slot:a_1:groups[#0].group')).toEqual(['reference', ['grp_a']]);
        expect(refs('slot:a_1:effect.cells[#0].term')).toEqual(['reference', ['trm_1']]);
        expect(refs('slot:acq_1:device')).toEqual(['reference', ['dev_1']]);
        expect(refs('slot:a_1:name')).toEqual(['value', []]);
    });

    it('gives each slot its spans in reading order and each entity the union of its slots’ spans', () => {
        expect(index.slot('slot:a_1:groups[#0].n')?.spans).toEqual([
            [50, 58],
            [100, 102],
        ]);
        expect(index.entity('a_1')?.spans).toEqual([
            [50, 58],
            [100, 102],
            [120, 140],
            [130, 138],
            [150, 160],
        ]);
    });

    it('lists the visible entities and collects all their spans', () => {
        expect(index.visible.map((e) => e.id)).not.toContain('a_hidden');
        expect(index.visible).toHaveLength(index.entities.length - 1);
        expect(index.allSpans).toContainEqual([120, 140]);
        expect(index.allSpans).not.toContainEqual([170, 175]);
    });
});

describe('slot order (D96)', () => {
    const LINKML_GROUP = [
        'stable_id',
        'local_id',
        'name',
        'description',
        'species',
        'approached_count',
        'acquired_count',
        'excluded_count',
        'inclusion_criteria',
        'age_mean',
        'age_standard_deviation',
        'age_minimum',
        'age_unit',
    ];
    const group = {
        local_id: 'grp_a',
        age_standard_deviation: ev(9.1, [[30, 33]]),
        acquired_count: ev(251, [[10, 13]]),
        name: ev('Patients', [[50, 58]]),
        age_mean: ev(30.2, [], 'generated'),
        species: ev('human', [], 'generated'),
    };

    it('lists a class’s slots in the order the schema declares them, never by doubt or by the record’s order', () => {
        setSchemas(withPropertyOrder(GOLDEN_SCHEMAS, 'Group', LINKML_GROUP));
        const index = buildRecordIndex(
            makeBundle({ groups: [group] }, TEXT, { entities: entityRows(row('grp_a', 'Group', 'groups')) }),
            declaredOf
        );
        const paths = index.entity('grp_a')!.slots.map((s) => s.path);
        expect(paths.slice(0, 10)).toEqual([
            'name',
            'description',
            'species',
            'approached_count',
            'acquired_count',
            'excluded_count',
            'inclusion_criteria',
            'age_mean',
            'age_standard_deviation',
            'age_minimum',
        ]);
    });
});

describe('slot order of nested list items (D96)', () => {
    const analysis = {
        local_id: 'a_1',
        effect: {
            cells: [
                { direction: ev('positive'), label: ev('HC') },
                { direction: ev('negative'), label: ev('SAD') },
            ],
        },
    };
    const cellPaths = () => {
        const index = buildRecordIndex(
            makeBundle({ analyses: [analysis] }, TEXT, { entities: entityRows(row('a_1', 'Analysis', 'analyses')) }),
            declaredOf
        );
        return index
            .entity('a_1')!
            .slots.map((s) => s.path)
            .filter((path) => path.startsWith('effect.cells'));
    };

    it('lists each item’s slots in the order the item class declares them, item after item', () => {
        setSchemas(withPropertyOrder(GOLDEN_SCHEMAS, 'Cell', ['label', 'direction']));
        expect(cellPaths()).toEqual([
            'effect.cells[#0].label',
            'effect.cells[#0].direction',
            'effect.cells[#1].label',
            'effect.cells[#1].direction',
        ]);
    });

    it('follows the schema when it declares them the other way', () => {
        setSchemas(withPropertyOrder(GOLDEN_SCHEMAS, 'Cell', ['direction', 'label']));
        expect(cellPaths().slice(0, 2)).toEqual(['effect.cells[#0].direction', 'effect.cells[#0].label']);
    });
});

describe('entity names', () => {
    const named = {
        devices: [
            { local_id: 'dev_jena', manufacturer: ev('Siemens'), model: ev('TrioTim') },
            { local_id: 'dev_a', manufacturer: ev('Philips') },
            { local_id: 'dev_b', manufacturer: ev('Philips') },
        ],
        acquisitions: [{ local_id: 'acq_1', acquisition_type: 'MRI', modality: ev('sMRI'), device: 'dev_jena' }],
        groups: [{ local_id: 'grp_a', name: ev('Patients') }],
    };
    const rows = entityRows(
        row('dev_jena', 'Device', 'devices'),
        row('dev_a', 'Device', 'devices'),
        row('dev_b', 'Device', 'devices'),
        row('acq_1', 'Acquisition', 'acquisitions', { schema_class: 'MRI' }),
        row('grp_a', 'Group', 'groups')
    );
    const index = buildRecordIndex(makeBundle(named, TEXT, { entities: rows }));
    const nameOf = (id: string) => index.entity(id)?.name;

    it('names an entity with no name of its own by its first short values, not by its local id', () => {
        expect(nameOf('dev_jena')).toBe('Siemens, TrioTim');
        expect(nameOf('grp_a')).toBe('Patients');
    });

    it('adds the entity it refers to where it has fewer than two values', () => {
        expect(nameOf('acq_1')).toBe('sMRI · Siemens, TrioTim');
    });

    it('names an entity by the first of its name, label, caption and source label slots that holds a text', () => {
        const labelled = buildRecordIndex(
            makeBundle(
                {
                    measures: [
                        { local_id: 'm_1', source_label: ev('BOLD'), caption: ev('A caption'), label: ev('A label') },
                        { local_id: 'm_2', source_label: ev('CBF'), caption: ev('Perfusion') },
                        { local_id: 'm_3', source_label: ev('ASL'), name: ev(''), label: ev(7) },
                        { local_id: 'm_4', name: ev('Named'), label: ev('Ignored') },
                    ],
                },
                TEXT,
                {
                    entities: entityRows(...['m_1', 'm_2', 'm_3', 'm_4'].map((id) => row(id, 'Measure', 'measures'))),
                }
            )
        );
        expect(['m_1', 'm_2', 'm_3', 'm_4'].map((id) => labelled.entity(id)?.name)).toEqual([
            'A label',
            'Perfusion',
            'ASL',
            'Named',
        ]);
    });

    it('tells apart entities of a class that would share a name by their local ids', () => {
        expect(nameOf('dev_a')).toBe('Philips (dev_a)');
        expect(nameOf('dev_b')).toBe('Philips (dev_b)');
    });

    it('names an entity again when an edit changes the value its name comes from', () => {
        const edited = structuredClone(named);
        edited.devices[1].manufacturer = ev('GE');
        const after = withSlotFrom(index, { local_id: 'P1', ...edited }, 'slot:dev_a:manufacturer');
        expect(after.entity('dev_a')?.name).toBe('GE');
        expect(after.entity('dev_b')?.name).toBe('Philips');
        expect(after.entity('grp_a')).toBe(index.entity('grp_a'));
    });
});

describe('hidden entities in the view', () => {
    const bundle = makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_hidden'], entities: ['grp_b'] } });

    it('leaves out the hidden analyses and what only they reach, until the view shows them', () => {
        const index = buildRecordIndex(bundle);
        expect(index.visible.map((e) => e.id)).not.toContain('a_hidden');
        expect(index.visible.map((e) => e.id)).not.toContain('grp_b');
        const shown = withHidden(index, true);
        expect(shown.visible.map((e) => e.id)).toEqual(expect.arrayContaining(['a_hidden', 'grp_b']));
        expect(shown.entity('grp_b')?.hidden).toBe(true);
    });
});

describe('the index after an edit', () => {
    const bundle = makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_hidden'], entities: [] } });
    const index = buildRecordIndex(bundle);
    const edited = structuredClone(record) as Json;
    (edited.groups as Json[])[0].species = ev('human', [[40, 45]]);

    it('keeps an edited slot where its class declares it, whatever its doubt now', () => {
        expect(index.entity('grp_a')?.slots.map((s) => [s.path, s.doubt])).toEqual([
            ['name', 'other'],
            ['species', 'not_found'],
        ]);
        const after = withSlotFrom(index, edited, 'slot:grp_a:species');
        expect(after.entity('grp_a')?.slots.map((s) => [s.path, s.doubt])).toEqual([
            ['name', 'other'],
            ['species', 'other'],
        ]);
        expect(after.allSpans).toContainEqual([40, 45]);
    });
});

describe('listing the hidden entities', () => {
    const index = buildRecordIndex(
        makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_hidden'], entities: [] } })
    );

    it('is the index itself while they are left out, and the same listing each time they are shown', () => {
        expect(withHidden(index, false)).toBe(index);
        expect(withHidden(index, true)).toBe(withHidden(index, true));
        expect(withHidden(index, true).visible.map((e) => e.id)).toContain('a_hidden');
        expect(withHidden(index, true).allSpans).toContainEqual([170, 175]);
    });
});
