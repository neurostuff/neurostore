import { pointColumns, pairProblems, toPoints, toRows } from './pointRows';

const POINT = {
    coordinates: [-12, -11, 46] as [number, number, number],
    values: [
        { kind: 't', value: 2.28, correction: 'fwe' },
        { kind: 'z', value: 2.1 },
    ],
    cluster_size: 59,
    cluster_measure: 'voxels',
    row: 3,
    column_group: 0,
    text_span: { start_char: 1, end_char: 5 },
};

describe('the point grid’s columns', () => {
    it('are the schema’s point fields: x, y and z, the first value’s kind and value, then numbers, choices, text and switches', () => {
        // Within a kind, the columns keep the order the LinkML declares the point's attributes in: space before cluster measure.
        expect(pointColumns().map((c) => [c.header, c.kind])).toEqual([
            ['x', 'number'],
            ['y', 'number'],
            ['z', 'number'],
            ['statistic', 'dropdown'],
            ['value', 'number'],
            ['cluster size', 'number'],
            ['space', 'dropdown'],
            ['cluster measure', 'dropdown'],
            ['label', 'text'],
            ['is subpeak', 'checkbox'],
        ]);
    });

    it('require x, y and z, take the schema’s bounds and choices, and show the analysis’s space in an empty space cell', () => {
        const columns = pointColumns('MNI');
        expect(columns.filter((c) => c.required).map((c) => c.header)).toEqual(['x', 'y', 'z']);
        expect(columns.find((c) => c.header === 'cluster size')?.minimum).toBe(0);
        expect(columns.find((c) => c.header === 'space')).toMatchObject({
            options: ['MNI', 'TAL', 'OTHER'],
            placeholder: 'MNI (from analysis)',
        });
        expect(columns.find((c) => c.header === 'statistic')?.open).toBe(true);
    });

    it('show the coordinates, the value and the cluster size first, the rest when asked for', () => {
        expect(pointColumns('MNI', false).map((c) => c.header)).toEqual([
            'x',
            'y',
            'z',
            'statistic',
            'value',
            'cluster size',
        ]);
    });
});

describe('points as rows and back', () => {
    it('keeps what the grid does not show: where the point was read, and the values after the first', () => {
        expect(toPoints(toRows([POINT]))).toEqual([POINT]);
    });

    it('takes the edited cells as numbers, and drops an emptied field', () => {
        const [row] = toRows([POINT]);
        const edited = { ...row, z: '48', 'values.value': '3.1', cluster_size: '' };
        const [point] = toPoints([edited]);
        expect(point.coordinates).toEqual([-12, -11, 48]);
        expect(point.values).toEqual([{ kind: 't', value: 3.1, correction: 'fwe' }, POINT.values[1]]);
        expect(point).not.toHaveProperty('cluster_size');
    });

    it('makes a new row a point of its own', () => {
        expect(toPoints([{ x: 1, y: '2', z: 3, 'values.kind': 'p', 'values.value': 0.01, is_subpeak: true }])).toEqual([
            { coordinates: [1, 2, 3], values: [{ kind: 'p', value: 0.01 }], is_subpeak: true },
        ]);
    });

    it('asks for a value’s kind with its value, and the other way round', () => {
        expect(pairProblems(toRows([POINT]))).toEqual([]);
        expect(pairProblems([{ x: 1, y: 2, z: 3, 'values.value': 2 }])).toEqual(['row 1: a value needs its statistic']);
    });
});
