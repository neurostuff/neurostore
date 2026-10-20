import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { schemaOf } from '../contract/schemas';
import { declaredOf } from '../store/declared';
import { entityRows, ev, hasFixture, loadFixture, makeBundle, notReported, row } from '../test/bundles';
import { cardLayoutOf } from './cardLayout';
import { CARD_TEMPLATES, templatePaths } from './cardTemplates';
import { buildRecordIndex, type EntityNode, type RecordIndex } from './record';
import { asSchema, refsOf } from './schema';

const defs = () => asSchema(schemaOf('extraction-record').$defs)!;
const defOf = (name: string) => asSchema(defs()[name]);

/** The schema's entity classes: those with a local id. */
const entityClasses = () =>
    Object.keys(defs()).filter((name) => 'local_id' in (asSchema(defOf(name)?.properties) ?? {}));

const ACQUISITIONS = ['Acquisition', 'MRI', 'EEG', 'PET', 'FNIRS', 'OtherModality'];
const entityClassOf = (schemaClass: string) => (ACQUISITIONS.includes(schemaClass) ? 'Acquisition' : schemaClass);

/** Whether a class declares `path`: each step a property of the class, or of one of the classes a union holds. */
function declares(className: string, at: string): boolean {
    const [first, ...rest] = at.split('.');
    const property = asSchema(asSchema(defOf(className)?.properties)?.[first]);
    if (!property) return false;
    if (rest.length === 0) return true;
    const items = asSchema(property.items);
    const classes = [...refsOf(property), ...(items ? refsOf(items) : [])];
    return classes.some((name) => declares(name, rest.join('.')));
}

