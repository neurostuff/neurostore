import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { CardHead } from '../inspector/CardHead';
import { NotePanel, RejectPanel } from '../inspector/panels';
import { reviewStatus } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import { targetKey } from '../model/targetKey';
import { VerdictStatus } from '../inspector/WayOn';
import { AnalysisReasons, CoordinateHeadActions, PointActions } from '../review/actionButtons';
import { useEditorName } from '../review/editor';
import { useSession, useSessionView, useView } from '../store/context';
import { focusedAnalysis } from '../model/coordinateFocus';
import { analysisTarget } from '../model/targetKey';
import type { CoordinateAnalysis } from '../model/coordinates';
import { humanize } from '../model/labels';
import { PointEditsSaved, StrandedEdits } from './PointEditsStatus';
import { guidedPosition } from './availability';
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

/** Where the focused analysis is in the order Shift+J and Shift+K walk. */
function Position() {
    const position = useSessionView((session, view) => {
        const { at, of } = guidedPosition(session, view);
        // Spelt through humanize: the check that this code names no schema class forbids the capitalised word itself.
        return at ? `${humanize('analysis')} ${at} of ${of}` : '';
    });
    return (
        <Typography variant="body2" color="text.secondary" component="span">
            {position}
        </Typography>
    );
}

/** What the reviewer's last verdict on the analysis did, and the way on. */
function JudgedStatus({ analysis }: { analysis: CoordinateAnalysis }) {
    const verdict = useView((s) => (s.judged?.analysis === analysis.key ? s.judged.verdict : null));
    return <VerdictStatus text={verdict ? `${verdict === 'accept' ? 'Accepted' : 'Rejected'} ${analysis.name}` : ''} />;
}

/** Which point the point actions act on: the focused one, else the analysis's points. */
const pointsLabel = (analysis: CoordinateAnalysis, point: number | null) =>
    point === null ? `the points of ${analysis.name}` : `point ${point + 1} of ${analysis.name}`;

/** The inspector while a coordinate analysis is in focus: its head with its actions, the panel open on it, and its points. */
export function CoordinatesInspector() {
    const coordinates = useView((s) => s.coordinates);
    const analysis = useSession((s) => focusedAnalysis({ bundle: s.bundle, coordinates }));
    const panel = useView((s) => s.panel);
    const merging = useView((s) => s.merging.length);
    const reviewed = useSession((s) =>
        analysis ? s.provenance[targetKey(analysisTarget(analysis.key))]?.state : undefined
    );
    const editor = useEditorName(analysis ? targetKey(analysisTarget(analysis.key)) : '');
    const summary = useSession((s) => (analysis ? analysisSummary(s.bundle, s.index, analysis) : ''));
    return (
        <>
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
                            <PointEditsSaved analysis={analysis} />
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
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                            sx={{ pt: 1 }}
                        >
                            <Position />
                            <CoordinateHeadActions />
                        </Stack>
                        <StrandedEdits />
                        <AnalysisReasons />
                        <JudgedStatus analysis={analysis} />
                        <NamedBy analysis={analysis} />
                        {panel?.kind === 'note' && <NotePanel target={panel.target} label={analysis.name} />}
                        {panel?.kind === 'edit_analysis' && <EditAnalysisPanel analysis={analysis} />}
                        {panel?.kind === 'relabel' && <RelabelPanel analysis={analysis} />}
                        {panel?.kind === 'move' && <MovePanel />}
                        {panel?.kind === 'reject' && <RejectPanel target={panel.target} label={analysis.name} />}
                        {panel?.kind === 'merge' && <MergeDialog />}
                    </CardHead>
                    <Box sx={{ px: 2, py: 1 }}>
                        <PointsView analysis={analysis}>
                            <PointActions label={pointsLabel(analysis, coordinates.point)} />
                        </PointsView>
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
