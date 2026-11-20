import { displayName, reviewerName } from './people';

const reviewers = [
    { user_id: 'ana', name: 'Ana', state: 'in_progress' as const, op_count: 1, last_edit_at: null },
    { user_id: 'ben', name: null, state: 'submitted' as const, op_count: 0, last_edit_at: null },
];

describe('displayName', () => {
    it('is the name, or the id when there is no name', () => {
        expect(displayName({ user_id: 'ana', name: 'Ana' })).toBe('Ana');
        expect(displayName({ user_id: 'ben', name: null })).toBe('ben');
    });
});

describe('reviewerName', () => {
    it('names a reviewer of the paper, or falls back to the id when the name is not known', () => {
        expect(reviewerName(reviewers, 'ana')).toBe('Ana');
        expect(reviewerName(reviewers, 'ben')).toBe('ben');
        expect(reviewerName(reviewers, 'cy')).toBe('cy');
    });
});
