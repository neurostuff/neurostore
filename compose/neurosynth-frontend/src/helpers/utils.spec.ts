import { sortByOrder } from 'helpers/utils';

describe('sortByOrder', () => {
    it('sorts by order ascending', () => {
        const items = [
            { id: 'c', order: 2 },
            { id: 'a', order: 0 },
            { id: 'b', order: 1 },
        ];

        expect(sortByOrder(items).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });

    it('places items without order after numbered items', () => {
        const items = [{ id: 'none' }, { id: 'null-order', order: null }, { id: 'first', order: 0 }];

        expect(sortByOrder(items).map((item) => item.id)).toEqual(['first', 'none', 'null-order']);
    });

    it('uses created_at when order is missing or tied', () => {
        const items = [
            { id: 'newer', created_at: '2024-01-02T00:00:00.000Z' },
            { id: 'older', created_at: '2024-01-01T00:00:00.000Z' },
            { id: 'ordered', order: 1, created_at: '2025-01-01T00:00:00.000Z' },
        ];

        expect(sortByOrder(items).map((item) => item.id)).toEqual(['ordered', 'older', 'newer']);
    });

    it('places items without created_at after dated items when order is tied', () => {
        const items = [
            { id: 'no-date', order: 1 },
            { id: 'dated', order: 1, created_at: '2024-01-01T00:00:00.000Z' },
        ];

        expect(sortByOrder(items).map((item) => item.id)).toEqual(['dated', 'no-date']);
    });

    it('uses id when order and created_at are missing or tied', () => {
        const items = [
            { id: 'b', order: 1, created_at: '2024-01-01T00:00:00.000Z' },
            { id: 'a', order: 1, created_at: '2024-01-01T00:00:00.000Z' },
            { id: 'c' },
        ];

        expect(sortByOrder(items).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate the original array', () => {
        const items = [
            { id: 'b', order: 1 },
            { id: 'a', order: 0 },
        ];

        const sorted = sortByOrder(items);

        expect(sorted).not.toBe(items);
        expect(items.map((item) => item.id)).toEqual(['b', 'a']);
    });
});
