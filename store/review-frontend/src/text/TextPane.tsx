import { Box, GlobalStyles, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLayoutEffect, useRef } from 'react';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import { selectFocusedSlot, type ReviewState } from '../store/reviewStore';
import { REVIEW_HIGHLIGHTS, type HighlightNames } from './highlights';
import { layoutText, type ParsedPaperLayout } from './layout';
import { SelectionBar } from './SelectionBar';
import { TextBody, type Aside } from './TextBody';
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

function HighlightStyles({ names }: { names: HighlightNames }) {
    return (
        <GlobalStyles
            styles={(theme) => ({
                [`::highlight(${names.focus})`]: {
                    backgroundColor: alpha(theme.palette.primary.main, 0.3),
                },
                [`::highlight(${names.evidence})`]: {
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
                <HighlightStyles names={highlights} />
                <Box sx={{ px: 3, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <EvidenceCounter />
                </Box>
                <Box
                    ref={scrollerRef}
                    data-text-scroller
                    sx={{ flex: 1, overflow: 'auto', position: 'relative', px: 3 }}
                >
                    <Box ref={rootRef} data-text-root sx={textStyles}>
                        <TextBody text={text} blocks={blocks} aside={aside} />
                    </Box>
                    <SelectionBar scrollerRef={scrollerRef} />
                </Box>
            </Box>
        </TextIndexContext.Provider>
    );
}
