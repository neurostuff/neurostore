import { ApiError, ROLE_MESSAGE, type ReviewApi, type ReviewLifecycle, type SetAside } from '../api/reviewApi';
import { BATCH_MAX_OPS, type Op } from '../contract/generated/review-ops';
import { isLocalOp } from '../model/applyOp';
import { spansToCodePoints } from '../model/offsets';
import { keysChanged, keysNamed } from '../model/analysisFollow';
import type { PointEdit } from './pointEdits';
import { selectIsBlocked, selectIsEditable, type Refusal, type SessionStore } from './sessionStore';

export const DEBOUNCE_MS = 1000;
export const COLLECT_PAUSE_MS = 1500;
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

/**
 * The leading whole groups to send: at most BATCH_MAX_OPS ops, when hidden under KEEPALIVE_LIMIT bytes, and none
 * naming an analysis key an earlier group may replace, whose new key only that group's result gives. Such a group
 * is pending behind its key's op when an action follows the edits collected on its analysis, which are sent first,
 * and when a device's kept ops are restored.
 */
function nextBatch(pending: Op[], groupOf: Record<string, string>, text: string, hidden: boolean): Batch {
    const next: Batch = { batch: [], sent: [], size: 0 };
    const replaced = new Set<string>();
    for (const group of groupsOf(pending, groupOf)) {
        const converted = spansToCodePoints(text, group);
        const groupSize = bytesOf(converted);
        const overBatch = next.batch.length + group.length > BATCH_MAX_OPS;
        const overKeepalive = hidden && next.size + groupSize >= KEEPALIVE_LIMIT;
        const waitsOnKey = group.some((op) => keysNamed(op).some((key) => replaced.has(key)));
        if (next.batch.length > 0 && (overBatch || overKeepalive || waitsOnKey)) break;
        for (const op of group) for (const key of keysChanged(op)) replaced.add(key);
        next.batch.push(...group);
        next.sent.push(...converted);
        next.size += groupSize;
    }
    return next;
}

/** Why the review cannot move on while point edits are kept unsent: how many, on which analysis. */
export function unsavedEdits(collected: PointEdit[]): string {
    const byName = new Map<string, number>();
    for (const edit of collected) byName.set(edit.name, (byName.get(edit.name) ?? 0) + 1);
    const each = [...byName].map(([name, count]) => `${count} point ${count === 1 ? 'edit' : 'edits'} on ${name}`);
    return `${each.join('; ')} ${collected.length === 1 ? 'is' : 'are'} not saved: resolve them first`;
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
    const [first] = error instanceof ApiError ? (error.body.errors ?? []) : [];
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
    /** Runs out COLLECT_PAUSE_MS after the reviewer's last point edit, sending what is collected. */
    let collecting: ReturnType<typeof setTimeout> | undefined;
    let backoff: ReturnType<typeof setTimeout> | undefined;
    /** The batch whose answer was lost, sent again unchanged so the server can replay it. */
    let unansweredBatch: Op[] | null = null;
    let failures = 0;
    let running: Promise<void> | null = null;
    let stopped = false;
    let unsubscribe = () => {};

    const state = () => store.getState();
    const editedSinceSend = () => debounce !== undefined;

    /** Shows whether the network is up in the save status, leaving a save stopped for another reason as it is. */
    function showNetwork(up: boolean) {
        const { save, setSave } = state();
        if (up && save === 'offline') setSave('idle');
        if (!up && (save === 'idle' || save === 'saving')) setSave('offline');
    }

    function retryLater(batch: Op[]) {
        unansweredBatch = batch;
        failures += 1;
        showNetwork(false);
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
                if (
                    save === 'closed' ||
                    !selectIsEditable(state()) ||
                    selectIsBlocked(state()) ||
                    backoff ||
                    !bundle.review
                )
                    return;
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
                if (collecting === undefined) state().sendCollected();
                if (editedSinceSend()) return;
            }
        } finally {
            if (state().save === 'saving') state().setSave('idle');
        }
    }

    /** Whether a flush came while the save loop ran, which it may have ended before seeing. */
    let again = false;
    /** Whether the save loop runs; false in the same step it ends, so a flush after that starts it again. */
    let draining = false;

    /** Runs the save loop, and again while a flush came during the last run. */
    async function drainWhileAsked() {
        try {
            do {
                again = false;
                await drain();
            } while (again);
        } finally {
            draining = false;
        }
    }

    function flush(): Promise<void> {
        clearTimeout(debounce);
        debounce = undefined;
        if (draining && running) {
            again = true;
            return running;
        }
        draining = true;
        const run = drainWhileAsked();
        running = run;
        void run.finally(() => {
            if (running === run) running = null;
        });
        return run;
    }

    /** Sends the point edits collected, then saves what is pending. */
    function sendAll(): Promise<void> {
        clearTimeout(collecting);
        collecting = undefined;
        state().sendCollected();
        return flush();
    }

    const flushNow = () => void flush();
    const sendAllNow = () => void sendAll();
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') sendAllNow();
    };
    const onOnline = () => {
        if (state().save !== 'offline') return;
        clearTimeout(backoff);
        backoff = undefined;
        showNetwork(true);
        flushNow();
    };
    const onOffline = () => showNetwork(false);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
        sendAllNow();
        if (state().pending.length === 0 && state().collected.length === 0) return;
        event.preventDefault();
        event.returnValue = '';
    };

    return {
        start() {
            stopped = false;
            unsubscribe = store.subscribe((next, previous) => {
                if (next.sendAsked !== previous.sendAsked) sendAllNow();
                if (next.collected.length && next.collected.at(-1)?.points !== previous.collected.at(-1)?.points) {
                    clearTimeout(collecting);
                    collecting = setTimeout(() => {
                        collecting = undefined;
                        state().sendCollected();
                    }, COLLECT_PAUSE_MS);
                }
                const last = next.pending.at(-1);
                if (!last || previous.pending.some((op) => op.client_op_id === last.client_op_id)) return;
                clearTimeout(debounce);
                if (isLocalOp(last)) debounce = setTimeout(flushNow, DEBOUNCE_MS);
                else void state().minted(last.client_op_id).then(flushNow);
            });
            window.addEventListener('blur', sendAllNow);
            window.addEventListener('beforeunload', onBeforeUnload);
            window.addEventListener('online', onOnline);
            window.addEventListener('offline', onOffline);
            if (!navigator.onLine) onOffline();
            document.addEventListener('visibilitychange', onVisibility);
        },
        stop() {
            stopped = true;
            clearTimeout(debounce);
            debounce = undefined;
            clearTimeout(backoff);
            backoff = undefined;
            unsubscribe();
            window.removeEventListener('blur', sendAllNow);
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            document.removeEventListener('visibilitychange', onVisibility);
            sendAllNow();
        },
        /** Sends the point edits collected and saves everything pending. */
        flush: sendAll,
        /** Saves what is pending, then moves the review to `next`; nothing while the session takes no edits. */
        async changeState(next: ReviewLifecycle, setAside?: SetAside) {
            if (!selectIsEditable(state())) return;
            await sendAll();
            if (selectIsBlocked(state())) return;
            if (next !== 'in_progress' && state().collected.length) throw new Error(unsavedEdits(state().collected));
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
