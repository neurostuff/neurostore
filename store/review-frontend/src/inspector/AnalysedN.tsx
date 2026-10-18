import { Box, Button, List, ListItem } from '@mui/material';
import { memo, useMemo } from 'react';
import { analysedCounts } from '../model/analysed';
import type { EntityNode } from '../model/record';
import { useSession, useView } from '../store/context';

/** The n each analysis using `entity` analysed of it, read-only, each linking to the count on its analysis. */
export const AnalysedN = memo(function AnalysedN({ entity }: { entity: EntityNode }) {
    const index = useSession((s) => s.index);
    const counts = useMemo(() => analysedCounts(index, entity.id), [index, entity.id]);
    const focusSlot = useView((s) => s.focusSlot);
    if (counts.length === 0) return null;
    return (
        <List dense disablePadding aria-label="analysed n" sx={{ typography: 'body2' }}>
            {counts.map(({ analysis, slot, n }) => (
                <ListItem key={slot.key} disableGutters disablePadding>
                    <Box component="span">{`n analysed: ${String(n)}, in `}</Box>
                    <Button
                        size="small"
                        aria-label={`open ${analysis.name}`}
                        title="The analysed n is set on the analysis; open it there to change it"
                        sx={{ py: 0, minWidth: 0, textTransform: 'none' }}
                        onClick={() => focusSlot(slot.key)}
                    >
                        {`${analysis.name} →`}
                    </Button>
                </ListItem>
            ))}
        </List>
    );
});
