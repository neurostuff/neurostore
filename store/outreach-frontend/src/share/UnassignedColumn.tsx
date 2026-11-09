import { Typography } from '@mui/material';
import type { ComponentProps } from 'react';
import { BoardColumn } from './BoardColumn';
import type { Group } from './grouping';
import { MapList } from './MapList';

/** The maps waiting for an analysis. */
export function UnassignedColumn({
    groups,
    empty,
    ...list
}: { groups: Group[]; /** What to say when nothing waits. */ empty: string } & Omit<
    ComponentProps<typeof MapList>,
    'groups' | 'from'
>) {
    return (
        <BoardColumn id="unassigned-heading" title="Unassigned maps">
            {groups.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    {empty}
                </Typography>
            ) : (
                <>
                    <Typography variant="caption" color="text.secondary">
                        We weren't sure about these. Move each to the analysis it belongs to.
                    </Typography>
                    <MapList groups={groups} from={null} {...list} />
                </>
            )}
        </BoardColumn>
    );
}
