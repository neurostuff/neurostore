import type { Reason as ReasonOf } from '../review/reason';
import type { SessionState } from '../store/sessionStore';
import { selectCursorSpan } from '../store/viewSelectors';
import type { ViewState } from '../store/viewStore';
import { entityKey } from '../model/targetKey';
import { cannotCreate, panelFor, targetOf, unjudgedFields } from './actions';

export type RecordSession = Pick<SessionState, 'bundle' | 'record' | 'index' | 'provenance'>;
export type RecordView = Pick<ViewState, 'focus' | 'coordinates' | 'evidenceCursor'>;

type Reason = ReasonOf<RecordSession, RecordView>;

const NOTHING = 'Focus a field, an entity or a link first';

const onValue: Reason = (session, view) => {
    if (panelFor(session, view.focus, 'edit')) return undefined;
    return session.index.slot(view.focus.key)?.kind === 'reference'
        ? 'A reference is linked, not edited: use Link'
        : 'Focus a field first';
};

/** Why each record action does not apply to the focus, by action; the card head and the field's actions read it. */
export const RECORD_UNAVAILABLE = {
    judge: (session, view) => (targetOf(session.index, view.focus.entity, view.focus.key) ? undefined : NOTHING),
    edit: onValue,
    notReported: onValue,
    link: (session, view) =>
        panelFor(session, view.focus, 'link')
            ? undefined
            : 'Focus a reference field first: one that names other entities',
    create: (session, view) => cannotCreate(session, view.focus.entity),
    moveEvidence: (session, view) =>
        selectCursorSpan(session, view)
            ? undefined
            : 'Focus a field with evidence first; ] and [ step through its spans',
    acceptCard: (session, view) => {
        const { entity } = view.focus;
        if (!session.index.entity(entity)) return 'Focus an entity first';
        const { withEvidence, withoutEvidence } = unjudgedFields(session, entity);
        if (!session.provenance[entityKey(entity)] || withEvidence.length + withoutEvidence.length > 0)
            return undefined;
        return 'This card and all its fields are judged';
    },
    delete: (session, view) =>
        panelFor(session, view.focus, 'delete') ? undefined : 'The study itself cannot be deleted',
} satisfies Record<string, Reason>;
