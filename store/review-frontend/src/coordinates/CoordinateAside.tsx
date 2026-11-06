import EditNoteIcon from '@mui/icons-material/EditNote';
import { Box, Button, Chip, IconButton, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo } from 'react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import { analysesBeside, currentAnalyses, guidedOrder, hasPoints, type CoordinateAnalysis } from '../model/coordinates';
import { targetKey } from '../model/targetKey';
import { useEditorName } from '../review/editor';
import { openPanelOn } from '../inspector/openPanel';
import { useIsEditable, useReviewStores, useSession, useView } from '../store/context';
import { layoutText, type Block, type ParsedPaperLayout } from '../model/layout';
import { ASIDE } from '../text/TextIndex';
import { analysisTarget } from '../model/targetKey';
import { analysisPlace } from '../model/coordinateFocus';
import type { RecordIndex } from '../model/record';
import { selectSourceUnknown } from '../store/viewSelectors';
import { addAnalysisPanel } from './actions';
import { pendingKeys } from '../store/pointEdits';
import { useAnalysisWithPending } from './pendingAnalysis';
import { namingSlot } from './availability';
import { AnalysisName } from './AnalysisName';
import { AuthorshipChip } from './AuthorshipChip';
import { PointGrid } from './PointGrid';
import { analysisSummary } from './summary';
import { NamedBy } from './RecordLinks';
import { Hint } from '../review/Hint';

