import { Box, Button, GlobalStyles, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLayoutEffect, useRef } from 'react';
import { useReviewStores, useSession, useSessionView, useView } from '../store/context';
import { selectEvidenceCursor, selectFocusedSpans } from '../store/viewSelectors';
import { REVIEW_HIGHLIGHTS, type HighlightNames } from './highlights';
import { layoutText, type ParsedPaperLayout } from '../model/layout';
import { SelectionBar } from './SelectionBar';
import { SpanHandles } from './SpanHandles';
import { SpanTicks } from './SpanTicks';
import { SupportMenu } from './SupportMenu';
import { TextBody, type Aside } from './TextBody';
import { useSupportingFocus } from './supporting';
import { useHighlights } from './useHighlights';
import { TextIndexContext, useTextIndex } from './useTextIndex';
import { Hint } from '../review/Hint';

const PULSE_MS = 600;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function scrollToRange(scroller: HTMLElement, range: Range) {
    const top = range.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += top - scroller.clientHeight / 3;
}

function EvidenceCounter() {
    const spans = useSessionView((session, view) => selectFocusedSpans(session, view).length);
    const cursor = useSessionView(selectEvidenceCursor);
    const focused = useView((s) => s.focus.key);
    const notReported = useSession((s) => s.index.slot(focused)?.value?.extraction_status === 'not_reported');
    const onAnalysis = useView((s) => s.coordinates !== null);
    const empty = onAnalysis ? 'source sentence unknown' : notReported ? 'not reported' : 'no evidence';
    const counter = spans > 0 ? `evidence ${cursor + 1} of ${spans}` : empty;
    return (
        <Typography variant="body2" color="text.secondary" data-evidence-counter>
            {counter}
        </Typography>
    );
}

function ShowAllToggle() {
    const showAll = useView((s) => s.showAllEvidence);
    const toggleAllEvidence = useView((s) => s.toggleAllEvidence);
    return (
        <Hint title="Fill every evidence span in the paper, not only the focused item's (Shift+V)">
            <Button size="small" aria-pressed={showAll} onClick={() => toggleAllEvidence()}>
                show all evidence
            </Button>
        </Hint>
    );
}

/** What the two span sets look like while the diff is shown. */
function DiffLegend() {
    const diffOn = useView((s) => s.diffOn);
    if (!diffOn) return null;
    return (
        <Stack role="note" aria-label="diff legend" direction="row" spacing={1.5} sx={{ typography: 'caption' }}>
            <Box component="span" sx={{ borderBottom: 2, borderBottomStyle: 'dashed', borderColor: 'secondary.main' }}>
                original
            </Box>
            <Box component="span" sx={(theme) => ({ bgcolor: alpha(theme.palette.primary.main, 0.3) })}>
                review
            </Box>
        </Stack>
    );
}

function HighlightStyles({ names, showAll }: { names: HighlightNames; showAll: boolean }) {
    return (
        <GlobalStyles
            styles={(theme) => ({
                [`::highlight(${names.focus})`]: {
                    backgroundColor: alpha(theme.palette.primary.main, 0.3),
                },
                [`::highlight(${names.pulse})`]: {
                    backgroundColor: alpha(theme.palette.primary.main, 0.6),
                },
                [`::highlight(${names.moving})`]: {
                    backgroundColor: alpha(theme.palette.secondary.main, 0.35),
                },
                [`::highlight(${names.original})`]: {
                    textDecorationLine: 'underline',
                    textDecorationStyle: 'dashed',
                    textDecorationThickness: '2px',
                    textDecorationColor: theme.palette.secondary.main,
                },
                [`::highlight(${names.evidence})`]: {
                    ...(showAll && { backgroundColor: alpha(theme.palette.primary.main, 0.12) }),
                    textDecorationLine: 'underline',
                    textDecorationStyle: 'dotted',
                    textDecorationColor: alpha(theme.palette.primary.main, 0.45),
                },
            })}
        />
    );
}

const textStyles = {
    '& .rv-text': { maxWidth: '75ch', mx: 'auto', py: 2, lineHeight: 1.6 },
    '& .rv-paragraph': { whiteSpace: 'pre-wrap', my: 1.5 },
    '& .rv-heading': { mt: 3, mb: 1 },
    '& .rv-marker': { display: 'none' },
    '& .rv-lost': { color: 'text.disabled', fontSize: '0.75em', verticalAlign: 'super', cursor: 'help' },
    '& .rv-trail': { whiteSpace: 'normal' },
    '& .rv-table': { borderCollapse: 'collapse', fontSize: '0.875rem', my: 2 },
    '& .rv-table td': { border: 1, borderColor: 'divider', px: 1, py: 0.5, verticalAlign: 'top' },
};

export function TextPane({ highlights = REVIEW_HIGHLIGHTS, aside }: { highlights?: HighlightNames; aside?: Aside }) {
    const stores = useReviewStores();
    const text = useSession((s) => s.bundle.text);
    const parsedPaper = useSession((s) => s.bundle.parsed_paper as ParsedPaperLayout);
    const blocks = layoutText(text, parsedPaper);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const index = useTextIndex(rootRef);
    const layer = useHighlights(index, highlights);
    const showAll = useView((s) => s.showAllEvidence);
    const { onClick, onKeyDown, menu } = useSupportingFocus(index, layer);

    useLayoutEffect(() => {
        if (!layer) return;
        const opening = stores.view.getState().reveal;
        if (opening) scrollToRange(scrollerRef.current!, layer.range(opening.span));
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = stores.view.subscribe(({ reveal }, prev) => {
            if (!reveal || reveal.seq === prev.reveal?.seq) return;
            scrollToRange(scrollerRef.current!, layer.range(reveal.span));
            if (prefersReducedMotion()) return;
            clearTimeout(timer);
            layer.pulse(reveal.span);
            timer = setTimeout(() => layer.pulse(null), PULSE_MS);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
            layer.pulse(null);
        };
    }, [stores, layer]);

    return (
        <TextIndexContext.Provider value={index}>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                <HighlightStyles names={highlights} showAll={showAll} />
                <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ px: 3, py: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                    <EvidenceCounter />
                    <ShowAllToggle />
                    <DiffLegend />
                </Stack>
                <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
                    <Box
                        ref={scrollerRef}
                        data-text-scroller
                        tabIndex={0}
                        onClick={onClick}
                        onKeyDown={onKeyDown}
                        sx={(theme) => ({
                            flex: 1,
                            overflow: 'auto',
                            position: 'relative',
                            px: 3,
                            '&:focus-visible': {
                                outline: '1px solid',
                                outlineColor: alpha(theme.palette.primary.main, 0.4),
                                outlineOffset: '-1px',
                            },
                            '&:focus:not(:focus-visible)': { outline: 'none' },
                        })}
                    >
                        <Box ref={rootRef} data-text-root sx={textStyles}>
                            <TextBody text={text} blocks={blocks} aside={aside} />
                        </Box>
                        <SpanHandles scrollerRef={scrollerRef} textRef={rootRef} layer={layer} />
                        <SelectionBar scrollerRef={scrollerRef} />
                    </Box>
                    <SpanTicks scrollerRef={scrollerRef} textRef={rootRef} layer={layer} />
                </Box>
                <SupportMenu {...menu} />
            </Box>
        </TextIndexContext.Provider>
    );
}
