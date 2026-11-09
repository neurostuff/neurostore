import { Accordion, AccordionDetails, AccordionSummary, Link, Stack, Typography } from '@mui/material';
import type { ComponentProps } from 'react';
import type { Group } from './grouping';
import { MapList } from './MapList';
import { ISSUE_REASONS, type IssueReason, type ShareAnalysis, type ShareView } from './types';

/** One analysis from the paper and the maps placed on it. */
export function AnalysisLane({
    analysis,
    groups,
    issues,
    preview,
    onIssue,
    ...list
}: {
    analysis: ShareAnalysis;
    groups: Group[];
    issues: ShareView['issues'];
    preview: boolean;
    onIssue: () => void;
} & Omit<ComponentProps<typeof MapList>, 'groups' | 'from'>) {
    const count = groups.reduce((total, group) => total + 1 + group.members.length, 0);
    return (
        <Accordion
            square
            disableGutters
            defaultExpanded
            elevation={0}
            sx={{
                width: '100%',
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
                '&::before': { display: 'none' },
            }}
        >
            <AccordionSummary expandIcon={<span>▾</span>}>
                <Stack sx={{ width: '100%', minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left' }}>
                            {analysis.points} coordinates
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {count} {count === 1 ? 'map' : 'maps'}
                        </Typography>
                    </Stack>
                    <Typography variant="h6" component="span" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                        {analysis.name}
                    </Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={1}>
                    {groups.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No maps in this analysis. Move a map here, or leave the analysis alone if you don't see a valid map
                        </Typography>
                    ) : (
                        <MapList groups={groups} from={analysis.key} {...list} />
                    )}
                    {issues.map((issue, index) => (
                        <Typography key={index} variant="caption" color="warning.main">
                            You told us: {ISSUE_REASONS[issue.reason as IssueReason] ?? issue.reason}
                        </Typography>
                    ))}
                    <Link
                        component="button"
                        variant="caption"
                        sx={{ alignSelf: 'flex-start' }}
                        disabled={preview}
                        onClick={onIssue}
                    >
                        something's wrong with this analysis
                    </Link>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
