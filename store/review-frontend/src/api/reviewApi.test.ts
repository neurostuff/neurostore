import { ApiError, watchForbidden, withState, type ReviewApi } from './reviewApi';

const calls: Record<keyof ReviewApi, (api: ReviewApi) => Promise<unknown>> = {
    listPapers: (api) => api.listPapers(),
    getBundle: (api) => api.getBundle('S1'),
    startReview: (api) => api.startReview('S1'),
    postOps: (api) => api.postOps('R1', 0, []),
    setState: (api) => api.setState('R1', 'submitted'),
    getSchema: (api) => api.getSchema('coordinate-parse'),
};

function failingWith(error: unknown): ReviewApi {
    const reject = () => Promise.reject(error);
    return {
        listPapers: reject,
        getBundle: reject,
        startReview: reject,
        postOps: reject,
        setState: reject,
        getSchema: reject,
    };
}

describe('watchForbidden', () => {
    it.each(Object.keys(calls) as (keyof ReviewApi)[])(
        'reports a 403 from %s and passes the error on',
        async (method) => {
            const onForbidden = vi.fn();
            const watched = watchForbidden(failingWith(new ApiError(403, { detail: 'no' })), onForbidden);
            await expect(calls[method](watched)).rejects.toMatchObject({ status: 403 });
            expect(onForbidden).toHaveBeenCalledTimes(1);
        }
    );

    it.each(Object.keys(calls) as (keyof ReviewApi)[])('does not report a 401 or a 404 from %s', async (method) => {
        const onForbidden = vi.fn();
        for (const status of [401, 404]) {
            const watched = watchForbidden(failingWith(new ApiError(status, {})), onForbidden);
            await expect(calls[method](watched)).rejects.toMatchObject({ status });
        }
        expect(onForbidden).not.toHaveBeenCalled();
    });
});

describe('withState', () => {
    const review = { state: 'in_progress' as const, last_seq: 3 };

    it('moves the review to the state, with the set-aside reason only while set aside', () => {
        const aside = withState(review, 'set_aside', { reason: 'duplicate', note: null });
        expect(aside).toEqual({ state: 'set_aside', last_seq: 3, set_aside: { reason: 'duplicate', note: null } });
        const resumed = withState(aside, 'in_progress');
        expect(resumed).toEqual(review);
        expect('set_aside' in resumed).toBe(false);
        expect(review).toEqual({ state: 'in_progress', last_seq: 3 });
    });
});
