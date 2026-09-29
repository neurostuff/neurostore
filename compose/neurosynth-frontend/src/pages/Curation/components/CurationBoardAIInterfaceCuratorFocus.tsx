import { Box } from '@mui/material';
import VirtualizedList from 'components/VirtualizedList/VirtualizedList';
import { useGetWindowHeight } from 'hooks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableHints from './CurationBoardAIInterfaceCuratorTableHints';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import CurationStubAITableSummary from './CurationStubAITableSummary';
import CurationStubListItemVirtualizedContainer from './CurationStubListItemVirtualizedContainer';

const ROW_HEIGHT_PX = 90;
const LIST_WIDTH_PX = 260;

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

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

            // Prevent stub selection when arrow keys are being used in inputs and popups (menus, autocomplete, dialogs)
            // so they can move a cursor or highlight an option.
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                target.closest(
                    'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="combobox"], [role="dialog"]'
                )
            ) {
                return;
            }

            event.preventDefault();
            selectStubByOffset(event.key === 'ArrowDown' ? 1 : -1);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectStubByOffset]);

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
