import {
    getHotTableInsertionIndex,
    getSelectionRowBounds,
    pointsFromSourceData,
} from './EditStudyAnalysisCBMAPointsHotTable.helpers';

describe('getHotTableInsertionIndex', () => {
    it('returns the first row when nothing is selected', () => {
        expect(getHotTableInsertionIndex([])).toBe(0);
    });

    it('uses the last cell of a downward selection', () => {
        expect(getHotTableInsertionIndex([[1, 0, 3, 2]])).toBe(3);
    });

    it('uses the last cell when the selection was dragged upward', () => {
        expect(getHotTableInsertionIndex([[4, 2, 1, 0]])).toBe(1);
    });

    it('uses the last cell of the latest range', () => {
        expect(
            getHotTableInsertionIndex([
                [5, 0, 2, 1],
                [0, 0, 1, 1],
            ])
        ).toBe(1);
    });
});

describe('getSelectionRowBounds', () => {
    it('returns nothing when nothing is selected', () => {
        expect(getSelectionRowBounds([])).toBeUndefined();
    });

    it('counts a downward selection from its top to its bottom', () => {
        expect(getSelectionRowBounds([[1, 0, 3, 2]])).toEqual({ top: 1, bottom: 3, count: 3 });
    });

    it('counts an upward selection from its top to its bottom', () => {
        expect(getSelectionRowBounds([[4, 2, 1, 0]])).toEqual({ top: 1, bottom: 4, count: 4 });
    });
});

describe('pointsFromSourceData', () => {
    it('turns blank cells into undefined and keeps a saved row identity', () => {
        const [row] = pointsFromSourceData([
            {
                id: 'saved-id',
                isNew: false,
                x: '',
                y: null,
                z: 0,
                value: '',
                cluster_size: null,
                subpeak: false,
                deactivation: null,
            },
        ]);

        expect(row.deactivation).toBeUndefined();
        expect(row).toMatchObject({
            id: 'saved-id',
            isNew: false,
            x: undefined,
            y: undefined,
            z: 0,
            value: undefined,
            cluster_size: undefined,
            subpeak: false,
        });
    });

    it('gives a new row an id and marks it new', () => {
        const [row] = pointsFromSourceData([null]);

        expect(row.id).toEqual(expect.any(String));
        expect(row.id).not.toBe('');
        expect(row.isNew).toBe(true);
        expect(row.x).toBeUndefined();
    });
});
