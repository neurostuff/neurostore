import { Box, Button, List, ListItem, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { acceptTarget, pendingStructure, unlink } from '../inspector/actions';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import type { EntityNode } from '../model/record';
import { relationshipKey, relationshipTarget } from '../model/targetKey';
import { useReviewStores, useSession, useShown } from '../store/context';
import { useEditorName } from './editor';
import { guidedCards, type Link } from '../model/guided';

const listStyles = (theme: Theme) => ({ px: 2, ...statusColors(theme.palette) });

function LinkRow({ link, target }: { link: Link; target: string }) {
    const stores = useReviewStores();
    const { entity, slot } = link;
    const key = relationshipKey(entity.id, slot.path, target);
    const state = useSession((s) => s.provenance[key]?.state);
    const editor = useEditorName(key);
    const unlinking = useSession((s) => pendingStructure(s).linksBySlot.get(slot.key)?.get(target) === 'unlink');
    return (
        <ListItem disableGutters sx={{ display: 'block' }}>
            <Typography variant="body2">{`${entity.name} · ${slot.path}`}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
                <StatusLabel id={reviewStatus(state)} by={editor} />
                {unlinking ? (
                    <Typography variant="caption" color="text.secondary">
                        unlinking…
                    </Typography>
                ) : (
                    <>
                        <Button
                            size="small"
                            onClick={() => acceptTarget(stores, relationshipTarget(entity.id, slot.path, target))}
                        >
                            Accept link
                        </Button>
                        <Button size="small" color="error" onClick={() => unlink(stores, slot, target)}>
                            Unlink
                        </Button>
                    </>
                )}
            </Stack>
        </ListItem>
    );
}

/** The links pointing at `entity`, each with its review status, to accept or unlink. */
export function LinkedFrom({ entity }: { entity: EntityNode }) {
    const links = useShown((index) => guidedCards(index).linksInto(entity.id));
    return (
        <Box sx={listStyles}>
            <Typography variant="overline" component="h3">
                linked from
            </Typography>
            {links.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Nothing links to it.
                </Typography>
            ) : (
                <List dense disablePadding aria-label="linked from">
                    {links.map((link) => (
                        <LinkRow key={link.slot.key} link={link} target={entity.id} />
                    ))}
                </List>
            )}
        </Box>
    );
}
