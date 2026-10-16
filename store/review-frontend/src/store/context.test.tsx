import { act, renderHook } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ev, makeBundle } from '../test/bundles';
import { fakeServer } from '../test/fakeServer';
import { useOpClient, useReviewSession } from './context';

describe('useOpClient', () => {
    it('throws without an OpClientProvider, as its sibling hooks do', () => {
        expect(() => renderHook(() => useOpClient())).toThrow('useOpClient needs an OpClientProvider');
    });
});

describe('useReviewSession', () => {
    const source = makeBundle({ task: ev('Stroop') }, 'A Stroop task.', {
        source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
    });
    const setTask: Op = {
        client_op_id: 't-1',
        type: 'set_value',
        target: { kind: 'slot', entity: 'study', path: 'task' },
        value: { extraction_status: 'extracted', value: 'n-back' },
    };
    const posts = (server: ReturnType<typeof fakeServer>) => server.requests.filter((r) => r.method === 'POST');

    it('makes the stores and op client once, saving while mounted and flushing on unmount', async () => {
        const server = fakeServer([source]);
        await server.backend.startReview('S1');
        const bundle = await server.backend.getBundle('S1');
        const api = server.api();
        const { result, rerender, unmount } = renderHook(() => useReviewSession(bundle, api));
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
        act(() => void first.stores.session.getState().emit(setTask));
        window.dispatchEvent(new Event('blur'));
        await act(() => first.client.settled());
        expect(posts(server)).toHaveLength(1);
        expect(first.stores.session.getState().pending).toEqual([]);
        act(() => void first.stores.session.getState().emit({ ...setTask, client_op_id: 't-2' }));
        unmount();
        await first.client.settled();
        expect(posts(server)).toHaveLength(2);
    });
});
