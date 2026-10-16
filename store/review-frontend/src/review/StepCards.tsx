import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ComponentType } from 'react';
import { EntityCard, InspectorFrame } from '../inspector/Inspector';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import type { EntityNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { useReviewStore } from '../store/context';
import type { ReviewState } from '../store/reviewStore';

/** What a step adds below its focused card. */
export type CardDetail = ComponentType<{ entity: EntityNode }>;

const judged = (s: Pick<ReviewState, 'provenance'>, id: string) => s.provenance[entityKey(id)]?.state;

const spanCount = (n: number) => `${n} evidence ${n === 1 ? 'span' : 'spans'}`;

const headStyles = (theme: Theme) => statusColors(theme.palette);

const CardHead = memo(function CardHead({ entity, focused }: { entity: EntityNode; focused: boolean }) {
    const focusEntity = useReviewStore((s) => s.focusEntity);
    const state = useReviewStore((s) => judged(s, entity.id));
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
                        <StatusLabel id={reviewStatus(state)} />
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
    const entity = useReviewStore((s) =>
        cards.some((e) => e.id === s.focus.entity) ? undefined : s.index.entity(s.focus.entity)
    );
    const focusedSlot = useReviewStore((s) => s.focus.slot);
    if (!entity) return null;
    return (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                outside this step
            </Typography>
            <EntityCard entity={entity} focusedSlot={focusedSlot} />
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
    const focused = useReviewStore((s) => s.focus.entity);
    const focusedSlot = useReviewStore((s) => s.focus.slot);
    const done = useReviewStore((s) => cards.filter((e) => judged(s, e.id)).length);
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
                                    <EntityCard entity={entity} focusedSlot={focusedSlot} />
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
