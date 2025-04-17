import { Box, Typography } from '@mui/material';
import { useGetCurationSummary, useGetWindowHeight } from 'hooks';
import React, { useCallback, useEffect, useRef } from 'react';
import { FixedSizeList } from 'react-window';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import CurationStubListItemVirtualizedContainer from './CurationStubListItemVirtualizedContainer';

const CurationBoardAIInterfaceCuratorFocus: React.FC<ICurationBoardAIInterfaceCurator> = ({
    selectedStub,
    table,
    onSetSelectedStub,
    columnIndex,
}) => {
    const rows = table.getRowModel().rows.map((row) => row.original);
    const windowHeight = useGetWindowHeight();
    const scrollableBoxRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<FixedSizeList>(null);
    const { included } = useGetCurationSummary();

    const handleMoveToNextStub = useCallback(() => {
        if (!selectedStub?.id) return;
        const stubIndex = rows.findIndex((row) => row.id === selectedStub.id);
        if (stubIndex < 0) return;

        const nextStubId = rows[stubIndex + 1]?.id;

        if (!nextStubId) return;
        onSetSelectedStub(nextStubId);
    }, [onSetSelectedStub, rows, selectedStub?.id]);

    const pxInVh = Math.round(windowHeight - 280);

    // cant use useRef as the listRef does not exist due to it being rendered
    // later as a dialog. useEffect also does not keep track of useRef value changes
    // https://stackoverflow.com/questions/60476155/is-it-safe-to-use-ref-current-as-useeffects-dependency-when-ref-points-to-a-dom
    // const handleScrollTo = React.useCallback(
    //     (listRef: FixedSizeList) => {
    //         if (listRef) {
    //             const selectedItemIndex = (stubs || []).findIndex((x) => x.id === selectedStub?.id);
    //             listRef.scrollToItem(selectedItemIndex, 'smart');
    //         }
    //     },
    //     [stubs, selectedStub?.id]
    // );

    useEffect(() => {
        if (!listRef.current) return;
        const selectedItemIndex = (rows || []).findIndex((row) => row.id === selectedStub?.id);
        listRef.current.scrollToItem(selectedItemIndex, 'smart');
    }, [selectedStub?.id, rows, pxInVh]);

    useEffect(() => {
        if (scrollableBoxRef.current) {
            scrollableBoxRef.current.scrollTo(0, 0);
        }
    }, [selectedStub?.id]);

    return (
        <Box sx={{ display: 'flex', padding: '0 1rem 1rem 1rem', height: 'calc(100% - 48px - 8px - 20px)' }}>
            {rows.length === 0 && (
                <Typography color={included > 0 ? 'success.main' : 'warning.dark'}>
                    {included > 0
                        ? "You're done! Go to extraction to continue"
                        : 'No studies. To import studies, click the import button above.'}
                </Typography>
            )}
            {rows.length > 0 && (
                <>
                    <Box>
                        <FixedSizeList
                            height={pxInVh}
                            itemCount={rows.length || 0}
                            width={260}
                            itemSize={90}
                            itemKey={(index, data) => data.stubs[index]?.id}
                            itemData={{
                                stubs: rows,
                                selectedStubId: selectedStub?.id,
                                onSetSelectedStub: onSetSelectedStub,
                            }}
                            layout="vertical"
                            overscanCount={5}
                            ref={listRef}
                        >
                            {CurationStubListItemVirtualizedContainer}
                        </FixedSizeList>
                    </Box>
                    <Box ref={scrollableBoxRef} sx={{ overflowY: 'auto', width: '100%' }}>
                        <CurationEditableStubSummary
                            onMoveToNextStub={handleMoveToNextStub}
                            columnIndex={columnIndex}
                            stub={selectedStub}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorFocus;
