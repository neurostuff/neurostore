import type { OpResult } from '../api/reviewApi';
import type { Op } from '../contract/generated/review-ops';
import type { ReviewStores } from '../store/context';
import type { InverseOp } from '../store/undoSteps';

/** `ops` without their client_op_ids, as an undo step's inverses hold them. */
export const withoutIds = (ops: Op[]): InverseOp[] =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ops.map(({ client_op_id, ...inverse }) => inverse as InverseOp);

/**
 * Confirms every pending op as the server would: each stored with the inverse `inverseOf` gives it, the record
 * as the store shows it and the rest of the documents as last confirmed.
 */
export function answerPending(store: ReviewStores, inverseOf: (op: Op) => InverseOp[] | undefined): Op[] {
    const { pending, record, bundle } = store.session.getState();
    const lastSeq = bundle.review!.last_seq;
    const result: OpResult = {
        ops: pending.map((op, i) => ({
            seq: lastSeq + i + 1,
            op,
            before: {},
            after: {},
            user_id: bundle.review!.user_id,
            created_at: 'then',
            ...(inverseOf(op) && { inverse: inverseOf(op) }),
        })),
        last_seq: lastSeq + pending.length,
        record,
        coordinate_revision: bundle.coordinate_revision,
        provenance: store.session.getState().provenance,
        annotations: store.session.getState().annotations,
        hidden: bundle.hidden,
        entities: bundle.entities,
    };
    store.session.getState().confirm(result, pending);
    return pending;
}
