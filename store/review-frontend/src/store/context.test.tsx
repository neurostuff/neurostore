import { act, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { StrictMode } from 'react';
import type { Op } from '../contract/generated/review-ops';
import { ev, makeBundle } from '../test/bundles';
import { fakeLocks } from '../test/fakeLocks';
import { fakeServer } from '../test/fakeServer';
import { useOpClient, useReviewSession } from './context';
import { openDeviceQueue } from './deviceQueue';

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

    it('under StrictMode keeps the one lock it took across the remount, so the tab stays editable', async () => {
        const server = fakeServer([source]);
        await server.backend.startReview('S1');
        const bundle = await server.backend.getBundle('S1');
        const { held, locks } = fakeLocks();
        const device = { indexedDB: new IDBFactory(), locks };
        const { result, unmount } = renderHook(() => useReviewSession(bundle, server.api(), device), {
            wrapper: StrictMode,
        });
        await waitFor(() => expect(result.current.stores.session.getState().device).toBe('kept'));
        expect([...held]).toEqual(['neurostore-review:review-1']);
        act(() => void result.current.stores.session.getState().emit(setTask));
        window.dispatchEvent(new Event('blur'));
        await act(() => result.current.client.settled());
        expect(posts(server)).toHaveLength(1);
        unmount();
        await waitFor(() => expect([...held]).toEqual([]));
    });

    it('lets go of the lock and the queue when unmounted before the kept ops are loaded', async () => {
        const server = fakeServer([source]);
        await server.backend.startReview('S1');
        const bundle = await server.backend.getBundle('S1');
        const { held, locks } = fakeLocks();
        const device = { indexedDB: new IDBFactory(), locks };
        const { result, unmount } = renderHook(() => useReviewSession(bundle, server.api(), device));
        const { session } = result.current.stores;
        expect(session.getState().device).toBe('loading');
        unmount();
        await waitFor(() => expect(session.getState().device).toBe('kept'));
        await waitFor(() => expect([...held]).toEqual([]));
        act(() => void session.getState().emit(setTask));
        await new Promise((done) => setTimeout(done, 300));
        expect(posts(server)).toHaveLength(0);
        expect(await (await openDeviceQueue(device.indexedDB, () => {})).read('review-1')).toBeUndefined();
    });
});
