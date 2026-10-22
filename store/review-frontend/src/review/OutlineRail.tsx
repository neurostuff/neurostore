import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import {
    Box,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    Paper,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import { useMemo } from 'react';
import { reviewStatus } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import type { EntityNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { useSession, useShown, useView } from '../store/context';
import { selectDiff } from '../store/diffSelectors';
import { editorName } from './editor';
import { Hint } from './Hint';
import { notedEntities, outlineMatches } from './outline';
import type { OutlineFilter } from '../store/viewStore';

const RAIL_WIDTH = 48;

const FILTERS: Exclude<OutlineFilter, 'all'>[] = ['unreviewed', 'changed', 'noted', 'doubtful'];

function byClass(entities: EntityNode[]) {
    const groups = new Map<string, EntityNode[]>();
    for (const entity of entities) {
        groups.set(entity.entityClass, [...(groups.get(entity.entityClass) ?? []), entity]);
    }
    return [...groups];
}

function FilterBar() {
    const filter = useView((s) => s.outlineFilter);
    const setOutlineFilter = useView((s) => s.setOutlineFilter);
    return (
        <ToggleButtonGroup
            size="small"
            exclusive
            aria-label="filter the outline"
            value={filter === 'all' ? null : filter}
            onChange={(_, value: OutlineFilter | null) => setOutlineFilter(value ?? 'all')}
            sx={{ flexWrap: 'wrap', m: 1 }}
        >
            {FILTERS.map((value) => (
                <ToggleButton key={value} value={value} aria-label={value}>
                    {value}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

function Outline() {
    const entities = useShown((index) => index.visible);
    const provenance = useSession((s) => s.provenance);
    const reviewers = useSession((s) => s.bundle.reviewers);
    const ops = useSession((s) => s.bundle.ops);
    const pending = useSession((s) => s.pending);
    const filter = useView((s) => s.outlineFilter);
    const diff = useSession(selectDiff);
    const focused = useView((s) => s.focus.entity);
    const focusEntity = useView((s) => s.focusEntity);
    const toggleOutline = useView((s) => s.toggleOutline);
    const noted = useMemo(() => notedEntities([...ops.map((s) => s.op), ...pending]), [ops, pending]);
    const statuses = useMemo(
        () => new Map(entities.map((entity) => [entity.id, reviewStatus(provenance[entityKey(entity.id)]?.state)])),
        [entities, provenance]
    );
    const editors = useMemo(
        () => new Map(entities.map((entity) => [entity.id, editorName(reviewers, provenance[entityKey(entity.id)])])),
        [entities, provenance, reviewers]
    );
    const groups = useMemo(
        () =>
            byClass(
                entities.filter((entity) =>
                    outlineMatches(
                        filter,
                        entity,
                        statuses.get(entity.id)!,
                        noted.has(entity.id),
                        diff.byKey.get(entityKey(entity.id))?.status ?? 'same'
                    )
                )
            ),
        [entities, statuses, filter, noted, diff]
    );
    return (
        <Paper
            component="nav"
            aria-label="outline"
            elevation={4}
            square
            sx={{ position: 'absolute', top: 0, bottom: 0, left: RAIL_WIDTH, width: 300, overflow: 'auto', zIndex: 2 }}
        >
            <FilterBar />
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
                                    <ListItemText
                                        primary={entity.name}
                                        secondary={
                                            <StatusLabel id={statuses.get(entity.id)!} by={editors.get(entity.id)} />
                                        }
                                        secondaryTypographyProps={{ component: 'div' }}
                                    />
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
    const open = useView((s) => s.outlineOpen);
    const toggleOutline = useView((s) => s.toggleOutline);
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
                <Hint title="Outline: every entity, by class, with filters (O)" placement="right">
                    <IconButton aria-label="toggle outline" aria-pressed={open} onClick={() => toggleOutline()}>
                        <FormatListBulletedIcon />
                    </IconButton>
                </Hint>
            </Box>
            {open && <Outline />}
        </>
    );
}
