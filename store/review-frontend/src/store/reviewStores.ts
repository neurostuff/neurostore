import type { ReviewBundle } from '../contract/generated/review-bundle';
import { createSessionStore, type SessionStore, type SessionStoreOptions } from './sessionStore';
import { createViewStore, type ViewStore } from './viewStore';

/** The two stores of one paper: the session the server and saving see, and the view one reviewer has of it. */
export interface ReviewStores {
    session: SessionStore;
    view: ViewStore;
}

export function createReviewStores(bundle: ReviewBundle, options?: SessionStoreOptions): ReviewStores {
    const session = createSessionStore(bundle, options);
    return { session, view: createViewStore(session) };
}
