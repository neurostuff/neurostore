import { Draggable, Droppable } from '@hello-pangea/dnd';
import {
    Box,
    Button,
    ListItem,
    ListItemText,
    Paper,
    Divider,
    Autocomplete,
    TextField,
} from '@mui/material';
import { indexToPRISMAMapping, ITag } from 'hooks/requests/useGetProjects';
import { useEffect, useMemo, useState } from 'react';
import CurationStubStudyDraggableContainer, {
    ICurationStubStudy,
} from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import CurationColumnStyles from './CurationColumn.styles';
import CurationDialog from 'components/Dialogs/CurationDialog/CurationDialog';
import MoveToExtractionDialog from 'components/Dialogs/MoveToExtractionDialog/MoveToExtractionDialog';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import {
    useCanMoveToExtractionPhase,
    useProjectCurationColumn,
    useProjectCurationExclusionTags,
    useProjectCurationInfoTags,
    useProjectCurationPrismaConfig,
} from 'pages/Projects/ProjectPage/ProjectStore';
import React from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

export const getVisibility = (stub: ICurationStubStudy, selectedTag: ITag | undefined): boolean => {
    let isVisible = false;
    if (!selectedTag) {
        isVisible = true;
    } else if (selectedTag.isExclusionTag) {
        isVisible = selectedTag.id === stub.exclusionTag?.id;
    } else if (selectedTag.id === ENeurosynthTagIds.UNTAGGED_TAG_ID) {
        isVisible = stub.tags.length === 0 && stub?.exclusionTag === null;
    } else if (selectedTag.id === ENeurosynthTagIds.UNCATEGORIZED_ID) {
        isVisible = stub?.exclusionTag === null;
    } else {
        isVisible = stub.tags.some((tag) => tag.id === selectedTag.id);
    }
    return isVisible;
};

const FixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
        columnIndex: number;
        onSelectStub: (stubId: string) => void;
        selectedTag: ITag | undefined;
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];

    return (
        <Draggable
            draggableId={stub.id}
            index={props.index}
            isDragDisabled={!!stub?.exclusionTag}
            key={stub.id}
        >
            {(provided, snapshot) => (
                <CurationStubStudyDraggableContainer
                    {...stub}
                    provided={provided}
                    snapshot={snapshot}
                    index={props.index}
                    style={props.style}
                    isVisible={getVisibility(stub, props.data.selectedTag)}
                    onSelectStubStudy={props.data.onSelectStub}
                    columnIndex={props.data.columnIndex}
                />
            )}
        </Draggable>
    );
};

