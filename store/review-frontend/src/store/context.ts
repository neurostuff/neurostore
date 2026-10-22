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
import { browserDevice, createReviewSession, type Device } from './reviewSession';
import type { OpClient } from './opClient';
import type { ReviewStores } from './reviewStores';
import { selectIsEditable, type SessionState } from './sessionStore';
import { selectShown } from './viewSelectors';
import type { ViewState } from './viewStore';

/** The stores of `bundle` and the op client saving them, made once and saving while mounted. */
export function useReviewSession(
    bundle: ReviewBundle,
    api: ReviewApi,
    device: Device = browserDevice()
): { stores: ReviewStores; client: OpClient } {
    const [session] = useState(() => createReviewSession(bundle, api, device));
    useEffect(() => {
        void session.open();
        return () => void session.close();
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

/** Whether this tab takes edits; its edit controls are disabled while it does not. */
export const useIsEditable = (): boolean => useSession(selectIsEditable);

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

/** What `selector` reads from the index as the view lists it and the bundle it is built from. */
export const useShownDocuments = <T>(selector: (documents: { index: RecordIndex; bundle: ReviewBundle }) => T): T =>
    useSessionView((session, view) => selector({ index: selectShown(session, view), bundle: session.bundle }));

const OpClientContext = createContext<OpClient | null>(null);

export function OpClientProvider({ client, children }: { client: OpClient; children: ReactNode }) {
    return createElement(OpClientContext.Provider, { value: client }, children);
}

export function useOpClient(): OpClient {
    const client = useContext(OpClientContext);
    if (!client) throw new Error('useOpClient needs an OpClientProvider');
    return client;
}
