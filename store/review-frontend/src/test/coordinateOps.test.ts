import { coordinateOpErrors } from './schemas';

const target = { kind: 'coordinate_analysis', analysis_key: 'analysis#00000000000000a1' };
const op = (rest: object) => ({ client_op_id: 'coord-0001', type: 'coordinate', target, ...rest });
const POINT = { coordinates: [1, 2, 3], values: [{ kind: 't', value: 4 }] };

describe('the coordinate op fixture', () => {
    it.each([
        ['relabel', op({ action: 'relabel', role: 'anchor' })],
        ['edit_points', op({ action: 'edit_points', payload: { points: [POINT] } })],
        ['split', op({ action: 'split', payload: { parts: [{ indices: [1] }, { indices: [0, 2], name: 'B' }] } })],
        ['merge', op({ action: 'merge', payload: { with: ['analysis#00000000000000b2'] } })],
        [
            'add',
            op({
                action: 'add',
                target: { kind: 'coordinate_parse' },
                payload: { analysis: { origin: 'table', table_id: 't1', name: 'A', role: 'result', points: [POINT] } },
            }),
        ],
    ])('takes %s as the op shapes it', (_, shaped) => {
        expect(coordinateOpErrors([shaped])).toEqual([]);
    });

    it.each([
        ['an accept, which is a verdict op', op({ action: 'accept' })],
        ['an omit, which is a reject verdict', op({ action: 'omit', note: 'not coordinates' })],
        ['relabel without a role', op({ action: 'relabel' })],
        ['a point with two coordinates', op({ action: 'edit_points', payload: { points: [{ coordinates: [1, 2] }] } })],
        ['a split into one part', op({ action: 'split', payload: { parts: [{ indices: [0] }] } })],
        ['a merge with nothing', op({ action: 'merge', payload: { with: [] } })],
        [
            'a merge naming one analysis twice',
            op({ action: 'merge', payload: { with: ['analysis#00000000000000b2', 'analysis#00000000000000b2'] } }),
        ],
        ['a split with no payload', op({ action: 'split' })],
        [
            'an added analysis with a key',
            op({
                action: 'add',
                target: { kind: 'coordinate_parse' },
                payload: { analysis: { key: 'analysis#0000000000000001', origin: 'text', name: 'A', role: 'result' } },
            }),
        ],
        [
            'an add on an analysis',
            op({ action: 'add', payload: { analysis: { origin: 'text', name: 'A', role: 'result' } } }),
        ],
    ])('refuses %s', (_, shaped) => {
        expect(coordinateOpErrors([shaped])).not.toEqual([]);
    });
});
