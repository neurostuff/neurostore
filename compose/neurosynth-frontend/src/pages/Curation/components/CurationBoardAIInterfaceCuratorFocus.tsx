import { Box } from '@mui/material';
import VirtualizedList from 'components/VirtualizedList/VirtualizedList';
import { useGetWindowHeight, useKeyboardShortcuts } from 'hooks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorFocusShortcutsDialog from './CurationBoardAIInterfaceCuratorFocusShortcutsDialog';
import CurationBoardAIInterfaceCuratorTableHints from './CurationBoardAIInterfaceCuratorTableHints';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import CurationStubAITableSummary from './CurationStubAITableSummary';
import CurationStubListItemVirtualizedContainer from './CurationStubListItemVirtualizedContainer';

const ROW_HEIGHT_PX = 90;
const LIST_WIDTH_PX = 260;
const DETAIL_PANE_SCROLL_RATIO = 0.5;

const CurationBoardAIInterfaceCuratorFocus = ({
    selectedStub,
    table,
    onSetSelectedStub,
    columnIndex,
}: ICurationBoardAIInterfaceCurator) => {
    const rows = table.getRowModel().rows.map((row) => row.original);

    const windowHeight = useGetWindowHeight();
    const scrollableBoxRef = useRef<HTMLDivElement>(null);

    const selectStubByOffset = useCallback(
        (offset: number) => {
            if (!selectedStub?.id) return;
            const stubIndex = rows.findIndex((row) => row.id === selectedStub.id);
            if (stubIndex < 0) return;

            const nextStubId = rows[stubIndex + offset]?.id;
            if (!nextStubId) return;
            onSetSelectedStub(nextStubId);
        },
        [onSetSelectedStub, rows, selectedStub?.id]
    );

    const handleMoveToNextStub = useCallback(() => {
        selectStubByOffset(1);
    }, [selectStubByOffset]);

    const scrollDetailPane = useCallback((direction: 1 | -1) => {
        const detailPane = scrollableBoxRef.current;
        if (!detailPane) return;
        detailPane.scrollBy({
            top: direction * Math.round(detailPane.clientHeight * DETAIL_PANE_SCROLL_RATIO),
            behavior: 'smooth',
        });
    }, []);

    useKeyboardShortcuts({
        // ArrowDown: () => scrollDetailPane(1),
        // ArrowUp: () => scrollDetailPane(-1),
        // ArrowRight: () => selectStubByOffset(1),
        // ArrowLeft: () => selectStubByOffset(-1),
        ArrowRight: () => scrollDetailPane(1),
        ArrowLeft: () => scrollDetailPane(-1),
        ArrowDown: () => selectStubByOffset(1),
        ArrowUp: () => selectStubByOffset(-1),
    });

    const pxInVh = Math.round(windowHeight - 250);

    const selectedItemIndex = useMemo(
        () => rows.findIndex((row) => row.id === selectedStub?.id),
        [rows, selectedStub?.id]
    );

    useEffect(() => {
        if (scrollableBoxRef.current) {
            scrollableBoxRef.current.scrollTo(0, 0);
        }
    }, [selectedStub?.id]);

    return (
        <Box sx={{ display: 'flex', padding: '0 1rem 1rem 1rem', height: 'calc(100% - 48px - 8px - 20px)' }}>
            <CurationBoardAIInterfaceCuratorFocusShortcutsDialog />
            {rows.length === 0 && (
                <CurationBoardAIInterfaceCuratorTableHints
                    table={table}
                    numVisibleStudies={rows.length}
                    columnIndex={columnIndex}
                />
            )}
            {rows.length > 0 && (
                <>
                    <VirtualizedList
                        rows={rows}
                        rowHeightInPx={ROW_HEIGHT_PX}
                        listHeightInPx={pxInVh}
                        width={LIST_WIDTH_PX}
                        overscan={5}
                        scrollToIndex={selectedItemIndex >= 0 ? selectedItemIndex : undefined}
                        scrollToAlign="auto"
                        scrollBehavior="auto"
                        getItemKey={(stub) => stub.id}
                        renderRow={(stub, style) => (
                            <CurationStubListItemVirtualizedContainer
                                stub={stub}
                                selectedStubId={selectedStub?.id}
                                onSetSelectedStub={onSetSelectedStub}
                                style={style}
                            />
                        )}
                    />
                    <Box ref={scrollableBoxRef} sx={{ overflowY: 'auto', width: '100%' }}>
                        <CurationEditableStubSummary
                            onMoveToNextStub={handleMoveToNextStub}
                            columnIndex={columnIndex}
                            stub={selectedStub}
                        >
                            <Box sx={{ marginTop: '0.5rem' }}>
                                <CurationStubAITableSummary stub={selectedStub} />
                            </Box>
                        </CurationEditableStubSummary>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorFocus;
