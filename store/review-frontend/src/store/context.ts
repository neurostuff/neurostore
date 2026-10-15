import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { OpClient } from './opClient';
import type { ReviewState, ReviewStore } from './reviewStore';

const ReviewStoreContext = createContext<ReviewStore | null>(null);

export function ReviewStoreProvider({ store, children }: { store: ReviewStore; children: ReactNode }) {
    return createElement(ReviewStoreContext.Provider, { value: store }, children);
}

export function useReviewStoreApi(): ReviewStore {
    const store = useContext(ReviewStoreContext);
    if (!store) throw new Error('useReviewStoreApi needs a ReviewStoreProvider');
    return store;
}

export function useReviewStore<T>(selector: (state: ReviewState) => T): T {
    return useStore(useReviewStoreApi(), selector);
}

const OpClientContext = createContext<OpClient | null>(null);

export function OpClientProvider({ client, children }: { client: OpClient; children: ReactNode }) {
    return createElement(OpClientContext.Provider, { value: client }, children);
}

export function useOpClient(): OpClient {
    const client = useContext(OpClientContext);
    if (!client) throw new Error('useOpClient needs an OpClientProvider');
    return client;
}
