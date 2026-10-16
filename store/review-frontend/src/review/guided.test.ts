import { buildRecordIndex, withHidden } from '../model/record';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { auditMatrix, guidedCards } from './guided';

const record = {
    analyses: [
        { local_id: 'a_2', name: ev('Second'), acquisitions: ['acq_1'], tasks: ['task_1'] },
        { local_id: 'a_h', name: ev('Hidden'), regions: ['reg_h'] },
        {
            local_id: 'a_1',
            name: ev('First'),
            measure: 'mea_1',
            acquisitions: ['acq_1'],
            groups: [{ group: 'grp_a', n: ev(20) }],
        },
    ],
    groups: [
        { local_id: 'grp_a', name: ev('Patients') },
        { local_id: 'grp_z', name: ev('Unused') },
    ],
    acquisitions: [{ local_id: 'acq_1', name: ev('Scan'), device: 'dev_1' }],
    devices: [{ local_id: 'dev_1', name: ev('Scanner') }],
    measures: [{ local_id: 'mea_1', name: ev('BOLD') }],
    tasks: [{ local_id: 'task_1', name: ev('Stroop'), conditions: [{ local_id: 'cond_1', name: ev('Incongruent') }] }],
    regions: [{ local_id: 'reg_h', name: ev('Insula') }],
    coordinate_sets: [{ local_id: 'cs_1', name: ev('Table 1'), analysis: 'a_1' }],
};

const entities = entityRows(
    row('a_2', 'Analysis', 'analyses'),
    row('a_h', 'Analysis', 'analyses'),
    row('a_1', 'Analysis', 'analyses'),
    row('grp_a', 'Group', 'groups'),
    row('grp_z', 'Group', 'groups'),
    row('acq_1', 'Acquisition', 'acquisitions'),
    row('dev_1', 'Device', 'devices'),
    row('mea_1', 'Measure', 'measures'),
    row('task_1', 'Task', 'tasks'),
    row('cond_1', 'Condition', 'tasks[#0].conditions', { parent: 'task_1' }),
    row('reg_h', 'Region', 'regions'),
    row('cs_1', 'CoordinateSet', 'coordinate_sets')
);

const bundle = makeBundle(record, '', {
    entities,
    hidden: { analyses: ['a_h'], entities: ['reg_h'] },
});
const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id);

describe('the guided cards', () => {
    it('lists the analyses in record order, leaving out hidden ones unless shown, then last', () => {
        const index = buildRecordIndex(bundle);
        expect(ids(guidedCards(index).analyses)).toEqual(['a_2', 'a_1']);
        const shown = withHidden(index, true);
        expect(ids(guidedCards(shown).analyses)).toEqual(['a_2', 'a_1', 'a_h']);
    });

    it('lists the entities the analyses reach once each, most used first, then by class and name', () => {
        const cards = guidedCards(buildRecordIndex(bundle));
        expect(ids(cards.entities)).toEqual(['acq_1', 'dev_1', 'cond_1', 'cs_1', 'grp_a', 'mea_1', 'task_1']);
        expect(cards.reach.get('acq_1')).toBe(2);
        expect(cards.reach.get('grp_a')).toBe(1);
    });

    it('gives each entity the links that point at it', () => {
        const cards = guidedCards(buildRecordIndex(bundle));
        expect(cards.linksInto('acq_1').map(({ entity, slot }) => `${entity.id} ${slot.path}`)).toEqual([
            'a_2 acquisitions',
            'a_1 acquisitions',
        ]);
        expect(cards.linksInto('grp_a').map(({ slot }) => slot.path)).toEqual(['groups[#0].group']);
    });

    it('leaves as leftovers the entities no analysis reaches, but not the study', () => {
        const index = buildRecordIndex(bundle);
        expect(ids(guidedCards(index).leftovers)).toEqual(['grp_z']);
        expect(ids(guidedCards(withHidden(index, true)).entities)).toContain('reg_h');
    });
});

describe('the guided cards of several records', () => {
    const other = makeBundle(
        {
            analyses: [{ local_id: 'b_1', name: ev('Only'), groups: [{ group: 'grp_q', n: ev(1) }] }],
            groups: [{ local_id: 'grp_q', name: ev('Quiet') }],
        },
        '',
        {
            entities: entityRows(row('b_1', 'Analysis', 'analyses'), row('grp_q', 'Group', 'groups')),
        }
    );

    it('keeps the cards of each index apart when calls interleave', () => {
        const first = buildRecordIndex(bundle);
        const second = buildRecordIndex(other);
        const cardsOfFirst = guidedCards(first);
        expect(ids(guidedCards(second).analyses)).toEqual(['b_1']);
        expect(ids(guidedCards(second).entities)).toEqual(['grp_q']);
        expect(guidedCards(first)).toBe(cardsOfFirst);
        expect(ids(guidedCards(first).analyses)).toEqual(['a_2', 'a_1']);
        expect(ids(auditMatrix(second).rows)).toEqual(['b_1']);
        expect(ids(auditMatrix(first).rows)).toEqual(['a_2', 'a_1']);
    });

    it('orders entities reached once each by name, not in the order they were reached', () => {
        const named = makeBundle(
            {
                analyses: [
                    {
                        local_id: 'a_1',
                        groups: [
                            { group: 'grp_b', n: ev(1) },
                            { group: 'grp_a', n: ev(1) },
                        ],
                    },
                ],
                groups: [
                    { local_id: 'grp_b', name: ev('Beta') },
                    { local_id: 'grp_a', name: ev('Alpha') },
                ],
            },
            '',
            {
                entities: entityRows(
                    row('a_1', 'Analysis', 'analyses'),
                    row('grp_b', 'Group', 'groups'),
                    row('grp_a', 'Group', 'groups')
                ),
            }
        );
        expect(ids(guidedCards(buildRecordIndex(named)).entities)).toEqual(['grp_a', 'grp_b']);
    });
});
