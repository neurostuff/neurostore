import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { humanize, plural, slotLabel } from './labels';
import { buildRecordIndex } from './record';

const record = {
    groups: [{ local_id: 'grp_a', name: ev('SAD-patients'), age_standard_deviation: ev(9.1) }],
    model_estimations: [{ local_id: 'mod_1', terms: [{ local_id: 'trm_1', name: ev('diagnosis') }] }],
    analyses: [
        {
            local_id: 'a_1',
            name: ev('SAD > HC'),
            groups: [{ group: 'grp_a', n: ev(174) }],
            effect: {
                cells: [
                    { term: 'trm_1', label: ev('HC-participants'), direction: ev('positive') },
                    { term: 'trm_1', direction: ev('negative') },
                    { direction: ev('none') },
                ],
                statistic: { family: ev('t') },
            },
        },
    ],
};

const index = buildRecordIndex(
    makeBundle(record, 'x'.repeat(50), {
        entities: entityRows(
            row('grp_a', 'Group', 'groups'),
            row('mod_1', 'ModelEstimation', 'model_estimations'),
            row('trm_1', 'ModelTerm', 'terms', { parent: 'mod_1' }),
            row('a_1', 'Analysis', 'analyses')
        ),
    })
);
const label = (entity: string, path: string) => slotLabel(index, { entity, path });

describe('slot labels', () => {
    it('names a slot by its humanized name', () => {
        expect(label('grp_a', 'age_standard_deviation')).toBe('Age standard deviation');
        expect(humanize('n')).toBe('n');
    });

    it('names a list item by its own label, never by its index', () => {
        expect(label('a_1', 'effect.cells[#0].direction')).toBe('HC-participants: direction');
    });

    it('names a list item by the entity it refers to when it has no label of its own', () => {
        expect(label('a_1', 'groups[#0].n')).toBe('SAD-patients: n');
        expect(label('a_1', 'effect.cells[#1].direction')).toBe('diagnosis: direction');
    });

    it('does not name an item by the reference the labelled slot holds, which would name the link by its target', () => {
        expect(label('a_1', 'groups[#0].group')).toBe('Group 1: group');
        expect(label('a_1', 'effect.cells[#0].term')).toBe('HC-participants: term');
    });

    it('names a list item with neither by its list and its place in it, counted from one', () => {
        expect(label('a_1', 'effect.cells[#2].direction')).toBe('Cell 3: direction');
    });

    it('names a slot of a nested object by the object and the slot', () => {
        expect(label('a_1', 'effect.statistic.family')).toBe('Statistic: family');
    });

    it('never shows a list index, for any slot of the index', () => {
        const labels = index.entities.flatMap((e) => e.slots.map((s) => slotLabel(index, s)));
        expect(labels.filter((text) => /\[#\d+\]/.test(text))).toEqual([]);
    });
});

describe('labels of items that share a name', () => {
    const shared = buildRecordIndex(
        makeBundle(
            {
                model_estimations: [{ local_id: 'mod_1', terms: [{ local_id: 'trm_1', name: ev('diagnosis') }] }],
                analyses: [
                    {
                        local_id: 'a_1',
                        name: ev('SAD > HC'),
                        effect: {
                            cells: [
                                { term: 'trm_1', direction: ev('positive') },
                                { term: 'trm_1', direction: ev('negative') },
                                { label: ev('HC'), direction: ev('none') },
                                { label: ev('HC'), direction: ev('none') },
                            ],
                        },
                    },
                ],
            },
            'x'.repeat(50),
            {
                entities: entityRows(
                    row('mod_1', 'ModelEstimation', 'model_estimations'),
                    row('trm_1', 'ModelTerm', 'terms', { parent: 'mod_1' }),
                    row('a_1', 'Analysis', 'analyses')
                ),
            }
        )
    );
    const at = (path: string) => slotLabel(shared, { entity: 'a_1', path });

    it('tells apart items that refer to the same entity by their place in the list', () => {
        expect(at('effect.cells[#0].direction')).toBe('diagnosis · cell 1: direction');
        expect(at('effect.cells[#1].direction')).toBe('diagnosis · cell 2: direction');
    });

    it('tells apart items that carry the same label', () => {
        expect(at('effect.cells[#2].direction')).toBe('HC · cell 3: direction');
        expect(at('effect.cells[#3].direction')).toBe('HC · cell 4: direction');
    });

    it('leaves the place out of the name of an item no other item shares a name with', () => {
        expect(label('a_1', 'effect.cells[#0].direction')).toBe('HC-participants: direction');
    });
});

describe('the item of a list with no name', () => {
    const lists = buildRecordIndex(
        makeBundle(
            {
                analyses: [
                    {
                        local_id: 'a_1',
                        classes: [{ score: ev(1) }],
                        paper_sections: [{ score: ev(1) }],
                        edges: [{ score: ev(1) }],
                        performance_metrics: [{ score: ev(1) }],
                    },
                ],
            },
            'x'.repeat(50),
            { entities: entityRows(row('a_1', 'Analysis', 'analyses')) }
        )
    );
    it.each([
        ['classes', 'Class 1'],
        ['paper_sections', 'Paper section 1'],
        ['edges', 'Edge 1'],
        ['performance_metrics', 'Performance metric 1'],
    ])('is named by its list, %s, in the singular', (list, name) => {
        expect(slotLabel(lists, { entity: 'a_1', path: `${list}[#0].score` })).toBe(`${name}: score`);
    });
});

describe('plurals', () => {
    it('name several of a thing', () => {
        expect(['acquisition', 'analysis', 'inference settings', 'study'].map(plural)).toEqual([
            'acquisitions',
            'analyses',
            'inference settings',
            'studies',
        ]);
    });
});
