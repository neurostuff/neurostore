import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ComponentType } from 'react';
import { FocusedCard } from '../inspector/FocusedCard';
import { InspectorFrame } from '../inspector/Inspector';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import type { EntityNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { counted } from '../model/labels';
import { useSession, useShown, useView } from '../store/context';
import type { SessionState } from '../store/sessionStore';
import { useEditorName } from './editor';
import { Hint } from './Hint';
import { selectStepProgress } from './stepCount';
import type { CardStep } from '../model/guided';

/** What a step adds below its focused card. */
export type CardDetail = ComponentType<{ entity: EntityNode }>;

const judged = (s: Pick<SessionState, 'provenance'>, id: string) => s.provenance[entityKey(id)]?.state;

const headStyles = (theme: Theme) => statusColors(theme.palette);

const cardStyles = {
    display: 'block',
    mx: 1.5,
    mb: 1,
    width: 'auto',
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
    '&:has([aria-current="true"])': { borderColor: 'primary.main' },
} as const;

const fieldPanelStyles = {
    ml: 1.5,
    mb: 1,
    borderLeft: 3,
    borderColor: 'primary.main',
    bgcolor: 'fieldSurface',
} as const;

const CardHead = memo(function CardHead({ entity, focused }: { entity: EntityNode; focused: boolean }) {
    const focusEntity = useView((s) => s.focusEntity);
    const state = useSession((s) => judged(s, entity.id));
    const editor = useEditorName(entityKey(entity.id));
    return (
        <Hint title={`Open ${entity.name} (Shift+J and Shift+K move between cards)`}>
            <ListItemButton
                data-card={entity.id}
                selected={focused}
                aria-current={focused ? 'true' : undefined}
                onClick={() => focusEntity(entity.id)}
                sx={headStyles}
            >
                <ListItemText
                    primary={entity.name}
                    primaryTypographyProps={{ variant: 'subtitle1', component: 'div', fontWeight: 600 }}
                    secondary={
                        <>
                            {`${entity.entityClass} · ${counted(entity.spans.length, 'evidence span')} · `}
                            <StatusLabel id={reviewStatus(state)} by={editor} />
                            {state && ' · done'}
                        </>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                />
            </ListItemButton>
        </Hint>
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
    const done = useSession((s) => selectStepProgress(s, step).text);
    return (
        <InspectorFrame>
            <Typography variant="overline" component="h2" sx={{ px: 2, display: 'block' }}>
                {`${label} · ${done} done`}
            </Typography>
            <Outside cards={cards} />
            {cards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                    {`No ${label} in this paper.`}
                </Typography>
            ) : (
                <List dense disablePadding aria-label={label}>
                    {cards.map((entity) => (
                        <ListItem key={entity.id} disablePadding sx={cardStyles}>
                            <CardHead entity={entity} focused={entity.id === focused} />
                            {entity.id === focused && (
                                <Box role="region" aria-label={`Fields of ${entity.name}`} sx={fieldPanelStyles}>
                                    <FocusedCard entity={entity} focusedSlot={focusedSlot} stickyHead />
                                    {Detail && <Detail entity={entity} />}
                                </Box>
                            )}
                        </ListItem>
                    ))}
                </List>
            )}
        </InspectorFrame>
    );
}