const CurationColumn: React.FC<{ columnIndex: number }> = React.memo((props) => {
    const column = useProjectCurationColumn(props.columnIndex);
    const prismaConfig = useProjectCurationPrismaConfig();
    const infoTags = useProjectCurationInfoTags();
    const exclusionTags = useProjectCurationExclusionTags();
    const canMoveToExtractionPhase = useCanMoveToExtractionPhase(props.columnIndex);

    const [selectedTag, setSelectedTag] = useState<ITag>();
    // 212 roughly represents the space taken up by other components above the column like buttons and headers
    const [windowHeight, setWindowHeight] = useState(window.innerHeight - 212 || 600);
    const [lastColExtractionDialogIsOpen, setLastColExtractionDialogIsOpen] = useState(false);
    const [tags, setTags] = useState<ITag[]>([]);
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        stubId: string | undefined;
    }>({
        isOpen: false,
        stubId: undefined,
    });

    useEffect(() => {
        const handleResize = () => {
            const currentWindowSize = window.innerHeight;
            if (currentWindowSize) {
                setWindowHeight(currentWindowSize - 212);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        // remove listeners on cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [windowHeight]);

    useEffect(() => {
        if (prismaConfig.isPrisma) {
            const phase = indexToPRISMAMapping(props.columnIndex);
            const exclusionTagsForThisColumn = phase ? prismaConfig[phase]?.exclusionTags : [];
            setTags(
                [...infoTags, ...exclusionTagsForThisColumn].sort((a, b) => {
                    if (a.isExclusionTag && b.isExclusionTag) {
                        return a.label.localeCompare(b.label);
                    } else if (!a.isExclusionTag && !b.isExclusionTag) {
                        return +a.isAssignable - +b.isAssignable;
                    } else {
                        return +b.isExclusionTag - +a.isExclusionTag;
                    }
                })
            );
        } else {
            setTags(
                [...infoTags, ...exclusionTags].sort((a, b) => {
                    if (a.isExclusionTag && b.isExclusionTag) {
                        return a.label.localeCompare(b.label);
                    } else if (!a.isExclusionTag && !b.isExclusionTag) {
                        return +a.isAssignable - +b.isAssignable;
                    } else {
                        return +b.isExclusionTag - +a.isExclusionTag;
                    }
                })
            );
        }
    }, [exclusionTags, infoTags, prismaConfig, props.columnIndex]);

    const handleSelectStub = React.useCallback((stubId: string) => {
        setDialogState({
            isOpen: true,
            stubId,
        });
    }, []);

    // This logic was previously in a useEffect hook, but was removed because it caused
    // visual flickering as the filteredStudies took noticable milliseconds to get updated
    const filteredStudies = useMemo(() => {
        console.log('re running');
        return column.stubStudies.filter((stub) => getVisibility(stub, selectedTag));
    }, [column.stubStudies, selectedTag]);

    return (
        <Box sx={CurationColumnStyles.columnContainer}>
            <CurationDialog
                selectedFilter={selectedTag?.label || ''}
                onSetSelectedStub={handleSelectStub}
                selectedStubId={dialogState.stubId}
                columnIndex={props.columnIndex}
                stubs={filteredStudies}
                isOpen={dialogState.isOpen}
                onCloseDialog={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
            />
            <Button
                variant="contained"
                disableElevation
                onClick={() => {
                    const stubId = filteredStudies.length > 0 ? filteredStudies[0].id : undefined;
                    setDialogState({ stubId: stubId, isOpen: true });
                }}
                sx={{
                    padding: '8px',
                    marginBottom: '0.75rem',
                }}
            >
                {column.name} ({filteredStudies.length} of {column.stubStudies.length})
            </Button>

            {canMoveToExtractionPhase && (
                <>
                    <MoveToExtractionDialog
                        onCloseDialog={() => setLastColExtractionDialogIsOpen(false)}
                        isOpen={lastColExtractionDialogIsOpen}
                    />
                    <Button
                        onClick={() => setLastColExtractionDialogIsOpen(true)}
                        sx={{ marginBottom: '0.75rem' }}
                        disableElevation
                        variant="contained"
                        color="success"
                    >
                        move to next phase (extraction)
                    </Button>
                </>
            )}

            <Paper elevation={0} sx={{ width: '100%' }}>
                <Autocomplete
                    noOptionsText="No tags"
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option?.id}>
                            <ListItemText
                                sx={{ color: option.isExclusionTag ? 'error.dark' : '' }}
                                primary={option?.label || ''}
                            />
                        </ListItem>
                    )}
                    value={selectedTag || null}
                    size="small"
                    groupBy={(option) => {
                        return option.isExclusionTag
                            ? 'Exclusion Tags'
                            : option.isAssignable
                            ? 'Your Tags'
                            : 'Default Tags';
                    }}
                    renderInput={(params) => <TextField {...params} label="filter" />}
                    options={tags}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    getOptionLabel={(option) => option?.label || ''}
                    onChange={(_event, newValue, _reason) => {
                        setSelectedTag(newValue || undefined);
                    }}
                />
            </Paper>

            <Divider sx={{ margin: '1rem 0' }} />

            <Droppable
                mode="virtual"
                droppableId={column.id}
                renderClone={(provided, snapshot, rubric) => (
                    <CurationStubStudyDraggableContainer
                        {...column.stubStudies[rubric.source.index]}
                        index={rubric.source.index}
                        provided={provided}
                        snapshot={snapshot}
                        style={{}}
                        isVisible={true}
                        onSelectStubStudy={handleSelectStub}
                        columnIndex={props.columnIndex}
                    />
                )}
            >
                {(provided, snapshot) => (
                    <FixedSizeList
                        height={windowHeight}
                        outerRef={provided.innerRef}
                        itemCount={filteredStudies.length}
                        width="100%"
                        itemSize={140}
                        itemKey={(index, data) => data.stubs[index]?.id}
                        layout="vertical"
                        itemData={{
                            stubs: filteredStudies,
                            columnIndex: props.columnIndex,
                            onSelectStub: handleSelectStub,
                            selectedTag: selectedTag,
                        }}
                        overscanCount={3}
                    >
                        {FixedSizeListRow}
                    </FixedSizeList>
                )}
            </Droppable>
        </Box>
    );
});

export default CurationColumn;
