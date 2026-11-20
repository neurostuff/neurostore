import { vi } from 'vitest';
import { createReviewStores } from '../store/reviewStores';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { createSibling, danglingLinks, linkCandidates, siblingClasses } from './actions';

const record = {
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Main effect'),
            mirror_of: 'a_2',
            effect: { terms: [{ local_id: 't_1' }, { local_id: 't_2', interaction_with: ['t_1'] }] },
        },
        { local_id: 'a_2', name: ev('Mirror') },
        { local_id: 'a_3', name: ev('Other'), effect: { terms: [{ local_id: 't_3', interaction_with: ['t_1'] }] } },
    ],
    coordinate_sets: [{ local_id: 'cs_1', analysis: 'a_1' }],
    assessments: [{ local_id: 'asm_1', name: ev('Anxiety') }],
};

const entities = entityRows(
    row('a_1', 'Analysis', 'analyses'),
    row('a_2', 'Analysis', 'analyses'),
    row('a_3', 'Analysis', 'analyses'),
    row('t_1', 'ModelTerm', 'effect.terms', { parent: 'a_1' }),
    row('t_2', 'ModelTerm', 'effect.terms', { parent: 'a_1' }),
    row('t_3', 'ModelTerm', 'effect.terms', { parent: 'a_3' }),
    row('cs_1', 'CoordinateSet', 'coordinate_sets'),
    row('asm_1', 'Assessment', 'assessments')
);

const state = () => createReviewStores(makeBundle(record, 'x'.repeat(10), { entities })).session.getState();

describe('link candidates', () => {
    it('offers entities of the slot’s class, leaving out the entity itself and what it links already', () => {
        const s = state();
        expect(linkCandidates(s, s.index.slot('slot:a_1:mirror_of')!)).toEqual([{ id: 'a_3', name: 'Other' }]);
    });
    it('offers an entity by its schema class too, when its list holds another class', () => {
        const withMeasure = createReviewStores(
            makeBundle(record, 'x'.repeat(10), {
                entities: [...entities, row('x_1', 'Measure', 'measures', { schema_class: 'Assessment' })],
            })
        ).session.getState();
        expect(linkCandidates(withMeasure, withMeasure.index.slot('slot:a_1:assessments')!)).toEqual([
            { id: 'asm_1', name: 'Anxiety' },
            { id: 'x_1', name: 'x_1' },
        ]);
    });
});

describe('a reference the record leaves out', () => {
    it('offers its target entities, so it can be linked', () => {
        const s = state();
        expect(linkCandidates(s, s.index.slot('slot:a_1:assessments')!)).toEqual([{ id: 'asm_1', name: 'Anxiety' }]);
    });
});

describe('creating in a nested list', () => {
    it('creates the entity under the list’s parent, not the study', () => {
        const store = createReviewStores(makeBundle(record, 'x'.repeat(10), { entities }));
        store.view.getState().focusEntity('t_1');
        const emit = vi.fn(() => true);
        store.session.setState({ emit });
        createSibling(store, 'ModelTerm');
        expect(emit).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'create_entity', parent: 'a_1', list: 'effect.terms' })
        );
    });
});

describe('creating with no parent', () => {
    it('creates nothing in a list whose entity has no parent, even when a class is named', () => {
        const withGroup = { ...record, groups: [{ local_id: 'x_2', name: ev('Extra') }] };
        const store = createReviewStores(
            makeBundle(withGroup, 'x'.repeat(10), {
                entities: [...entities, row('x_2', 'Group', 'groups', { parent: '' })],
            })
        );
        store.view.getState().focusEntity('x_2');
        const emit = vi.fn(() => true);
        store.session.setState({ emit });
        expect(createSibling(store, 'Group')).toBe(false);
        expect(emit).not.toHaveBeenCalled();
    });
});

describe('creating what the schema would refuse', () => {
    it('sends nothing for an analysis when the record holds no measure for it', () => {
        const store = createReviewStores(makeBundle(record, 'x'.repeat(10), { entities }));
        store.view.getState().focusEntity('a_2');
        const emit = vi.fn(() => true);
        store.session.setState({ emit });
        expect(createSibling(store, 'Analysis')).toBe(false);
        expect(emit).not.toHaveBeenCalled();
    });
});

describe('dangling links', () => {
    it('lists the links from elsewhere to the deleted entity and what is nested in it, not those among them', () => {
        const s = state();
        expect(danglingLinks(s, 'a_1').map(({ entity, slot, target }) => [entity.id, slot.path, target])).toEqual([
            ['t_3', 'interaction_with', 't_1'],
            ['cs_1', 'analysis', 'Main effect'],
        ]);
    });

    it('lists a link to a nested entity from one beside it', () => {
        const s = state();
        expect(danglingLinks(s, 't_1').map(({ entity, slot }) => [entity.id, slot.path])).toEqual([
            ['t_2', 'interaction_with'],
            ['t_3', 'interaction_with'],
        ]);
    });
});

describe('the classes a sibling can take', () => {
    it('are worked out again for another bundle holding the same record', () => {
        const s = state();
        expect(siblingClasses(s, 'a_2').map((c) => c.name)).toEqual(['Analysis']);
        const orphaned = makeBundle(record, 'x'.repeat(10), {
            entities: entityRows({ ...row('a_2', 'Analysis', 'analyses'), parent: null }),
        });
        expect(siblingClasses({ bundle: orphaned, record: s.record }, 'a_2')).toEqual([]);
    });
});
