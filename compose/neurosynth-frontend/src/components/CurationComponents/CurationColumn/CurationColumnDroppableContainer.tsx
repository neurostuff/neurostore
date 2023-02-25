import { Droppable } from '@hello-pangea/dnd';
import {
    Box,
    Button,
    ListItem,
    ListItemText,
    Paper,
    Divider,
    Typography,
    Autocomplete,
    TextField,
} from '@mui/material';
import { indexToPRISMAMapping, ITag } from 'hooks/requests/useGetProjects';
import { useEffect, useState } from 'react';
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
import CurationColumn from './CurationColumn';

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

const CurationColumnDroppableContainer: React.FC<{ columnIndex: number }> = React.memo((props) => {
    const curationColumn = useProjectCurationColumn(props.columnIndex);
    const prismaConfig = useProjectCurationPrismaConfig();
    const infoTags = useProjectCurationInfoTags();
    const exclusionTags = useProjectCurationExclusionTags();
    // const canMoveToExtractionPhase = useCanMoveToExtractionPhase(props.columnIndex);

    const [selectedTag, setSelectedTag] = useState<ITag>();
    const [lastColExtractionDialogIsOpen, setLastColExtractionDialogIsOpen] = useState(false);
    const [filteredStudies, setFilteredStudies] = useState<ICurationStubStudy[]>(
        curationColumn.stubStudies
    );
    const [tags, setTags] = useState<ITag[]>([]);
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        stubId: string | undefined;
    }>({
        isOpen: false,
        stubId: undefined,
    });

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

    useEffect(() => {
        setFilteredStudies(
            curationColumn.stubStudies.filter((stub) => getVisibility(stub, selectedTag))
        );
    }, [curationColumn.stubStudies, selectedTag]);

    const handleSelectStub = React.useCallback((stubId: string) => {
        setDialogState({
            isOpen: true,
            stubId,
        });
    }, []);

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
                {curationColumn.name} ({filteredStudies.length} of{' '}
                {curationColumn.stubStudies.length})
            </Button>

            {false && (
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

            <Droppable droppableId={curationColumn.id}>
                {(provided) => (
                    <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{ overflowY: 'auto', flexGrow: 1, overflowX: 'hidden' }}
                    >
                        {curationColumn.stubStudies.length === 0 && (
                            <Typography sx={{ marginBottom: '0.5rem' }} color="warning.dark">
                                No studies
                            </Typography>
                        )}

                        <CurationColumn
                            stubs={curationColumn.stubStudies}
                            columnIndex={props.columnIndex}
                            selectedTag={selectedTag}
                            handleSelectStub={handleSelectStub}
                        />
                        {provided.placeholder}
                    </Box>
                )}
            </Droppable>
        </Box>
    );
});

export default CurationColumnDroppableContainer;