/** The cell fields an analysis's comparison says in its chips' words, without a value of their own to focus. */
const SAID_BY_COMPARISON = /^effect\.cells\[#\d+\]\.(term|level|label)$/;

/**
 * Every slot of every entity placed once and shown where it is placed: in the order j and k walk, or in the fold; a
 * list item's field that only its details show is in that item's details and still walked; a cell's term, level and
 * label in the comparison's words. No template names a slot twice, and a class with a template places all its slots.
 */
function expectCovered(index: RecordIndex) {
    for (const entity of index.entities) {
        const layout = cardLayoutOf(index, entity);
        const what = `${entity.schemaClass} ${entity.id}`;
        expect([...layout.places.keys()].sort(), what).toEqual(entity.slots.map((s) => s.key).sort());
        expect(layout.doubled, what).toEqual([]);
        const order = new Set(layout.order.map((s) => s.key));
        expect(order.size, `${what}: walked once`).toBe(layout.order.length);
        const folded = new Set(layout.folded.map((s) => s.key));
        const unshown = [...layout.places].flatMap(([key, place]) => {
            const slot = index.slot(key)!;
            if (place.where === 'fold') return folded.has(key) ? [] : [`${key} placed in the fold, not in it`];
            if (folded.has(key)) return [`${key} folded, placed ${place.where}`];
            if (place.where === 'comparison' && SAID_BY_COMPARISON.test(slot.path)) return [];
            if (place.where === 'item' && !place.item?.detailsOnly.includes(slot))
                return [`${key} in no item's details`];
            return order.has(key) ? [] : [`${key} placed ${place.where}, not shown`];
        });
        expect(unshown, what).toEqual([]);
        if (entity.schemaClass in CARD_TEMPLATES)
            expect(
                [...layout.places].filter(([, place]) => place.leftover).map(([key]) => key),
                what
            ).toEqual([]);
    }
}

function indexOf(record: Record<string, unknown>, ...rows: ReturnType<typeof row>[]) {
    return buildRecordIndex(makeBundle(record, 'x'.repeat(10), { entities: entityRows(...rows) }), declaredOf);
}

/** One entity of every entity class, with nothing in the record but its id, so each declared slot is absent. */
function everyClass(): RecordIndex {
    const classes = entityClasses().filter((name) => name !== 'Study');
    const record = { items: classes.map((name) => ({ local_id: `e_${name}` })) };
    return indexOf(
        record,
        ...classes.map((name) => row(`e_${name}`, entityClassOf(name), 'items', { schema_class: name }))
    );
}

const goldenBundle = (): ReviewBundle =>
    JSON.parse(readFileSync(path.resolve(__dirname, '../test/golden/bundle.json'), 'utf8'));
const e2eBundle = (id: string): ReviewBundle =>
    JSON.parse(readFileSync(path.resolve(__dirname, `../../e2e/fixtures/${id}.bundle.json`), 'utf8'));
const LOCAL = ['22fv2dADxHqR', '24syuoHkxfeu', '25Czf8TcaxDS', '2KTUQPrgtEke'];

describe('the card templates', () => {
    it('have an entry for every entity class of the schema', () => {
        expect(entityClasses().filter((name) => !(name in CARD_TEMPLATES))).toEqual([]);
    });

    it('name only slots their class declares', () => {
        const unknown = Object.entries(CARD_TEMPLATES).flatMap(([name, template]) =>
            templatePaths(template)
                .filter((at) => !declares(name, at))
                .map((at) => `${name}.${at}`)
        );
        expect(unknown).toEqual([]);
    });

    it.each(Object.keys(CARD_TEMPLATES))('%s names each slot once', (name) => {
        const paths = templatePaths(CARD_TEMPLATES[name]);
        expect(paths.filter((at, i) => paths.indexOf(at) !== i)).toEqual([]);
    });
});

describe('the card layouts', () => {
    it('show every slot of every class once, by its template', () => {
        expectCovered(everyClass());
    });

    it('show every slot of every entity of the golden bundle once', () => {
        expectCovered(buildRecordIndex(goldenBundle(), declaredOf));
    });

    it.each(['P1', 'P2', 'P3', 'P4', 'P5'])('show every slot of %s once', (id) => {
        expectCovered(buildRecordIndex(e2eBundle(id), declaredOf));
    });

    it.each(LOCAL)('show every slot of the local fixture %s once', (id) => {
        if (!hasFixture(id)) return;
        expectCovered(buildRecordIndex(loadFixture(id), declaredOf));
    });

    it('note a slot the template names twice, placing it once', () => {
        const name = 'Assessment';
        const template = CARD_TEMPLATES[name];
        CARD_TEMPLATES[name] = { ...template, rows: [...(template.rows ?? []), 'description'] };
        try {
            const index = indexOf(
                { assessments: [{ local_id: 'a', name: ev('PHQ-9'), description: ev('Depression') }] },
                row('a', 'Assessment', 'assessments')
            );
            expect(cardLayoutOf(index, index.entity('a')!).doubled).toEqual(['slot:a:description']);
        } finally {
            CARD_TEMPLATES[name] = template;
        }
    });

    it('make the name slot the title, first in the walk, and no row', () => {
        const index = indexOf(
            { groups: [{ local_id: 'g', name: ev('LTMs'), species: ev('human') }] },
            row('g', 'Group', 'groups')
        );
        const layout = cardLayoutOf(index, index.entity('g')!);
        expect(layout.title?.key).toBe('slot:g:name');
        expect(layout.places.get('slot:g:name')?.where).toBe('title');
        expect(layout.order[0].key).toBe('slot:g:name');
        expect(layout.rows.map((r) => r.label)).not.toContain('Name');
    });

    it('is worked out once for each index and entity, and again for a new index', () => {
        const index = buildRecordIndex(goldenBundle(), declaredOf);
        const [group] = index.entities.filter((e) => e.entityClass === 'Group');
        expect(cardLayoutOf(index, group)).toBe(cardLayoutOf(index, group));
        const next = buildRecordIndex(goldenBundle(), declaredOf);
        expect(cardLayoutOf(next, next.entity(group.id)!)).not.toBe(cardLayoutOf(index, group));
    });
});

/** A card's sentences as text. */
const aboutOf = (index: RecordIndex, entity: EntityNode) =>
    cardLayoutOf(index, entity).about.map((line) => line.map((piece) => piece.text).join(''));

/** The sentences of one entity of `schemaClass` holding `item`, or of the study holding it. */
function sentences(schemaClass: string, item: Record<string, unknown>) {
    if (schemaClass === 'Study') {
        const index = indexOf(item);
        return aboutOf(index, index.entity('study')!);
    }
    const index = indexOf(
        { items: [{ local_id: 'e', ...item }] },
        row('e', entityClassOf(schemaClass), 'items', { schema_class: schemaClass })
    );
    return aboutOf(index, index.entity('e')!);
}

const LOREM = 'A long description of the thing, longer than the short fields.';

describe('a card’s sentences', () => {
    it.each<[string, string, Record<string, unknown>, string[]]>([
        [
            'a full group',
            'Group',
            {
                name: ev('LTMs'),
                acquired_count: ev(28),
                species: ev('human'),
                age_mean: ev(52.5),
                age_standard_deviation: ev(8.1),
                age_minimum: ev(37),
                age_maximum: ev(67),
                age_unit: ev('years'),
                sex_distribution: [
                    { category: ev('female'), count: ev(15), denominator: ev(28) },
                    { category: ev('male'), count: ev(13), denominator: ev(28) },
                ],
                medical_condition: ev(['none']),
                diagnostic_system: ev('DSM-5'),
                is_healthy: ev(true),
                approached_count: ev(40),
                enrolled_count: ev(30),
                excluded_count: ev(2),
                sample_source: ev('recruited'),
            },
            [
                '28 human participants aged 52.5 ± 8.1 years (37–67), female 15 · male 13 of 28; none, diagnosed by DSM-5; healthy: yes.',
                '40 approached, 30 enrolled, 2 excluded; recruited.',
            ],
        ],
        [
            'a group with absent and not-reported clauses',
            'Group',
            {
                name: ev('MNPs'),
                species: ev('human'),
                age_mean: ev(50),
                age_standard_deviation: notReported('not_in_text'),
                is_healthy: ev(true),
            },
            ['human participants aged 50; healthy: yes.'],
        ],
        [
            'a group with an age unit and no ages',
            'Group',
            { name: ev('G'), age_unit: ev('years') },
            ['participants aged in years.'],
        ],
        [
            'a group aged from a minimum only',
            'Group',
            { name: ev('G'), age_minimum: ev(18), age_unit: ev('years') },
            ['participants aged 18 years or older.'],
        ],
        [
            'a group aged up to a maximum only',
            'Group',
            { name: ev('G'), age_maximum: ev(12), age_unit: ev('years') },
            ['participants aged up to 12 years.'],
        ],
        [
            'a group aged from both ends only',
            'Group',
            { name: ev('G'), age_minimum: ev(18), age_maximum: ev(40), age_unit: ev('years') },
            ['participants aged 18–40 years.'],
        ],
        [
            'a group aged by a mean and a minimum',
            'Group',
            {
                name: ev('G'),
                age_mean: ev(25.2),
                age_standard_deviation: ev(5.5),
                age_minimum: ev(18),
                age_unit: ev('years'),
            },
            ['participants aged 25.2 ± 5.5 years (18 or older).'],
        ],
        [
            'a group aged by a mean and a maximum',
            'Group',
            {
                name: ev('G'),
                age_mean: ev(25.2),
                age_standard_deviation: ev(5.5),
                age_maximum: ev(12),
                age_unit: ev('years'),
            },
            ['participants aged 25.2 ± 5.5 years (up to 12).'],
        ],
        [
            'a group aged by a mean and both ends',
            'Group',
            {
                name: ev('G'),
                age_mean: ev(25.2),
                age_standard_deviation: ev(5.5),
                age_minimum: ev(18),
                age_maximum: ev(40),
                age_unit: ev('years'),
            },
            ['participants aged 25.2 ± 5.5 years (18–40).'],
        ],
        [
            'an analysis with no prespecification',
            'Analysis',
            {
                name: ev('LTMs < MNPs'),
                prespecification: notReported('not_in_text'),
                outcome: ev('significant_effect'),
                spatial_scope: ev('whole_brain'),
                effect: { kind: ev('contrast'), statistic: { family: ev('t') } },
            },
            ['contrast analysis with a significant effect across the whole brain, tested with t.'],
        ],
        [
            'a full analysis',
            'Analysis',
            {
                name: ev('A > B'),
                prespecification: ev('planned'),
                outcome: ev('no_significant_effect'),
                spatial_scope: ev('roi'),
                coordinate_space: ev('MNI'),
                effect: {
                    kind: ev('simple_effect'),
                    statistic: {
                        family: ev('f'),
                        degrees_of_freedom_numerator: ev(1),
                        degrees_of_freedom_denominator: ev(40),
                    },
                    mediation: { path: ev('indirect') },
                },
            },
            [
                'planned simple-effect analysis with no significant effect across regions of interest, tested with F (df 1, 40), indirect mediation path, in MNI space.',
            ],
        ],
        [
            'a full task',
            'Task',
            {
                name: ev('Stroop'),
                paradigm: ev('Stroop'),
                design_type: ev('event_related'),
                stimulus_modality: ev(['visual']),
                response_modality: ev(['button_press']),
                presentation_software: ev('E-Prime 2.0'),
            },
            ['Stroop task in an event-related design, visual stimuli, button press responses, run in E-Prime 2.0.'],
        ],
        [
            'a sparse task',
            'Task',
            { name: ev('Rest'), design_type: ev('continuous') },
            ['task in a continuous design.'],
        ],
        [
            'full inference settings',
            'InferenceSettings',
            {
                inference_level: ev('cluster'),
                height_threshold_type: ev('uncorrected p'),
                height_threshold_value: ev(0.001),
                cluster_extent_threshold: ev(50),
                clusterwise_threshold_value: ev(0.05),
                multiple_comparison_method: ev('FWE'),
                correction_scope: ev('whole_brain'),
                alpha_level: ev(0.05),
                permutation_count: ev(5000),
                number_of_tests: ev(2),
                tfce_used: ev(false),
            },
            [
                'cluster-level inference at uncorrected p < 0.001, clusters of 50 or more, cluster p < 0.05, corrected by FWE over the whole brain, α 0.05, 5000 permutations, 2 tests; TFCE: no.',
            ],
        ],
        [
            'sparse inference settings',
            'InferenceSettings',
            { multiple_comparison_method: ev('FDR'), alpha_level: ev(0.05) },
            ['inference, corrected by FDR, α 0.05.'],
        ],
        [
            'an MRI acquisition with half its parameters',
            'MRI',
            {
                acquisition_type: 'MRI',
                modality: ev('sMRI'),
                magnetic_field_strength_tesla: ev(3),
                pulse_sequence_type: ev('MPRAGE'),
                acquisition_voxel_size_mm: ev([1, 1, 1]),
            },
            ['sMRI at 3 T with MPRAGE, voxels 1 × 1 × 1 mm.'],
        ],
        [
            'an EEG acquisition',
            'EEG',
            {
                acquisition_type: 'EEG',
                modality: ev('EEG'),
                sampling_frequency_hz: ev(1000),
                eeg_channel_count: ev(64),
                recording_type: ev('continuous'),
                brain_coverage: ev('whole_brain'),
            },
            ['EEG at 1000 Hz, 64 channels, continuous recording, whole-brain coverage.'],
        ],
        [
            'an fNIRS acquisition',
            'FNIRS',
            {
                acquisition_type: 'FNIRS',
                modality: ev('fNIRS'),
                nirs_system_type: ev('continuous wave'),
                sampling_frequency_hz: ev(10),
                nirs_channel_count: ev(48),
                wavelengths_nm: ev([760, 850]),
            },
            ['fNIRS (continuous wave) at 10 Hz, 48 channels, wavelengths 760, 850 nm.'],
        ],
        [
            'a PET acquisition',
            'PET',
            {
                acquisition_type: 'PET',
                modality: ev('PET'),
                tracer_name: ev('FDG'),
                tracer_radionuclide: ev('18F'),
                scan_type: ev('static'),
                acquisition_duration_seconds: ev(600),
            },
            ['PET with FDG (18F), static scan, 600 s long.'],
        ],
        [
            'another modality',
            'OtherModality',
            { acquisition_type: 'OtherModality', modality: ev('other'), modality_label: ev('EMG') },
            ['EMG (other).'],
        ],
        [
            'an acquisition of no modality class',
            'Acquisition',
            { acquisition_type: 'Acquisition', modality: ev('MEG'), brain_coverage: ev('partial') },
            ['MEG acquisition, partial coverage.'],
        ],
        [
            'a device',
            'Device',
            { manufacturer: ev('Siemens'), model: ev('Prisma') },
            ['made by Siemens, model Prisma.'],
        ],
        [
            'a condition',
            'Condition',
            { name: ev('faces'), condition_kind: ev('task_state'), stimulus_content: ev(['faces', 'houses']) },
            ['task state condition showing faces, houses.'],
        ],
        [
            'an assessment',
            'Assessment',
            { name: ev('PHQ-9'), assessment_type: ev('questionnaire') },
            ['questionnaire assessment.'],
        ],
        [
            'a region',
            'Region',
            {
                name: ev('Left DLPFC'),
                region_type: ev('atlas_parcel'),
                definition_method: ev('atlas'),
                atlas: ev('CONN'),
            },
            ['atlas parcel region defined by atlas, from CONN.'],
        ],
        [
            'a preprocessing',
            'Preprocessing',
            { software: ev(['fMRIPrep']), smoothing_fwhm_mm: ev([6]), description: ev(LOREM) },
            ['run in fMRIPrep, smoothed at 6 mm FWHM.'],
        ],
        [
            'a model estimation',
            'ModelEstimation',
            {
                stage: ev('group'),
                model_family: ev('glm'),
                model_type: ev('two-sample t test'),
                spatial_unit: ev('voxel'),
                software: ev('SPM12'),
            },
            ['group-level GLM (two-sample t test) by voxel in SPM12.'],
        ],
        [
            'a model term',
            'ModelTerm',
            { name: ev('age'), type: ev('continuous'), variation_level: ev('between_subject'), unit: ev('years') },
            ['continuous term varying between subjects, in years.'],
        ],
        [
            'a measure',
            'Measure',
            {
                source_label: ev('GMV'),
                type: ev('gray_matter_volume'),
                family: ev('structural_morphometry'),
                unit: ev('mL'),
            },
            ['gray matter volume (structural morphometry), in mL.'],
        ],
        [
            'a table',
            'Table',
            { table_number: ev('Table 2'), purpose: ev('reported_effect'), caption: ev('Peaks') },
            ['Table 2, reported effect.'],
        ],
        [
            'a coordinate set',
            'CoordinateSet',
            { role: ev('result'), result_kind: ev('contrast') },
            ['result coordinates of a contrast result.'],
        ],
        [
            'an arm',
            'Arm',
            { name: ev('Drug'), arm_kind: ev('pharmacological'), agent: ev('ketamine') },
            ['pharmacological arm with ketamine.'],
        ],
        [
            'a timepoint',
            'Timepoint',
            { name: ev('Baseline'), order: ev(1), relation_to_intervention: ev('pre_intervention') },
            ['timepoint 1, pre-intervention.'],
        ],
        [
            'a study',
            'Study',
            {
                design: {
                    allocation: ev('randomized'),
                    assignment_structure: ev('parallel'),
                    blinding: ev('double_blind'),
                },
                result_reporting: ev('analyses_reported'),
            },
            ['randomized parallel design, double-blind; analyses: reported here.'],
        ],
    ])('reads %s', (_, schemaClass, item, said) => {
        expect(sentences(schemaClass, item)).toEqual(said);
    });

    it('walks an age clause in the order it reads: the mean, its deviation, the unit, then the range', () => {
        const index = indexOf(
            {
                groups: [
                    {
                        local_id: 'g',
                        name: ev('G'),
                        age_mean: ev(25.2),
                        age_standard_deviation: ev(5.5),
                        age_minimum: ev(18),
                        age_unit: ev('years'),
                    },
                ],
            },
            row('g', 'Group', 'groups')
        );
        expect(cardLayoutOf(index, index.entity('g')!).order.map((s) => s.path)).toEqual(
            expect.arrayContaining(['age_mean', 'age_standard_deviation', 'age_unit', 'age_minimum'])
        );
        const walked = cardLayoutOf(index, index.entity('g')!).order.map((s) => s.path);
        expect(walked.slice(walked.indexOf('age_mean'), walked.indexOf('age_mean') + 4)).toEqual([
            'age_mean',
            'age_standard_deviation',
            'age_unit',
            'age_minimum',
        ]);
    });

    it('are left out where none of their slots shows', () => {
        expect(sentences('Device', {})).toEqual([]);
    });
});

describe('a distribution', () => {
    const item = (category: string, count?: number, percentage?: number, denominator?: number) => ({
        category: ev(category),
        ...(count === undefined ? {} : { count: ev(count) }),
        ...(percentage === undefined ? {} : { percentage: ev(percentage) }),
        ...(denominator === undefined ? {} : { denominator: ev(denominator) }),
        reporting_framework: ev('Gender'),
    });
    const genderOf = (...items: Record<string, unknown>[]) => {
        const index = indexOf(
            { groups: [{ local_id: 'g', name: ev('LTMs'), gender_distribution: items }] },
            row('g', 'Group', 'groups')
        );
        const layout = cardLayoutOf(index, index.entity('g')!);
        const gender = layout.rows.find((r) => r.label === 'Gender')!;
        return { index, layout, gender, line: gender.pieces.map((p) => p.text).join('') };
    };
    const keys = (slots: { key: string }[]) => slots.map((s) => s.key.replace('slot:g:gender_distribution', ''));

    it('is one line, the shared denominator and framework said once', () => {
        const { line, gender } = genderOf(item('Female', 15, 53.6, 28), item('Male', 13, 46.4, 28));
        expect(line).toBe('Female 15 (53.6%) · Male 13 (46.4%) of 28');
        expect(keys(gender.pieces.flatMap((p) => (p.kind === 'value' ? [p.slot] : [])))).toEqual([
            '[#0].category',
            '[#0].count',
            '[#0].percentage',
            '[#1].category',
            '[#1].count',
            '[#1].percentage',
            '[#0].denominator',
        ]);
    });

    it('leaves the second denominator and a framework that is its name to the items’ details, walked after the line', () => {
        const { layout } = genderOf(item('Female', 15, 53.6, 28), item('Male', 13, 46.4, 28));
        const female = layout.places.get('slot:g:gender_distribution[#0].category')!.item!;
        const male = layout.places.get('slot:g:gender_distribution[#1].category')!.item!;
        expect(keys(female.detailsOnly)).toEqual(['[#0].reporting_framework']);
        expect(keys(male.detailsOnly)).toEqual(['[#1].denominator', '[#1].reporting_framework']);
        const walked = keys(layout.order);
        expect(walked.indexOf('[#1].denominator')).toBeGreaterThan(walked.indexOf('[#0].denominator'));
    });

    it('folds a count not reported, in the card’s fold and its item’s', () => {
        const { layout, line } = genderOf(
            {
                ...item('Female', undefined, 53.6, 28),
                count: notReported('not_in_text'),
                category_normalized: ev('female'),
            },
            item('Male', 13, 46.4, 28)
        );
        expect(line).toBe('Female 53.6% · Male 13 (46.4%) of 28');
        const female = layout.places.get('slot:g:gender_distribution[#0].category')!.item!;
        expect(keys(female.folded)).toEqual(['[#0].count']);
        expect(keys(layout.folded)).toContain('[#0].count');
        expect(keys(female.detailsOnly)).toEqual(['[#0].reporting_framework', '[#0].category_normalized']);
    });

    it('marks an item whose count and percentage disagree with its denominator', () => {
        expect(genderOf(item('Female', 15, 60, 28), item('Male', 13, 46.4, 28)).line).toBe(
            'Female 15 (60%) ⚠ · Male 13 (46.4%) of 28'
        );
    });

    it('says each denominator where they differ', () => {
        expect(genderOf(item('Female', 15, 53.6, 28), item('Male', 13, 43.3, 30)).line).toBe(
            'Female 15 of 28 (53.6%) · Male 13 of 30 (43.3%)'
        );
    });

    it('shows only the percentages, or only the counts, where that is all the record has', () => {
        expect(genderOf(item('Female', undefined, 53.6), item('Male', undefined, 46.4)).line).toBe(
            'Female 53.6% · Male 46.4%'
        );
        expect(genderOf(item('Female', 15), item('Male', 13)).line).toBe('Female 15 · Male 13');
    });

    it('says a shared framework other than its label', () => {
        const other = { ...item('Female', 15), reporting_framework: ev('Sex assigned at birth') };
        expect(genderOf(other, { ...other, category: ev('Male') }).line).toBe(
            'Female 15 · Male 15, as Sex assigned at birth'
        );
    });
});
