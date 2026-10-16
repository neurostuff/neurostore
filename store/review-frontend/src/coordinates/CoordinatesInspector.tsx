import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { CardHead } from '../inspector/CardHead';
import { NotePanel, RejectPanel } from '../inspector/panels';
import { reviewStatus } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import { targetKey } from '../model/targetKey';
import { ActionToolbar } from '../review/ActionToolbar';
import { useEditorName } from '../review/editor';
import { useReviewStore } from '../store/context';
import { analysisTarget, coordinatePending, focusedAnalysis } from './actions';
import { AddAnalysisPanel, MergeDialog, MovePanel, PointPanel, RelabelPanel } from './panels';

function Offer() {
    const offer = useReviewStore((s) => s.offer);
    const name = useReviewStore((s) => (s.offer ? (s.index.entity(s.offer.entity)?.name ?? s.offer.entity) : ''));
    const focusEntity = useReviewStore((s) => s.focusEntity);
    if (!offer) return null;
    return (
        <Alert severity="info" sx={{ mx: 2, mt: 1 }}>
            The new analysis has a card in the record.{' '}
            <Button size="small" onClick={() => focusEntity(offer.entity)}>
                {`Open the record’s card for ${name}`}
            </Button>
        </Alert>
    );
}

/** The inspector while a coordinate analysis is in focus: its actions, its summary and the panel open on it. */
export function CoordinatesInspector() {
    const analysis = useReviewStore(focusedAnalysis);
    const coordinates = useReviewStore((s) => s.coordinates);
    const panel = useReviewStore((s) => s.panel);
    const merging = useReviewStore((s) => s.merging.length);
    const saving = useReviewStore(coordinatePending);
    const reviewed = useReviewStore((s) =>
        analysis ? s.provenance[targetKey(analysisTarget(analysis.key))]?.state : undefined
    );
    const editor = useEditorName(analysis ? targetKey(analysisTarget(analysis.key)) : '');
    const place = analysis?.table_id ?? analysis?.origin;
    return (
        <>
            <ActionToolbar scope="coordinates" label="coordinate actions" />
            <Box role="status" aria-label="pending coordinate changes" sx={{ px: 2, typography: 'caption' }}>
                {saving ? 'saving coordinate changes…' : ''}
            </Box>
            <Offer />
            {analysis && coordinates && (
                <Box component="section" aria-label={analysis.name}>
                    <CardHead overline="coordinate analysis" title={analysis.name}>
                        <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip size="small" variant="outlined" label={analysis.role} />
                            <StatusLabel id={reviewStatus(reviewed)} by={editor} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {analysis.key}
                            </Typography>
                            {place && (
                                <Typography variant="caption" color="text.secondary">
                                    {place}
                                </Typography>
                            )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="div">
                            {[
                                `${analysis.points?.length ?? 0} points`,
                                coordinates.selected.length ? `${coordinates.selected.length} selected` : '',
                                merging ? `${merging} selected for merge` : '',
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </Typography>
                        {panel?.kind === 'note' && <NotePanel target={panel.target} label={analysis.name} />}
                        {panel?.kind === 'relabel' && <RelabelPanel analysis={analysis} />}
                        {panel?.kind === 'move' && <MovePanel />}
                        {(panel?.kind === 'edit_point' || panel?.kind === 'add_point') && (
                            <PointPanel
                                analysis={analysis}
                                index={panel.kind === 'edit_point' ? coordinates.point : null}
                            />
                        )}
                        {panel?.kind === 'reject' && <RejectPanel target={panel.target} label={analysis.name} />}
                        {panel?.kind === 'merge' && <MergeDialog />}
                    </CardHead>
                </Box>
            )}
            {panel?.kind === 'add_analysis' && panel.table && (
                <Box sx={{ px: 2 }}>
                    <AddAnalysisPanel table={panel.table} />
                </Box>
            )}
        </>
    );
}
