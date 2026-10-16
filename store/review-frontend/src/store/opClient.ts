import { ApiError, ROLE_MESSAGE, type ReviewApi, type ReviewLifecycle, type SetAside } from '../api/reviewApi';
import type { Op } from '../contract/generated/review-ops';
import { isLocalOp } from '../model/applyOp';
import { spansToCodePoints } from '../model/offsets';
import { selectIsBlocked, type Refusal, type SessionStore } from './sessionStore';

export const MAX_BATCH = 500;
export const DEBOUNCE_MS = 1000;
export const MAX_BACKOFF_MS = 30_000;
/** Browsers refuse a keepalive body over 64 KiB; a hidden-page flush stays under this. */
export const KEEPALIVE_LIMIT = 60 * 1024;

const SIGN_IN_CODES = ['login_required', 'consent_required', 'missing_refresh_token', 'interaction_required'];

const bytesOf = (ops: Op[]) => new TextEncoder().encode(JSON.stringify(ops)).length;

/** The pending ops cut into groups: the ops of one emitBatch together, any other op alone. */
function groupsOf(pending: Op[], groupOf: Record<string, string>): Op[][] {
    const groups: Op[][] = [];
    let previous: string | undefined;
    for (const op of pending) {
        const group = groupOf[op.client_op_id] ?? op.client_op_id;
        const last = groups.at(-1);
        if (last && group === previous) last.push(op);
        else groups.push([op]);
        previous = group;
    }
    return groups;
}

/** A batch of ops, as the store holds them (`batch`) and as the server takes them (`sent`), with the bytes `sent` takes. */
interface Batch {
    batch: Op[];
    sent: Op[];
    size: number;
}

function measured(text: string, batch: Op[]): Batch {
    const sent = spansToCodePoints(text, batch);
    return { batch, sent, size: bytesOf(sent) };
}

/** The leading whole groups to send: at most MAX_BATCH ops, and when hidden under KEEPALIVE_LIMIT bytes. */
function nextBatch(pending: Op[], groupOf: Record<string, string>, text: string, hidden: boolean): Batch {
    const next: Batch = { batch: [], sent: [], size: 0 };
    for (const group of groupsOf(pending, groupOf)) {
        const converted = spansToCodePoints(text, group);
        const groupSize = bytesOf(converted);
        const overBatch = next.batch.length + group.length > MAX_BATCH;
        const overKeepalive = hidden && next.size + groupSize >= KEEPALIVE_LIMIT;
        if (next.batch.length > 0 && (overBatch || overKeepalive)) break;
        next.batch.push(...group);
        next.sent.push(...converted);
        next.size += groupSize;
    }
    return next;
}

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

function saveMessage(error: unknown): string {
    const [first] = error instanceof ApiError ? error.body.errors ?? [] : [];
    if (first) return first.field ? `${first.field}: ${first.message}` : first.message;
    return error instanceof Error ? error.message : 'the save failed';
}

function needsSignIn(error: unknown): boolean {
    if (error instanceof ApiError) return error.status === 401;
    return SIGN_IN_CODES.includes((error as { error?: string } | null)?.error ?? '');
}

/** Saves the store's pending ops to its review, one batch at a time. */
export function createOpClient(store: SessionStore, api: ReviewApi) {
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
        else state().setSave('failed', saveMessage(error));
        return false;
    }

    /** Handles a failed batch; true when the loop should go on. */
    async function recover(error: unknown, batch: Op[]): Promise<boolean> {
        unansweredBatch = null;
        if (error instanceof ApiError && error.status === 422) {
            const named = refusals(error, batch);
            if (named.length === 0) {
                const problems = (error.body.errors ?? []).map(({ message }) => message);
                state().block(batch, error.message, problems.length ? problems : [error.message]);
                return false;
            }
            state().refuse(named);
            return true;
        }
        if (error instanceof ApiError && error.status === 409) {
            try {
                const fresh = await api.getBundle(state().bundle.source.id);
                if (fresh.review && fresh.review.state !== 'in_progress') {
                    state().setLifecycle(fresh.review.state, fresh.review.set_aside);
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
                if (save === 'closed' || selectIsBlocked(state()) || backoff || !bundle.review) return;
                const hidden = document.visibilityState === 'hidden';
                const { batch, sent, size } = unansweredBatch
                    ? measured(bundle.text, unansweredBatch)
                    : nextBatch(pending, state().groupOf, bundle.text, hidden);
                if (batch.length === 0) return;
                state().setSave('saving');
                try {
                    const result = await api.postOps(bundle.review.id, bundle.review.last_seq, sent, {
                        keepalive: hidden && size < KEEPALIVE_LIMIT,
                    });
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
        async changeState(next: ReviewLifecycle, setAside?: SetAside) {
            await flush();
            if (selectIsBlocked(state())) return;
            const { review } = state().bundle;
            if (!review) return;
            const summary = await api.setState(review.id, next, setAside);
            state().setLifecycle(summary.state, summary.set_aside);
            state().setSave(summary.state === 'in_progress' ? 'idle' : 'closed');
            if (summary.state === 'in_progress') void flush();
        },
        /** Drops every pending edit, rebuilding the record from the confirmed one. */
        discardPending() {
            state().discardPending();
        },
        /** Drops the refused batch's edits, rebuilds the record from the confirmed one, and saves what is left. */
        undoBlocked(): Promise<void> {
            state().undoBlocked();
            return flush();
        },
        /** Resolves when the batches now going out have been answered. */
        settled: () => running ?? Promise.resolve(),
    };
}

export type OpClient = ReturnType<typeof createOpClient>;
