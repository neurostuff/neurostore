import { Box, Button, GlobalStyles, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLayoutEffect, useRef } from 'react';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import { selectFocusedSlot, type ReviewState } from '../store/reviewStore';
import { REVIEW_HIGHLIGHTS, type HighlightNames } from './highlights';
import { layoutText, type ParsedPaperLayout } from './layout';
import { SelectionBar } from './SelectionBar';
import { SupportMenu } from './SupportMenu';
import { TextBody, type Aside } from './TextBody';
import { useSupportingFocus } from './supporting';
import { useHighlights } from './useHighlights';
import { TextIndexContext, useTextIndex } from './useTextIndex';

function scrollToRange(scroller: HTMLElement, range: Range) {
    const top = range.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += top - scroller.clientHeight / 3;
}

function selectCounter(s: ReviewState): string {
    if (s.focusedSpans.length > 0) return `evidence ${s.evidenceCursor + 1} of ${s.focusedSpans.length}`;
    return selectFocusedSlot(s)?.value?.extraction_status === 'not_reported' ? 'not reported' : 'no evidence';
}

function EvidenceCounter() {
    const counter = useReviewStore(selectCounter);
    return (
        <Typography variant="body2" color="text.secondary" data-evidence-counter>
            {counter}
        </Typography>
    );
}

function ShowAllToggle() {
    const showAll = useReviewStore((s) => s.showAllEvidence);
    const toggleAllEvidence = useReviewStore((s) => s.toggleAllEvidence);
    return (
        <Button size="small" aria-pressed={showAll} onClick={() => toggleAllEvidence()}>
            show all evidence
        </Button>
    );
}

/** What the two span sets look like while the diff is shown. */
function DiffLegend() {
    const diffOn = useReviewStore((s) => s.diffOn);
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
    '& .rv-marker': { color: 'text.disabled', fontSize: '0.6em' },
    '& .rv-trail': { whiteSpace: 'normal' },
    '& .rv-table': { borderCollapse: 'collapse', fontSize: '0.875rem', my: 2 },
    '& .rv-table td': { border: 1, borderColor: 'divider', px: 1, py: 0.5, verticalAlign: 'top' },
};

export function TextPane({ highlights = REVIEW_HIGHLIGHTS, aside }: { highlights?: HighlightNames; aside?: Aside }) {
    const store = useReviewStoreApi();
    const text = useReviewStore((s) => s.bundle.text);
    const parsedPaper = useReviewStore((s) => s.bundle.parsed_paper as ParsedPaperLayout);
    const blocks = layoutText(text, parsedPaper);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const index = useTextIndex(rootRef);
    const layer = useHighlights(index, highlights);
    const showAll = useReviewStore((s) => s.showAllEvidence);
    const { onClick, onKeyDown, menu } = useSupportingFocus(index, layer);

    useLayoutEffect(() => {
        if (!layer) return;
        return store.subscribe(({ reveal }, prev) => {
            if (reveal && reveal.seq !== prev.reveal?.seq)
                scrollToRange(scrollerRef.current!, layer.range(reveal.span));
        });
    }, [store, layer]);

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
                <Box
                    ref={scrollerRef}
                    data-text-scroller
                    tabIndex={0}
                    onClick={onClick}
                    onKeyDown={onKeyDown}
                    sx={{ flex: 1, overflow: 'auto', position: 'relative', px: 3 }}
                >
                    <Box ref={rootRef} data-text-root sx={textStyles}>
                        <TextBody text={text} blocks={blocks} aside={aside} />
                    </Box>
                    <SelectionBar scrollerRef={scrollerRef} />
                </Box>
                <SupportMenu {...menu} />
            </Box>
        </TextIndexContext.Provider>
    );
}
