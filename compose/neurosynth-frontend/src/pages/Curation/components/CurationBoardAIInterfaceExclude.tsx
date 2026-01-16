import { Box, Typography } from '@mui/material';
import { useGetWindowHeight, useMeasure, useUserCanEdit } from 'hooks';
import {
    useProjectCurationColumns,
    useProjectExclusionTag,
    useProjectUser,
    useUpdateExclusionTag,
} from 'pages/Project/store/ProjectStore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import { ICurationStubStudy } from '../Curation.types';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import CurationStubListItemVirtualizedContainer from './CurationStubListItemVirtualizedContainer';
import TextEdit from 'components/TextEdit/TextEdit';
import { ENeurosynthTagIds } from 'pages/Project/store/ProjectStore.types';

const CurationBoardAIInterfaceExclude: React.FC<{
    group: IGroupListItem;
}> = ({ group }) => {
    const windowHeight = useGetWindowHeight();
    const scrollableBoxRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<FixedSizeList>(null);
    const [selectedStubId, setSelectedStubId] = useState<string>();
    const columns = useProjectCurationColumns();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const exclusionTag = useProjectExclusionTag(group.id);
    const updateExclusionTag = useUpdateExclusionTag();

    // Check if this is a default exclusion tag
    const isDefaultExclusion = useMemo(() => {
        const defaultExclusionIds = Object.values(ENeurosynthTagIds).filter((id) => id.includes('_exclusion'));
        return defaultExclusionIds.some((defaultExclusionId) => defaultExclusionId === exclusionTag?.id);
    }, [exclusionTag]);

    const stubs = useMemo(() => {
        const allStudies = columns.reduce((acc, curr) => [...acc, ...curr.stubStudies], [] as ICurationStubStudy[]);
        return allStudies
            .filter((study) => study.exclusionTag && study.exclusionTag === exclusionTag?.id)
            .sort((a, b) => (a.title || '').toLocaleLowerCase().localeCompare((b.title || '').toLocaleLowerCase()));
    }, [columns, exclusionTag?.id]);

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

    const handleUpdateExclusionTag = useCallback(
        (newName: string) => {
            if (!exclusionTag?.id) return;
            updateExclusionTag(exclusionTag.id, newName);
        },
        [exclusionTag?.id, updateExclusionTag]
    );

    const { ref: labelContainerRef, height: labelContainerHeight } = useMeasure<HTMLDivElement>();
    const pxInVh = Math.round(windowHeight - 220 - labelContainerHeight);

    // when the group changes, automatically select the first stub
    useEffect(() => {
        if (stubs.length > 0) {
            setSelectedStubId(stubs[0]?.id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.id]);

    // scroll to the selected stub when a stub is selected and the view changes to focus mode
    useEffect(() => {
        if (!listRef.current) return;
        const selectedItemIndex = (stubs || []).findIndex((x) => x.id === selectedStubId);
        listRef.current.scrollToItem(selectedItemIndex, 'smart');
    }, [selectedStubId, stubs]);

    // reset scroll position of details page when the selected stub changes
    useEffect(() => {
        if (scrollableBoxRef.current) {
            scrollableBoxRef.current.scrollTo(0, 0);
        }
    }, [selectedStub?.id]);

    return (
        <Box sx={{ padding: '1rem' }}>
            <Box mb={2} ref={labelContainerRef}>
                <TextEdit
                    textFieldSx={{ input: { fontSize: '1.25rem' } }}
                    onSave={(updatedText) => handleUpdateExclusionTag(updatedText)}
                    label="Group Label"
                    textToEdit={exclusionTag?.label || ''}
                    editIconIsVisible={canEdit && !isDefaultExclusion}
                >
                    <Typography variant="h4" sx={{ color: 'error.dark' }}>
                        {exclusionTag?.label || ''}
                    </Typography>
                </TextEdit>
                <Typography variant="body2" color="text.secondary">
                    These studies have been excluded due to the following reason: {group?.label || ''}
                </Typography>
            </Box>
            {stubs.length === 0 ? (
                <Box sx={{ display: 'flex' }}>
                    <Typography color="warning.dark">No studies have been marked as {group?.label || ''}.</Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex' }}>
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
                    <Box ref={scrollableBoxRef} sx={{ overflowY: 'auto', width: '100%', height: `${pxInVh}px` }}>
                        <CurationEditableStubSummary
                            onMoveToNextStub={handleMoveToNextStub}
                            columnIndex={selectedColumnIndex || 0}
                            stub={selectedStub}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default CurationBoardAIInterfaceExclude;