const asideStyles = (theme: Theme) => ({
    my: 1.5,
    pl: 1.5,
    borderLeft: 3,
    borderColor: 'divider',
    typography: 'body2',
    '& .rv-analysis': { py: 1, px: 1, mb: 1, borderLeft: 3, borderColor: 'transparent', cursor: 'pointer' },
    '& .rv-analysis[aria-current="true"]': { borderColor: 'primary.main', bgcolor: 'action.selected' },
    '& .rv-analysis[data-non-coordinate]': { opacity: 0.6 },
    '& .rv-points': { borderCollapse: 'collapse', fontSize: '0.8125rem', mt: 0.5 },
    '& .rv-points th, & .rv-points td': { px: 0.75, py: 0.25, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    '& .rv-points th': { color: 'text.secondary', fontWeight: 500 },
    '& .rv-points tbody tr': { cursor: 'pointer' },
    '& .rv-points tbody tr:hover': { bgcolor: 'action.hover' },
    '& .rv-points tr[aria-current="true"]': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
    '& .rv-points tr[aria-selected="true"]': { bgcolor: 'action.selected' },
    '& .rv-visually-hidden': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
    ...statusColors(theme.palette),
});

const AnalysisCard = memo(function AnalysisCard({ analysis: given }: { analysis: CoordinateAnalysis }) {
    const analysis = useAnalysisWithPending(given);
    const focused = useView((s) => s.coordinates?.analysis === analysis.key);
    const focusedPoint = useView((s) => (s.coordinates?.analysis === analysis.key ? s.coordinates.point : null));
    const selected = useView((s) => (s.coordinates?.analysis === analysis.key ? s.coordinates.selected : null));
    const merging = useView((s) => s.merging.includes(analysis.key));
    const saving = useSession((s) => pendingKeys(s).has(analysis.key));
    const reviewed = useSession((s) => s.provenance[targetKey(analysisTarget(analysis.key))]?.state);
    const editor = useEditorName(targetKey(analysisTarget(analysis.key)));
    const focusAnalysis = useView((s) => s.focusAnalysis);
    const toggleMerge = useView((s) => s.toggleMerge);
    const nonCoordinate = !hasPoints(analysis);
    const summary = useSession((s) => analysisSummary(s.bundle, s.index, analysis));
    return (
        <Box
            component="article"
            className="rv-analysis"
            aria-label={analysis.name}
            aria-current={focused ? 'true' : undefined}
            aria-busy={saving || undefined}
            data-analysis-key={analysis.key}
            data-non-coordinate={nonCoordinate || undefined}
            onClick={(event) => (event.shiftKey ? toggleMerge(analysis.key) : focusAnalysis(analysis.key))}
        >
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <AnalysisName analysis={analysis} variant="subtitle2" component="h3" />
                <EditAnalysisButton analysis={analysis} />
                <Chip size="small" variant="outlined" label={analysis.role} />
                <AuthorshipChip analysis={analysis} judged={reviewed !== undefined} />
                <StatusLabel id={reviewStatus(reviewed)} by={editor} />
                {nonCoordinate && <Chip size="small" label="non-coordinate" />}
                {merging && (
                    <Typography variant="caption" color="primary">
                        selected for merge
                    </Typography>
                )}
            </Stack>
            <Typography variant="caption" color="text.secondary" component="div">
                {summary}
            </Typography>
            <NamedBy analysis={analysis} />
            <SourceUnknown analysis={analysis} />
            {!nonCoordinate && <PointGrid analysis={analysis} focusedPoint={focusedPoint} selected={selected ?? []} />}
        </Box>
    );
});

/** Focuses the analysis and opens its Edit analysis form. */
function EditAnalysisButton({ analysis }: { analysis: CoordinateAnalysis }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    return (
        <Hint title="Edit analysis: its name, coordinate space and role (n)">
            <span>
                <IconButton
                    size="small"
                    aria-label={`edit analysis ${analysis.name}`}
                    disabled={!editable}
                    onClick={(event) => {
                        event.stopPropagation();
                        stores.view.getState().focusAnalysis(analysis.key);
                        openPanelOn(stores, 'edit_analysis');
                    }}
                >
                    <EditNoteIcon fontSize="small" />
                </IconButton>
            </span>
        </Hint>
    );
}

/** Says so when the text holds no span of a text analysis, and how to give it one. */
function SourceUnknown({ analysis }: { analysis: CoordinateAnalysis }) {
    const unknown = useSession((s) => !analysis.table_id && selectSourceUnknown(s, analysis.key));
    const addable = useSession((s) => namingSlot(s.index, analysis) !== undefined);
    if (!unknown) return null;
    return (
        <Typography variant="caption" color="warning.dark" component="div">
            {addable ? 'source sentence unknown: select it in the paper, then press E' : 'source sentence unknown'}
        </Typography>
    );
}

interface BesideCache {
    key: unknown[];
    places: string;
    beside: ReturnType<typeof analysesBeside>;
}
let besideCache: BesideCache | null = null;
/** How many parts of the cache key are the bundle's documents: the text, the paper, the parse and the revision. */
const DOCUMENTS = 4;
/** Whether `cache` was worked out from the same first `count` parts of `key`, every part by default. */
const cachedFrom = (cache: BesideCache, key: unknown[], count = key.length) =>
    key.slice(0, count).every((part, i) => part === cache.key[i]);
/**
 * The analyses beside each block of the text in guided order; worked out once per text, parse, revision, record
 * and display setting, and kept while every analysis keeps its place.
 */
function besideBlocks(bundle: ReviewBundle, index: RecordIndex, showNonCoordinate: boolean) {
    const { text, parsed_paper, coordinate_parse, coordinate_revision } = bundle;
    const key = [text, parsed_paper, coordinate_parse, coordinate_revision, index, showNonCoordinate];
    if (besideCache && cachedFrom(besideCache, key)) return besideCache.beside;
    const blocks = layoutText(text, parsed_paper as ParsedPaperLayout);
    const ordered = guidedOrder(currentAnalyses(bundle), showNonCoordinate);
    const placed = new Map(ordered.map((analysis) => [analysis, analysisPlace(bundle, index, blocks, analysis)]));
    const places = JSON.stringify([...placed].map(([analysis, place]) => [analysis.key, place]));
    const kept = besideCache?.places === places && cachedFrom(besideCache, key, DOCUMENTS);
    const beside = kept ? besideCache!.beside : analysesBeside(blocks, ordered, (analysis) => placed.get(analysis));
    besideCache = { key, places, beside };
    return beside;
}

/** The analyses set beside a block of the text in the coordinates step, and a table's button to add one. */
export function CoordinateAside({ block }: { block: Block | null }) {
    const step = useView((s) => s.step);
    const showNonCoordinate = useView((s) => s.showNonCoordinate);
    const beside = useSession((s) => besideBlocks(s.bundle, s.index, showNonCoordinate));
    const tables = useSession((s) => (s.bundle.parsed_paper as ParsedPaperLayout).tables);
    const openPanel = useView((s) => s.openPanel);
    const editable = useIsEditable();
    if (step !== 'coordinates') return null;
    const analyses = beside.get(block?.start ?? 'end') ?? [];
    const table = block?.kind === 'table' ? block : undefined;
    if (!table && analyses.length === 0) return null;
    const label = table ? (tables?.find((t) => t.table_id === table.tableId)?.label ?? table.tableId) : 'the text';
    return (
        <Box component="aside" {...{ [ASIDE]: '' }} aria-label={`analyses beside ${label}`} sx={asideStyles}>
            {analyses.map((analysis) => (
                <AnalysisCard key={analysis.key} analysis={analysis} />
            ))}
            {table && (
                <Hint title={`Add an analysis of the coordinates in ${label} (c on an analysis of it)`}>
                    <span>
                        <Button
                            size="small"
                            disabled={!editable}
                            onClick={() => openPanel(addAnalysisPanel(table.tableId))}
                        >
                            {`Add an analysis to ${label}`}
                        </Button>
                    </span>
                </Hint>
            )}
        </Box>
    );
}
