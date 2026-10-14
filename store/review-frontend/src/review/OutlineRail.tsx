import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import { Box, IconButton, List, ListItemButton, ListItemText, ListSubheader, Paper, Tooltip } from '@mui/material';
import { useMemo } from 'react';
import type { EntityNode } from '../model/record';
import { useReviewStore } from '../store/context';

const RAIL_WIDTH = 48;

function byClass(entities: EntityNode[]) {
    const groups = new Map<string, EntityNode[]>();
    for (const entity of entities) {
        groups.set(entity.entityClass, [...(groups.get(entity.entityClass) ?? []), entity]);
    }
    return [...groups];
}

function Outline() {
    const entities = useReviewStore((s) => s.index.visible);
    const focused = useReviewStore((s) => s.focus.entity);
    const focusEntity = useReviewStore((s) => s.focusEntity);
    const toggleOutline = useReviewStore((s) => s.toggleOutline);
    const groups = useMemo(() => byClass(entities), [entities]);
    return (
        <Paper
            component="nav"
            aria-label="outline"
            elevation={4}
            square
            sx={{ position: 'absolute', top: 0, bottom: 0, left: RAIL_WIDTH, width: 300, overflow: 'auto', zIndex: 2 }}
        >
            <List dense>
                {groups.map(([className, members]) => (
                    <li key={className}>
                        <ul style={{ padding: 0 }}>
                            <ListSubheader>{className}</ListSubheader>
                            {members.map((entity) => (
                                <ListItemButton
                                    key={entity.id}
                                    selected={entity.id === focused}
                                    onClick={() => {
                                        focusEntity(entity.id);
                                        toggleOutline(false);
                                    }}
                                >
                                    <ListItemText primary={entity.name} />
                                </ListItemButton>
                            ))}
                        </ul>
                    </li>
                ))}
            </List>
        </Paper>
    );
}

export function OutlineRail() {
    const open = useReviewStore((s) => s.outlineOpen);
    const toggleOutline = useReviewStore((s) => s.toggleOutline);
    return (
        <>
            <Box
                sx={{
                    width: RAIL_WIDTH,
                    flexShrink: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    pt: 1,
                    textAlign: 'center',
                }}
            >
                <Tooltip title="Outline (O)" placement="right">
                    <IconButton aria-label="toggle outline" aria-pressed={open} onClick={() => toggleOutline()}>
                        <FormatListBulletedIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            {open && <Outline />}
        </>
    );
}
