import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ComponentType } from 'react';
import { FocusedCard } from '../inspector/FocusedCard';
import { InspectorFrame } from '../inspector/Inspector';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import type { EntityNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { useSession, useShown, useView } from '../store/context';
import type { SessionState } from '../store/sessionStore';
import { useEditorName } from './editor';

/** What a step adds below its focused card. */
export type CardDetail = ComponentType<{ entity: EntityNode }>;

const judged = (s: Pick<SessionState, 'provenance'>, id: string) => s.provenance[entityKey(id)]?.state;

const spanCount = (n: number) => `${n} evidence ${n === 1 ? 'span' : 'spans'}`;

const headStyles = (theme: Theme) => statusColors(theme.palette);

const CardHead = memo(function CardHead({ entity, focused }: { entity: EntityNode; focused: boolean }) {
    const focusEntity = useView((s) => s.focusEntity);
    const state = useSession((s) => judged(s, entity.id));
    const editor = useEditorName(entityKey(entity.id));
    return (
        <ListItemButton
            data-card={entity.id}
            selected={focused}
            aria-current={focused ? 'true' : undefined}
            onClick={() => focusEntity(entity.id)}
            sx={headStyles}
        >
            <ListItemText
                primary={entity.name}
                secondary={
                    <>
                        {`${entity.entityClass} · ${spanCount(entity.spans.length)} · `}
                        <StatusLabel id={reviewStatus(state)} by={editor} />
                        {state && ' · done'}
                    </>
                }
                secondaryTypographyProps={{ component: 'div' }}
            />
        </ListItemButton>
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
    label,
    cards,
    detail: Detail,
}: {
    label: string;
    cards: EntityNode[];
    detail?: CardDetail;
}) {
    const focused = useView((s) => s.focus.entity);
    const focusedSlot = useView((s) => s.focus.slot);
    const done = useSession((s) => cards.filter((e) => judged(s, e.id)).length);
    return (
        <InspectorFrame>
            <Typography variant="overline" component="h2" sx={{ px: 2, display: 'block' }}>
                {`${label} · ${done} of ${cards.length} done`}
            </Typography>
            <Outside cards={cards} />
            {cards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                    {`No ${label} in this paper.`}
                </Typography>
            ) : (
                <List dense disablePadding aria-label={label}>
                    {cards.map((entity) => (
                        <ListItem key={entity.id} disablePadding sx={{ display: 'block' }}>
                            <CardHead entity={entity} focused={entity.id === focused} />
                            {entity.id === focused && (
                                <Box sx={{ borderLeft: 3, borderColor: 'primary.main' }}>
                                    <FocusedCard entity={entity} focusedSlot={focusedSlot} />
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
