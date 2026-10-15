import { ApiError, ROLE_MESSAGE, type ReviewApi, type ReviewLifecycle } from '../api/reviewApi';
import type { Op } from '../contract/generated/review-ops';
import { isLocalOp } from '../model/applyOp';
import { spansToCodePoints } from '../model/offsets';
import type { Refusal, ReviewStore } from './reviewStore';

export const MAX_BATCH = 500;
export const DEBOUNCE_MS = 1000;
export const MAX_BACKOFF_MS = 30_000;

const SIGN_IN_CODES = ['login_required', 'consent_required', 'missing_refresh_token'];

function refusals(error: ApiError, batch: Op[]): Refusal[] {
    return (error.body.errors ?? []).flatMap(({ context, message }) => {
        const op = typeof context?.op_index === 'number' ? batch[context.op_index] : undefined;
        return op && op.client_op_id === context?.client_op_id ? [{ op, message }] : [];
    });
}

export function isRetryable(error: unknown): boolean {
    if (error instanceof TypeError) return true;
    return error instanceof ApiError && (error.status >= 500 || error.status === 429);
}

function needsSignIn(error: unknown): boolean {
    if (error instanceof ApiError) return error.status === 401;
    return SIGN_IN_CODES.includes((error as { error?: string } | null)?.error ?? '');
}

/** Saves the store's pending ops to its review, one batch at a time. */
export function createOpClient(store: ReviewStore, api: ReviewApi) {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let backoff: ReturnType<typeof setTimeout> | undefined;
    /** The batch whose answer was lost, sent again unchanged so the server can replay it. */
    let unansweredBatch: Op[] | null = null;
    let failures = 0;
    let running: Promise<void> | null = null;
    let stopped = false;
    let unsubscribe = () => {};

    const state = () => store.getState();
    const editedSinceSend = () => debounce !== undefined;

    function retryLater(batch: Op[]) {
        unansweredBatch = batch;
        failures += 1;
        state().setSave('offline');
        if (stopped) return;
        const delay = Math.min(DEBOUNCE_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
        backoff = setTimeout(() => {
            backoff = undefined;
            void flush();
        }, delay);
    }

    /** Keeps the batch's ops pending and stops saving, unless waiting can fix the error. */
    function fail(error: unknown, batch: Op[]): false {
        if (isRetryable(error)) {
            retryLater(batch);
            return false;
        }
        if (needsSignIn(error)) state().setSave('signin');
        else if (error instanceof ApiError && error.status === 403) state().setSave('failed', ROLE_MESSAGE);
        else if (error instanceof ApiError && error.status === 404) state().setSave('failed', 'the review is gone');
        else state().setSave('failed', error instanceof Error ? error.message : 'the save failed');
        return false;
    }

    /** Handles a failed batch; true when the loop should go on. */
    async function recover(error: unknown, batch: Op[]): Promise<boolean> {
        unansweredBatch = null;
        if (error instanceof ApiError && error.status === 422) {
            const named = refusals(error, batch);
            if (named.length === 0) {
                state().setSave('failed', error.message);
                return false;
            }
            state().refuse(named);
            return true;
        }
        if (error instanceof ApiError && error.status === 409) {
            try {
                const fresh = await api.getBundle(state().bundle.source.id);
                if (fresh.review && fresh.review.state !== 'in_progress') {
                    state().setLifecycle(fresh.review.state);
                    state().setSave('closed');
                    return false;
                }
                state().rebase(fresh);
                return true;
            } catch (refetchError) {
                return fail(refetchError, batch);
            }
        }
        return fail(error, batch);
    }

    async function drain() {
        try {
            for (;;) {
                const { save, pending, bundle } = state();
                if (save === 'closed' || backoff || !bundle.review) return;
                const batch = unansweredBatch ?? pending.slice(0, MAX_BATCH);
                if (batch.length === 0) return;
                state().setSave('saving');
                try {
                    const result = await api.postOps(
                        bundle.review.id,
                        bundle.review.last_seq,
                        spansToCodePoints(bundle.text, batch),
                        {
                            keepalive: document.visibilityState === 'hidden',
                        }
                    );
                    unansweredBatch = null;
                    failures = 0;
                    state().confirm(result, batch);
                } catch (error) {
                    if (!(await recover(error, batch))) return;
                }
                if (editedSinceSend()) return;
            }
        } finally {
            if (state().save === 'saving') state().setSave('idle');
        }
    }

    function flush(): Promise<void> {
        clearTimeout(debounce);
        debounce = undefined;
        running ??= drain().finally(() => (running = null));
        return running;
    }

    const flushNow = () => void flush();
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') flushNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (state().pending.length === 0) return;
        event.preventDefault();
        event.returnValue = '';
    };

    return {
        start() {
            unsubscribe = store.subscribe((next, previous) => {
                const last = next.pending.at(-1);
                if (!last || previous.pending.some((op) => op.client_op_id === last.client_op_id)) return;
                clearTimeout(debounce);
                if (isLocalOp(last)) debounce = setTimeout(flushNow, DEBOUNCE_MS);
                else void state().minted(last.client_op_id).then(flushNow);
            });
            window.addEventListener('blur', flushNow);
            window.addEventListener('beforeunload', onBeforeUnload);
            document.addEventListener('visibilitychange', onVisibility);
        },
        stop() {
            stopped = true;
            clearTimeout(debounce);
            debounce = undefined;
            clearTimeout(backoff);
            backoff = undefined;
            unsubscribe();
            window.removeEventListener('blur', flushNow);
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('visibilitychange', onVisibility);
            flushNow();
        },
        flush,
        /** Saves what is pending, then moves the review to `next`. */
        async changeState(next: ReviewLifecycle) {
            await flush();
            const { review } = state().bundle;
            if (!review) return;
            const summary = await api.setState(review.id, next);
            state().setLifecycle(summary.state);
            state().setSave(summary.state === 'in_progress' ? 'idle' : 'closed');
            if (summary.state === 'in_progress') void flush();
        },
        /** Resolves when the batches now going out have been answered. */
        settled: () => running ?? Promise.resolve(),
    };
}

export type OpClient = ReturnType<typeof createOpClient>;
