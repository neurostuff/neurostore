import { Box, Typography } from '@mui/material';
import { memo, type ComponentType } from 'react';
import { FocusedCard } from '../inspector/FocusedCard';
import { reviewStatus } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import type { EntityNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { counted } from '../model/labels';
import { useSession, useShown, useView } from '../store/context';
import type { SessionState } from '../store/sessionStore';
import { useEditorName } from './editor';
import { StepCard, StepCardList } from './StepCardList';
import type { CardStep } from '../model/guided';

/** What a step adds below its focused card. */
export type CardDetail = ComponentType<{ entity: EntityNode }>;

const judged = (s: Pick<SessionState, 'provenance'>, id: string) => s.provenance[entityKey(id)]?.state;

/** The secondary line of an entity's card head: its class, its evidence and its review status. */
const EntitySummary = memo(function EntitySummary({ entity }: { entity: EntityNode }) {
    const state = useSession((s) => judged(s, entity.id));
    const editor = useEditorName(entityKey(entity.id));
    return (
        <>
            {`${entity.entityClass} · ${counted(entity.spans.length, 'evidence span')} · `}
            <StatusLabel id={reviewStatus(state)} by={editor} />
            {state && ' · done'}
        </>
    );
});

/** The focused entity's card when it is not one of the step's. */
function Outside({ cards }: { cards: EntityNode[] }) {
    const focused = useView((s) => s.focus.entity);
    const entity = useShown((index) => (cards.some((e) => e.id === focused) ? undefined : index.entity(focused)));
    const focusedSlot = useView((s) => s.focus.slot);
    if (!entity) return null;
    return (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                outside this step
            </Typography>
            <FocusedCard entity={entity} focusedSlot={focusedSlot} />
        </Box>
    );
}

/** One card per entity of a guided step: its head, and the inspector's card for the focused one, then `detail`. */
export function StepCards({
    step,
    label,
    cards,
    detail: Detail,
}: {
    step: CardStep;
    label: string;
    cards: EntityNode[];
    detail?: CardDetail;
}) {
    const focused = useView((s) => s.focus.entity);
    const focusedSlot = useView((s) => s.focus.slot);
    return (
        <StepCardList
            step={step}
            label={label}
            aside={<Outside cards={cards} />}
            empty={cards.length === 0 ? `No ${label} in this paper.` : undefined}
        >
            {cards.map((entity) => (
                <StepCard
                    key={entity.id}
                    id={entity.id}
                    name={entity.name}
                    secondary={<EntitySummary entity={entity} />}
                    open={entity.id === focused}
                    region={`Fields of ${entity.name}`}
                >
                    <FocusedCard entity={entity} focusedSlot={focusedSlot} stickyHead />
                    {Detail && <Detail entity={entity} />}
                </StepCard>
            ))}
        </StepCardList>
    );
}
