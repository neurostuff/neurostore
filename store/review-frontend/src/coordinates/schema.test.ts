import type { Schema } from '../model/schema';
import { analysisFields, coordinateSchema, gridColumns, pointFields } from './schema';

const STATISTICS = ['t', 'z', 'f', 'chi_square', 'd', 'g', 'r', 'beta', 'p', 'other'];

describe('point fields from the coordinate-parse schema', () => {
    it('edits a point’s coordinates as three numbers, its values by kind and value, and its other attributes', () => {
        expect(pointFields(coordinateSchema())).toEqual([
            {
                name: 'coordinates',
                label: 'coordinates',
                kind: 'vector',
                axes: ['x', 'y', 'z'],
                item: { kind: 'number', integer: false },
                required: true,
            },
            {
                name: 'values',
                label: 'values',
                kind: 'records',
                fields: [
                    { name: 'kind', label: 'kind', spec: { kind: 'enum', options: STATISTICS, open: true } },
                    { name: 'value', label: 'value', spec: { kind: 'number', integer: false } },
                ],
                required: false,
            },
            {
                name: 'cluster_size',
                label: 'cluster size',
                kind: 'scalar',
                spec: { kind: 'number', integer: false, minimum: 0 },
                required: false,
            },
            {
                name: 'cluster_measure',
                label: 'cluster measure',
                kind: 'scalar',
                spec: { kind: 'enum', options: ['voxels', 'mm3', 'cm3', 'other'], open: false },
                required: false,
            },
            {
                name: 'space',
                label: 'space',
                kind: 'scalar',
                spec: { kind: 'enum', options: ['MNI', 'TAL', 'OTHER'], open: false },
                required: false,
            },
            { name: 'label', label: 'label', kind: 'scalar', spec: { kind: 'text' }, required: false },
            { name: 'is_subpeak', label: 'is subpeak', kind: 'scalar', spec: { kind: 'boolean' }, required: false },
        ]);
    });

    it('leaves out where a point was read from: its row, column group and text span', () => {
        const names = pointFields(coordinateSchema()).map((field) => field.name);
        expect(names).not.toEqual(expect.arrayContaining(['row']));
        expect(names).not.toContain('column_group');
        expect(names).not.toContain('text_span');
    });

    it('gives a property the schema adds an editor of its own, with no code change', () => {
        const root: Schema = {
            properties: { analyses: { items: { $ref: '#/$defs/A' } } },
            $defs: {
                A: {
                    type: 'object',
                    properties: { points: { type: ['array', 'null'], items: { $ref: '#/$defs/P' } } },
                },
                P: {
                    type: 'object',
                    required: ['coordinates'],
                    properties: {
                        coordinates: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                        peak_height: { type: ['integer', 'null'], maximum: 9 },
                    },
                },
            },
        };
        expect(pointFields(root)).toEqual([
            {
                name: 'coordinates',
                label: 'coordinates',
                kind: 'vector',
                axes: ['1', '2'],
                item: { kind: 'number', integer: false },
                required: true,
            },
            {
                name: 'peak_height',
                label: 'peak height',
                kind: 'scalar',
                spec: { kind: 'number', integer: true, maximum: 9 },
                required: false,
            },
        ]);
    });
});

describe('the points grid', () => {
    it('shows x, y, z, the values, the cluster size and the label', () => {
        expect(gridColumns(pointFields(coordinateSchema())).map((column) => column.label)).toEqual([
            'x',
            'y',
            'z',
            'values',
            'cluster size',
            'label',
        ]);
    });

    it('formats a point’s cells from its fields', () => {
        const columns = gridColumns(pointFields(coordinateSchema()));
        const point = {
            coordinates: [-12, 4.5, 46],
            values: [
                { kind: 't', value: 2.28 },
                { kind: 'p', value: 0.001, correction: 'fwe' },
            ],
            cluster_size: 59,
            cluster_measure: 'voxels',
        };
        expect(columns.map((column) => column.text(point))).toEqual(['-12', '4.5', '46', 't 2.28, p 0.001', '59', '']);
    });
});

describe('analysis fields', () => {
    it('offers the schema’s coordinate roles and reported spaces', () => {
        expect(analysisFields(coordinateSchema())).toEqual({
            name: { kind: 'text' },
            role: { kind: 'enum', options: ['result', 'anchor', 'localization', 'reference', 'other'], open: true },
            coordinate_space: { kind: 'enum', options: ['MNI', 'TAL', 'OTHER'], open: false },
        });
    });
});
