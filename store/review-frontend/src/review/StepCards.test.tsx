import { within } from '@testing-library/react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { EntityNode } from '../model/record';
import { ev, makeBundle } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { StepCards } from './StepCards';

const study = { id: 'study', name: 'A study', entityClass: 'Study', spans: [], slots: [] } as unknown as EntityNode;

describe('a card’s provenance badge', () => {
    it('names the reviewer who made the change', () => {
        const bundle = makeBundle({ description: ev('A study') }, 'Text of the paper.', {
            reviewers: [{ user_id: 'ana', name: 'Ana', state: 'in_progress', op_count: 1, last_edit_at: null }],
            review: {
                id: 'R1',
                user_id: 'ana',
                state: 'in_progress',
                last_seq: 1,
                provenance: { 'entity:study': { state: 'verified', user_id: 'ana', at: '2026-10-16T10:00:00Z' } },
                annotations: {},
            } as unknown as ReviewBundle['review'],
        });
        renderWithStores(<StepCards step="leftovers" label="Study" cards={[study]} />, bundle);
        const head = document.querySelector('[data-card="study"]') as HTMLElement;
        expect(within(head).getByText('verified by Ana')).toBeInTheDocument();
    });
});
