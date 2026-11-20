import type { Op } from '../contract/generated/review-ops';
import { API_BASE, requestProblems, responseProblems } from './spec';

const url = (path: string) => `${API_BASE}${path}`;
const signedIn = new Headers({ Authorization: 'Bearer token-1' });
const verdict = (id: string): Op => ({
    client_op_id: id,
    type: 'verdict',
    target: { kind: 'entity', entity: 'grp_a' },
    verdict: 'accept',
});
const batch = (ops: unknown[]) => ({ expected_last_seq: 0, ops });

describe('the spec helper', () => {
    it.each([
        ['a bundle read with a bearer token', 'GET', url('/review/sources/S1/bundle'), signedIn, undefined],
        ['a batch of one verdict', 'POST', url('/review/reviews/R1/ops'), signedIn, batch([verdict('op-00001')])],
    ])('passes %s', (_name, method, address, headers, body) => {
        expect(requestProblems(method, address, headers, body)).toEqual([]);
    });

    it.each([
        ['an empty batch', 'POST', '/review/reviews/R1/ops', signedIn, batch([])],
        [
            '501 ops',
            'POST',
            '/review/reviews/R1/ops',
            signedIn,
            batch(Array.from({ length: 501 }, (_, i) => verdict(`op-${String(i).padStart(6, '0')}`))),
        ],
        ['a bad op', 'POST', '/review/reviews/R1/ops', signedIn, batch([{ client_op_id: 'op-00001', type: 'nope' }])],
        [
            'an op without a client_op_id',
            'POST',
            '/review/reviews/R1/ops',
            signedIn,
            batch([{ ...verdict('op-00001'), client_op_id: undefined }]),
        ],
        [
            'a batch without expected_last_seq',
            'POST',
            '/review/reviews/R1/ops',
            signedIn,
            { ops: [verdict('op-00001')] },
        ],
        ['no token', 'GET', '/review/sources/S1/bundle', new Headers(), undefined],
        [
            'a token that is not a bearer',
            'GET',
            '/review/sources/S1/bundle',
            new Headers({ Authorization: 'Basic x' }),
            undefined,
        ],
        ['a body on a GET', 'GET', '/review/sources/S1/bundle', signedIn, { ops: [] }],
        ['a query value that is not a page number', 'GET', '/review/sources/?page=abc', signedIn, undefined],
        ['a query parameter the spec does not have', 'GET', '/review/sources/?bogus=1', signedIn, undefined],
        ['a path the spec does not have', 'GET', '/review/nope', signedIn, undefined],
        ['a method the path does not take', 'DELETE', '/review/sources/S1/bundle', signedIn, undefined],
        ['a review state the spec does not have', 'PATCH', '/review/reviews/R1', signedIn, { state: 'archived' }],
    ])('flags %s', (_name, method, path, headers, body) => {
        const address = path.startsWith('http') ? path : url(path);
        expect(requestProblems(method, address, headers, body).length).toBeGreaterThan(0);
    });

    it('passes a source page the spec describes', () => {
        expect(
            responseProblems('GET', url('/review/sources/'), 200, { metadata: { total_count: 0 }, results: [] })
        ).toEqual([]);
    });

    it.each([
        ['an op answer whose ops are not a list', 'POST', '/review/reviews/R1/ops', 200, { ops: 'none' }],
        [
            'a source page whose count is not a number',
            'GET',
            '/review/sources/',
            200,
            { metadata: { total_count: 'many' }, results: [] },
        ],
    ])('flags %s', (_name, method, path, status, body) => {
        expect(responseProblems(method, url(path), status, body).length).toBeGreaterThan(0);
    });
});
