import {
    createContext,
    createElement,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import type { ReviewApi } from '../api/reviewApi';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { RecordIndex } from '../model/record';
import { createOpClient, type OpClient } from './opClient';
import { createSessionStore, type SessionState, type SessionStore, type SessionStoreOptions } from './sessionStore';
import { selectShown } from './viewSelectors';
import { createViewStore, type ViewState, type ViewStore } from './viewStore';

/** The two stores of one paper: the session the server and saving see, and the view one reviewer has of it. */
export interface ReviewStores {
    session: SessionStore;
    view: ViewStore;
}

export function createReviewStores(bundle: ReviewBundle, options?: SessionStoreOptions): ReviewStores {
    const session = createSessionStore(bundle, options);
    return { session, view: createViewStore(session) };
}

/** The stores of `bundle` and the op client saving them, made once and saving while mounted. */
export function useReviewSession(bundle: ReviewBundle, api: ReviewApi): { stores: ReviewStores; client: OpClient } {
    const [session] = useState(() => {
        const stores = createReviewStores(bundle);
        return { stores, client: createOpClient(stores.session, api) };
    });
    useEffect(() => {
        session.client.start();
        return () => session.client.stop();
    }, [session]);
    return session;
}

const ReviewStoresContext = createContext<ReviewStores | null>(null);

export function ReviewStoresProvider({ stores, children }: { stores: ReviewStores; children: ReactNode }) {
    return createElement(ReviewStoresContext.Provider, { value: stores }, children);
}

export function useReviewStores(): ReviewStores {
    const stores = useContext(ReviewStoresContext);
    if (!stores) throw new Error('useReviewStores needs a ReviewStoresProvider');
    return stores;
}

export function useSession<T>(selector: (state: SessionState) => T): T {
    return useStore(useReviewStores().session, selector);
}

export function useView<T>(selector: (state: ViewState) => T): T {
    return useStore(useReviewStores().view, selector);
}

/** What `selector` reads from both stores; it returns primitives or references the stores' selectors keep. */
export function useSessionView<T>(selector: (session: SessionState, view: ViewState) => T): T {
    const { session, view } = useReviewStores();
    const subscribe = useCallback(
        (onChange: () => void) => {
            const unsubscribeSession = session.subscribe(onChange);
            const unsubscribeView = view.subscribe(onChange);
            return () => {
                unsubscribeSession();
                unsubscribeView();
            };
        },
        [session, view]
    );
    const last = useRef<{ read: typeof selector; session: SessionState; view: ViewState; value: T } | null>(null);
    const read = () => {
        const state = { session: session.getState(), view: view.getState() };
        const kept = last.current;
        if (kept?.read === selector && kept.session === state.session && kept.view === state.view) return kept.value;
        const value = selector(state.session, state.view);
        last.current = { read: selector, ...state, value };
        return value;
    };
    return useSyncExternalStore(subscribe, read, read);
}

/** What `selector` reads from the index as the view lists it. */
export const useShown = <T>(selector: (index: RecordIndex) => T): T =>
    useSessionView((session, view) => selector(selectShown(session, view)));

const OpClientContext = createContext<OpClient | null>(null);

export function OpClientProvider({ client, children }: { client: OpClient; children: ReactNode }) {
    return createElement(OpClientContext.Provider, { value: client }, children);
}

export function useOpClient(): OpClient {
    const client = useContext(OpClientContext);
    if (!client) throw new Error('useOpClient needs an OpClientProvider');
    return client;
}
