import type { ErrorBody, OpResult as GeneratedOpResult, ReviewSummary } from '../contract/generated/review-api';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import type { SchemaName } from '../contract/schemas';
import type { Schema } from '../model/schema';

export type { ErrorBody, ReviewSummary } from '../contract/generated/review-api';

export type OpResult = Omit<GeneratedOpResult, 'hidden'> & { hidden: ReviewBundle['hidden'] };

export const ROLE_MESSAGE = 'You need the admin-reviewer role';

/** Why and how a review was set aside, while it is. */
export type SetAside = NonNullable<ReviewSummary['set_aside']>;

export interface ReviewerProgress {
    user_id: string;
    user_name: string | null;
    state: ReviewLifecycle;
    set_aside?: SetAside;
    edited: number;
    verified: number;
    reviewed: number;
    op_count: number;
    last_edit_at: string | null;
}

/** A reviewer a paper is assigned to, or one who can be assigned a paper. */
export interface Assignee {
    user_id: string;
    name: string | null;
}

export interface PaperSummary {
    id: string;
    base_study_id: string;
    label: string;
    total: number;
    assignees?: Assignee[];
    reviews?: ReviewerProgress[];
}

/** The caller as a reviewer; `lead` is true for an admin-reviewer who is also an admin. */
export interface Me {
    user_id: string;
    name: string | null;
    lead: boolean;
}

/** `assigned: 'me'` keeps the papers assigned to the caller. */
export interface PaperFilter {
    assigned?: 'me';
}

export type ReviewLifecycle = NonNullable<ReviewBundle['review']>['state'];

/** `review` moved to `state`, with `setAside` as its set-aside reason while it is set aside. */
export function withState<R extends { state: ReviewLifecycle; set_aside?: SetAside }>(
    review: R,
    state: ReviewLifecycle,
    setAside?: SetAside
): R {
    const next = { ...review, state };
    if (setAside) next.set_aside = setAside;
    else delete next.set_aside;
    return next;
}

export class ApiError extends Error {
    readonly status: number;
    readonly body: Partial<ErrorBody> & { status: number };

    constructor(status: number, body: Partial<ErrorBody> = {}) {
        super(body.detail ?? `the API answered ${status}`);
        this.name = 'ApiError';
        this.status = status;
        this.body = { ...body, status };
    }
}

/** The 422 the server answers for the op at `index` of a batch that it cannot apply. */
export const refusedOp = (index: number, clientOpId: string, message: string) =>
    new ApiError(422, {
        title: 'Unprocessable Entity',
        detail: `op ${index} cannot be applied`,
        errors: [
            {
                field: `ops/${index}`,
                code: 'REJECTED',
                message,
                context: { op_index: index, client_op_id: clientOpId },
            },
        ],
    });

export interface SendOptions {
    keepalive?: boolean;
}

export interface ReviewApi {
    listPapers(filter?: PaperFilter): Promise<PaperSummary[]>;
    /** Assigns the paper (base study) to `userId`; a reviewer may name only themselves. */
    assign(baseStudyId: string, userId: string): Promise<void>;
    /** Releases `userId`'s assignment of the paper; a reviewer may name only themselves. */
    release(baseStudyId: string, userId: string): Promise<void>;
    getMe(): Promise<Me>;
    /** Every admin-reviewer, to assign papers to. */
    listReviewers(): Promise<Assignee[]>;
    getBundle(id: string): Promise<ReviewBundle>;
    startReview(sourceId: string): Promise<ReviewSummary>;
    postOps(reviewId: string, expectedLastSeq: number, ops: Op[], options?: SendOptions): Promise<OpResult>;
    /** Moves the review to `state`; a set_aside takes its reason and note. */
    setState(reviewId: string, state: ReviewLifecycle, setAside?: SetAside): Promise<ReviewSummary>;
    getSchema(name: SchemaName): Promise<Schema>;
}

/** `api`, calling `onForbidden` whenever it answers 403. */
export function watchForbidden(api: ReviewApi, onForbidden: () => void): ReviewApi {
    const watched =
        <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
        (...args: A) =>
            call(...args).catch((error: unknown) => {
                if (error instanceof ApiError && error.status === 403) onForbidden();
                throw error;
            });
    return {
        listPapers: watched(api.listPapers),
        assign: watched(api.assign),
        release: watched(api.release),
        getMe: watched(api.getMe),
        listReviewers: watched(api.listReviewers),
        getBundle: watched(api.getBundle),
        startReview: watched(api.startReview),
        postOps: watched(api.postOps),
        setState: watched(api.setState),
        getSchema: watched(api.getSchema),
    };
}
