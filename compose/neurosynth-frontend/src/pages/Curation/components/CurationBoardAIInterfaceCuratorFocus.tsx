import { Box, Typography } from '@mui/material';
import { FixedSizeList } from 'react-window';
import { useCallback, useEffect, useRef } from 'react';
import { useGetWindowHeight } from 'hooks';
import React from 'react';
import { CurationDialogFixedSizeListRow } from './CurationDialog';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';

const CurationBoardAIInterfaceCuratorFocus: React.FC<ICurationBoardAIInterfaceCurator> = ({
    selectedStub,
    stubs,
    onSetSelectedStub,
    columnIndex,
}) => {
    const windowHeight = useGetWindowHeight();
    const scrollableBoxRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<FixedSizeList>(null);

    const handleMoveToNextStub = useCallback(() => {
        if (!selectedStub?.id) return;
        const stubIndex = stubs.findIndex((x) => x.id === selectedStub.id);
        if (stubIndex < 0) return;

        const nextStub = stubs[stubIndex + 1];
        if (!nextStub) return;
        onSetSelectedStub(nextStub.id);
    }, [onSetSelectedStub, selectedStub?.id, stubs]);

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
        const selectedItemIndex = (stubs || []).findIndex((x) => x.id === selectedStub?.id);
        listRef.current.scrollToItem(selectedItemIndex, 'smart');
    }, [selectedStub?.id, stubs, pxInVh]);

    useEffect(() => {
        if (scrollableBoxRef.current) {
            scrollableBoxRef.current.scrollTo(0, 0);
        }
    }, [selectedStub?.id]);

    return (
        <Box sx={{ display: 'flex', padding: '0 1rem 1rem 1rem', height: 'calc(100% - 48px - 8px - 20px)' }}>
            {stubs.length === 0 && (
                <Typography color="warning.dark">
                    No studies. To import studies, click the import button above.
                </Typography>
            )}
            {stubs.length > 0 && (
                <>
                    <Box>
                        <FixedSizeList
                            height={pxInVh}
                            itemCount={stubs.length || 0}
                            width={260}
                            itemSize={90}
                            itemKey={(index, data) => data.stubs[index]?.id}
                            itemData={{
                                stubs: stubs,
                                selectedStubId: selectedStub?.id,
                                onSetSelectedStub: onSetSelectedStub,
                            }}
                            layout="vertical"
                            overscanCount={5}
                            ref={listRef}
                        >
                            {CurationDialogFixedSizeListRow}
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
