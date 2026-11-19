import { Box, Typography } from '@mui/material';
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
        <BoardColumn id="unassigned-heading" title="Unassigned maps" fill>
            {groups.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    {empty}
                </Typography>
            ) : (
                <>
                    <Typography variant="caption" color="text.secondary">
                        We weren't sure about these. Move each to the relevant analysis or ignore them if they do not belong.
                    </Typography>
                    {/* A long pool scrolls inside the column instead of stretching the page: to the
                        column's height side by side, to the screen's height when stacked. */}
                    <Box
                        sx={{
                            maxHeight: { xs: '100vh', md: 'none' },
                            flex: { md: '1 1 auto' },
                            minHeight: { md: 0 },
                            overflowY: 'auto',
                        }}
                    >
                        <MapList groups={groups} from={null} {...list} />
                    </Box>
                </>
            )}
        </BoardColumn>
    );
}
