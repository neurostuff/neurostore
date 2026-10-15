import { vi } from 'vitest';
import { createReviewStore } from '../store/reviewStore';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { createSibling, danglingLinks, linkCandidates } from './actions';

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

const state = () => createReviewStore(makeBundle(record, 'x'.repeat(10), { entities })).getState();

describe('link candidates', () => {
    it('offers entities of the slot’s class, leaving out the entity itself and what it links already', () => {
        const s = state();
        expect(linkCandidates(s, s.index.slot('slot:a_1:mirror_of')!)).toEqual([{ id: 'a_3', name: 'Other' }]);
    });
    it('offers an entity by its schema class too, when its list holds another class', () => {
        const withMeasure = createReviewStore(
            makeBundle(record, 'x'.repeat(10), {
                entities: [...entities, row('x_1', 'Measure', 'measures', { schema_class: 'Assessment' })],
            })
        ).getState();
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
        const store = createReviewStore(makeBundle(record, 'x'.repeat(10), { entities }));
        store.getState().focusEntity('t_1');
        const emit = vi.fn(() => true);
        createSibling({ ...store.getState(), emit }, 'ModelTerm');
        expect(emit).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'create_entity', parent: 'a_1', list: 'effect.terms' })
        );
    });
});

describe('creating with no parent', () => {
    it('creates nothing in a list whose entity has no parent, even when a class is named', () => {
        const withGroup = { ...record, groups: [{ local_id: 'x_2', name: ev('Extra') }] };
        const store = createReviewStore(
            makeBundle(withGroup, 'x'.repeat(10), {
                entities: [...entities, row('x_2', 'Group', 'groups', { parent: '' })],
            })
        );
        store.getState().focusEntity('x_2');
        const emit = vi.fn(() => true);
        expect(createSibling({ ...store.getState(), emit }, 'Group')).toBe(false);
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
