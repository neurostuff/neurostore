import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { type ReactNode, useMemo } from 'react';
import type { EntityNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { CardActions } from '../review/actionButtons';
import { useEditorName } from '../review/editor';
import { useSession, useView } from '../store/context';
import { CoordinatesOf } from '../coordinates/RecordLinks';
import { acceptedText, pendingStructure } from './actions';
import { AcceptCardDialog, CreateDialog, DeleteDialog, NotePanel, RejectPanel } from './panels';
import { ComparisonSection } from './Comparison';
import { comparesTerms } from '../model/comparison';
import { CardHead } from './CardHead';
import { selectNotes } from '../review/outline';
import { NoteMark } from './NoteMark';
import { reviewStatus, statusColors } from './status';
import { classWords } from '../model/labels';
import { StatusLabel, StatusLegend } from './StatusLabel';
import { CardFields, CardTitle } from './CardFields';
import { VerdictStatus } from './WayOn';

const legendStyles = (theme: Theme) => ({
    px: 2,
    '& .rv-legend': {
        display: 'flex',
        flexWrap: 'nowrap',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        columnGap: 1,
        fontSize: '0.6875rem',
        listStyle: 'none',
        p: 0,
        my: 0.5,
        opacity: 0.85,
    },
    ...statusColors(theme.palette),
    '& .rv-legend-item': { display: 'inline-flex', alignItems: 'center', gap: 0.5 },
});

/** What the last accept of the card took, and the way on. */
export function AcceptedStatus({ entity, kind }: { entity: string; kind: string }) {
    const accepted = useView((s) => (s.accepted?.card === entity ? s.accepted : null));
    return <VerdictStatus text={accepted ? acceptedText(accepted, kind) : ''} />;
}

export function EntityCard({ entity, stickyHead }: { entity: EntityNode; stickyHead?: boolean }) {
    const panel = useView((s) => s.panel);
    const reviewed = useSession((s) => s.provenance[entityKey(entity.id)]?.state);
    const entityEditor = useEditorName(entityKey(entity.id));
    const deleting = useSession((s) => pendingStructure(s).deleting.has(entity.id));
    const notes = useSession((s) => selectNotes(s).get(entityKey(entity.id))?.join('\n'));
    const classLabel =
        entity.schemaClass === entity.entityClass
            ? entity.entityClass
            : `${entity.entityClass} · ${entity.schemaClass}`;
    const kind = classWords(entity.entityClass);
    const entityPanel =
        panel && !panel.slot && panel.target.kind === 'entity' && panel.target.entity === entity.id ? panel : null;
    return (
        <Box component="section" aria-label={entity.name}>
            <CardHead
                overline={classLabel}
                title={entity.name}
                heading={<CardTitle entity={entity} />}
                sticky={stickyHead}
            >
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                    <StatusLabel id={reviewStatus(reviewed)} by={entityEditor} />
                    {notes && <NoteMark notes={notes} />}
                    <CardActions entity={entity.id} kind={kind} />
                    {deleting && (
                        <Typography variant="caption" color="error">
                            deleting…
                        </Typography>
                    )}
                </Stack>
                <AcceptedStatus entity={entity.id} kind={kind} />
                <CoordinatesOf entity={entity} />
                {entityPanel?.kind === 'reject' && <RejectPanel target={entityPanel.target} label={entity.name} />}
                {entityPanel?.kind === 'note' && <NotePanel target={entityPanel.target} label={entity.name} />}
            </CardHead>
            {comparesTerms(entity) && <ComparisonSection entity={entity} />}
            <CardFields entity={entity} />
        </Box>
    );
}

function PendingChanges() {
    const pending = useSession((s) => s.pending);
    const { creating } = useMemo(() => pendingStructure({ pending }), [pending]);
    return (
        <Box role="status" aria-label="pending changes" sx={{ px: 2, typography: 'caption', color: 'text.secondary' }}>
            {creating.map(({ list }, i) => (
                <div key={i}>{`creating an entity in ${list}…`}</div>
            ))}
        </Box>
    );
}

/** The inspector's legend, pending changes and dialogs around `children`. */
export function InspectorFrame({ children }: { children?: ReactNode }) {
    const deleting = useView((s) =>
        s.panel?.kind === 'delete' && s.panel.target.kind === 'entity' ? s.panel.target.entity : null
    );
    const creating = useView((s) => s.panel?.kind === 'create');
    const accepting = useView((s) =>
        s.panel?.kind === 'accept_card' && s.panel.target.kind === 'entity' ? s.panel.target.entity : null
    );
    return (
        <>
            <PendingChanges />
            {children}
            <Box sx={legendStyles}>
                <StatusLegend />
            </Box>
            {deleting && <DeleteDialog entity={deleting} />}
            {creating && <CreateDialog />}
            {accepting && <AcceptCardDialog entity={accepting} />}
        </>
    );
}
