import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo } from 'react';
import { reviewStatus, statusColors } from '../inspector/status';
import { StatusLabel } from '../inspector/StatusLabel';
import { analysesBeside, currentAnalyses, guidedOrder, hasPoints, type CoordinateAnalysis } from '../model/coordinates';
import { targetKey } from '../model/targetKey';
import { useReviewStore } from '../store/context';
import type { ReviewState } from '../store/reviewStore';
import { layoutText, type Block, type ParsedPaperLayout } from '../text/layout';
import { ASIDE } from '../text/TextIndex';
import { analysisTarget, pendingKeys } from './actions';
import { PointGrid } from './PointGrid';

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

const AnalysisCard = memo(function AnalysisCard({ analysis }: { analysis: CoordinateAnalysis }) {
    const focused = useReviewStore((s) => s.coordinates?.analysis === analysis.key);
    const focusedPoint = useReviewStore((s) => (s.coordinates?.analysis === analysis.key ? s.coordinates.point : null));
    const selected = useReviewStore((s) => (s.coordinates?.analysis === analysis.key ? s.coordinates.selected : null));
    const merging = useReviewStore((s) => s.merging.includes(analysis.key));
    const saving = useReviewStore((s) => pendingKeys(s).has(analysis.key));
    const reviewed = useReviewStore((s) => s.provenance[targetKey(analysisTarget(analysis.key))]?.state);
    const focusAnalysis = useReviewStore((s) => s.focusAnalysis);
    const toggleMerge = useReviewStore((s) => s.toggleMerge);
    const nonCoordinate = !hasPoints(analysis);
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
                <Typography variant="subtitle2" component="h3">
                    {analysis.name}
                </Typography>
                <Chip size="small" variant="outlined" label={analysis.role} />
                <StatusLabel id={reviewStatus(reviewed)} />
                {nonCoordinate && <Chip size="small" label="non-coordinate" />}
                {merging && (
                    <Typography variant="caption" color="primary">
                        selected for merge
                    </Typography>
                )}
                {saving && (
                    <Typography variant="caption" color="text.secondary">
                        saving…
                    </Typography>
                )}
            </Stack>
            {!nonCoordinate && <PointGrid analysis={analysis} focusedPoint={focusedPoint} selected={selected ?? []} />}
        </Box>
    );
});

let besideCache: { key: unknown[]; beside: ReturnType<typeof analysesBeside> } | null = null;
/** The analyses beside each block of the text in guided order; worked out once per text, parse, revision and display setting. */
function besideBlocks(s: Pick<ReviewState, 'bundle' | 'showNonCoordinate'>) {
    const { text, parsed_paper, coordinate_parse, coordinate_revision } = s.bundle;
    const key = [text, parsed_paper, coordinate_parse, coordinate_revision, s.showNonCoordinate];
    if (!besideCache || besideCache.key.some((part, i) => part !== key[i])) {
        const blocks = layoutText(text, parsed_paper as ParsedPaperLayout);
        const ordered = guidedOrder(currentAnalyses(s.bundle), s.showNonCoordinate);
        besideCache = { key, beside: analysesBeside(blocks, ordered) };
    }
    return besideCache.beside;
}

/** The analyses set beside a block of the text in the coordinates step, and a table's button to add one. */
export function CoordinateAside({ block }: { block: Block | null }) {
    const step = useReviewStore((s) => s.step);
    const beside = useReviewStore(besideBlocks);
    const tables = useReviewStore((s) => (s.bundle.parsed_paper as ParsedPaperLayout).tables);
    const addAnalysisTo = useReviewStore((s) => s.addAnalysisTo);
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
                <Button size="small" onClick={() => addAnalysisTo(table.tableId)}>
                    {`Add an analysis to ${label}`}
                </Button>
            )}
        </Box>
    );
}
