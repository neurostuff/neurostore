import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { CardHead } from '../inspector/CardHead';
import { NotePanel, RejectPanel } from '../inspector/panels';
import { reviewStatus } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import { targetKey } from '../model/targetKey';
import { ActionToolbar } from '../review/ActionToolbar';
import { useEditorName } from '../review/editor';
import { useSession, useView } from '../store/context';
import { focusedAnalysis } from '../model/coordinateFocus';
import { analysisTarget } from '../model/targetKey';
import { coordinatePending } from './availability';
import { AnalysisName } from './AnalysisName';
import { AddAnalysisChooser } from './AddAnalysisChooser';
import { AuthorshipChip } from './AuthorshipChip';
import { NamedBy } from './RecordLinks';
import { PointsView } from './PointsView';
import { analysisSummary } from './summary';
import { AddAnalysisPanel, EditAnalysisPanel, MergeDialog, MovePanel, RelabelPanel } from './panels';


function Offer() {
    const offer = useView((s) => s.offer);
    const name = useSession((s) => (offer ? (s.index.entity(offer.entity)?.name ?? offer.entity) : ''));
    const focusEntity = useView((s) => s.focusEntity);
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
    const coordinates = useView((s) => s.coordinates);
    const analysis = useSession((s) => focusedAnalysis({ bundle: s.bundle, coordinates }));
    const panel = useView((s) => s.panel);
    const merging = useView((s) => s.merging.length);
    const saving = useSession(coordinatePending);
    const reviewed = useSession((s) =>
        analysis ? s.provenance[targetKey(analysisTarget(analysis.key))]?.state : undefined
    );
    const editor = useEditorName(analysis ? targetKey(analysisTarget(analysis.key)) : '');
    const summary = useSession((s) => (analysis ? analysisSummary(s.bundle, s.index, analysis) : ''));
    return (
        <>
            <ActionToolbar scope="coordinates" label="coordinate actions" />
            <Box role="status" aria-label="pending coordinate changes" sx={{ px: 2, typography: 'caption' }}>
                {saving ? 'saving coordinate changes…' : ''}
            </Box>
            <Offer />
            {analysis && coordinates && (
                <Box component="section" aria-label={analysis.name}>
                    <CardHead
                        overline="coordinate analysis"
                        title={analysis.name}
                        heading={<AnalysisName analysis={analysis} variant="h6" component="h2" />}
                    >
                        <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip size="small" variant="outlined" label={analysis.role} />
                            <AuthorshipChip analysis={analysis} judged={reviewed !== undefined} />
                            <StatusLabel id={reviewStatus(reviewed)} by={editor} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="div">
                            {[
                                summary,
                                coordinates.selected.length ? `${coordinates.selected.length} selected` : '',
                                merging ? `${merging} selected for merge` : '',
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </Typography>
                        <NamedBy analysis={analysis} />
                        {panel?.kind === 'note' && <NotePanel target={panel.target} label={analysis.name} />}
                        {panel?.kind === 'edit_analysis' && <EditAnalysisPanel analysis={analysis} />}
                        {panel?.kind === 'relabel' && <RelabelPanel analysis={analysis} />}
                        {panel?.kind === 'move' && <MovePanel />}
                        {panel?.kind === 'reject' && <RejectPanel target={panel.target} label={analysis.name} />}
                        {panel?.kind === 'merge' && <MergeDialog />}
                    </CardHead>
                    <Box sx={{ px: 2, py: 1 }}>
                        <PointsView analysis={analysis} />
                    </Box>
                </Box>
            )}
            <AddAnalysisChooser />
            {panel?.kind === 'add_analysis' && (panel.table || panel.span) && (
                <Box sx={{ px: 2 }}>
                    <AddAnalysisPanel
                        key={panel.table ?? panel.span!.join(':')}
                        source={panel.table ? { table: panel.table } : { span: panel.span! }}
                    />
                </Box>
            )}
        </>
    );
}
