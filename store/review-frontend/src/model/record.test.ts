import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import type { Json } from './paths';
import { buildRecordIndex, withHidden, withSlotFrom, withSlotOrder } from './record';

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

    it('puts doubtful slots first: evidence not found, then generated, then ambiguous, then the rest', () => {
        expect(index.entity('a_1')?.slots.map((s) => s.path)).toEqual([
            'outcome',
            'definition',
            'prespecification',
            'name',
            'spatial_scope',
            'measure',
            'acquisitions',
            'groups[#0].group',
            'groups[#0].n',
            'effect.cells[#0].term',
            'effect.cells[#0].level',
        ]);
        expect(index.entity('grp_a')?.slots.map((s) => [s.path, s.doubt])).toEqual([
            ['species', 'not_found'],
            ['name', 'other'],
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

    it('sorts an edited slot back among the slots of its doubt in record order', () => {
        const after = withSlotFrom(index, edited, 'slot:grp_a:species');
        expect(after.entity('grp_a')?.slots.map((s) => [s.path, s.doubt])).toEqual([
            ['name', 'other'],
            ['species', 'other'],
        ]);
        expect(after.allSpans).toContainEqual([40, 45]);
    });
});

describe('a slot order kept for one entity', () => {
    const index = buildRecordIndex(
        makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_hidden'], entities: [] } })
    );

    it('lists the entity’s slots in the order given, the others after them, its spans as they were', () => {
        const kept = withSlotOrder(index, 'a_1', ['slot:a_1:name', 'slot:a_1:measure']);
        expect(
            kept
                .entity('a_1')
                ?.slots.slice(0, 3)
                .map((s) => s.path)
        ).toEqual(['name', 'measure', 'outcome']);
        expect(kept.visible.find((e) => e.id === 'a_1')?.slots[0].path).toBe('name');
        expect(kept.entity('grp_a')).toBe(index.entity('grp_a'));
        expect(kept.allSpans).toBe(index.allSpans);
    });

    it('is the index itself when the order is the one it has', () => {
        const order = index.entity('a_1')!.slots.map((s) => s.key);
        expect(withSlotOrder(index, 'a_1', order)).toBe(index);
        expect(withSlotOrder(index, 'nobody', order)).toBe(index);
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
