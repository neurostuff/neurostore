import { Box, Typography } from '@mui/material';
import { useGetWindowHeight } from 'hooks';
import { useProjectCurationColumns } from 'pages/Project/store/ProjectStore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import { ICurationStubStudy } from '../Curation.types';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import CurationStubListItemVirtualizedContainer from './CurationStubListItemVirtualizedContainer';

const CurationBoardAIInterfaceExclude: React.FC<{
    group: IGroupListItem;
}> = ({ group }) => {
    const windowHeight = useGetWindowHeight();
    const scrollableBoxRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<FixedSizeList>(null);
    const [selectedStubId, setSelectedStubId] = useState<string>();
    const columns = useProjectCurationColumns();

    const stubs = useMemo(() => {
        const allStudies = columns.reduce((acc, curr) => [...acc, ...curr.stubStudies], [] as ICurationStubStudy[]);
        return allStudies
            .filter((study) => study.exclusionTag && study.exclusionTag.id === group.id)
            .sort((a, b) => (a.title || '').toLocaleLowerCase().localeCompare((b.title || '').toLocaleLowerCase()));
    }, [columns, group.id]);

    const selectedStub: ICurationStubStudy | undefined = useMemo(
        () => (stubs || []).find((stub) => stub.id === selectedStubId),
        [selectedStubId, stubs]
    );

    const selectedColumnIndex = useMemo(() => {
        const foundColumn = columns.findIndex((col) => col.stubStudies.find((stub) => stub.id === selectedStubId));
        return foundColumn < 0 ? undefined : foundColumn;
    }, [columns, selectedStubId]);

    const handleMoveToNextStub = useCallback(() => {
        if (!selectedStub?.id) return;
        const stubIndex = stubs.findIndex((x) => x.id === selectedStub.id);
        if (stubIndex < 0) return;

        const nextStub = stubs[stubIndex + 1];
        if (!nextStub) return;
        setSelectedStubId(nextStub.id);
    }, [selectedStub?.id, stubs]);

    const pxInVh = Math.round(windowHeight - 240);

    useEffect(() => {
        if (stubs.length > 0) {
            setSelectedStubId(stubs[0]?.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.id]);

    useEffect(() => {
        if (!listRef.current) return;
        const selectedItemIndex = (stubs || []).findIndex((x) => x.id === selectedStubId);
        listRef.current.scrollToItem(selectedItemIndex, 'smart');
    }, [selectedStubId, stubs]);

    useEffect(() => {
        if (scrollableBoxRef.current) {
            scrollableBoxRef.current.scrollTo(0, 0);
        }
    }, [selectedStub?.id]);

    return (
        <Box sx={{ display: 'flex', padding: '1rem', height: 'calc(100% - 48px - 8px - 20px)' }}>
            {stubs.length === 0 && <Typography color="warning.dark">No studies for this exclusion.</Typography>}
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
                                onSetSelectedStub: setSelectedStubId,
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
                            columnIndex={selectedColumnIndex || 0}
                            stub={selectedStub}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceExclude;
