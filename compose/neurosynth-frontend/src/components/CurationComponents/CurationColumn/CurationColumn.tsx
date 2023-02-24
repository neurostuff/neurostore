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
import CurationStubStudy, {
    ICurationStubStudy,
} from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import CurationColumnStyles from './CurationColumn.styles';
import CurationDialog from 'components/Dialogs/CurationDialog/CurationDialog';
import MoveToExtractionDialog from 'components/Dialogs/MoveToExtractionDialog/MoveToExtractionDialog';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import {
    useProjectCurationColumns,
    useProjectCurationExclusionTags,
    useProjectCurationInfoTags,
    useProjectCurationPrismaConfig,
} from 'pages/Projects/ProjectPage/ProjectStore';

export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

const getVisibility = (stub: ICurationStubStudy, selectedTag: ITag | undefined): boolean => {
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

const CurationColumn: React.FC<ICurationColumn & { columnIndex: number }> = (props) => {
    const [selectedTag, setSelectedTag] = useState<ITag>();
    const curationSummary = useGetCurationSummary();
    const [lastColExtractionDialogIsOpen, setLastColExtractionDialogIsOpen] = useState(false);
    const [filteredStudies, setFilteredStudies] = useState<ICurationStubStudy[]>(props.stubStudies);
    const [tags, setTags] = useState<ITag[]>([]);
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        stubId: string | undefined;
        stubIndex: number;
    }>({
        isOpen: false,
        stubId: undefined,
        stubIndex: 0,
    });

    const prismaConfig = useProjectCurationPrismaConfig();
    const infoTags = useProjectCurationInfoTags();
    const exclusionTags = useProjectCurationExclusionTags();

    const curationColumns = useProjectCurationColumns();
    const canMoveToExtractionPhase =
        curationColumns.length === props.columnIndex + 1 && // we are at the last column
        props.stubStudies.length > 0 && // there are stubs within this column
        curationSummary.uncategorized === 0; // there are no uncategorized studies in this project

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
        setFilteredStudies(props.stubStudies.filter((stub) => getVisibility(stub, selectedTag)));
    }, [props.stubStudies, selectedTag]);

    const handleSelectStub = (stubId: string) => {
        const foundIndex = filteredStudies.findIndex((stub) => stub.id === stubId);
        if (foundIndex < 0) return;

        setDialogState({
            isOpen: true,
            stubId,
            stubIndex: foundIndex,
        });
    };

    return (
        <Box sx={CurationColumnStyles.columnContainer}>
            <CurationDialog
                selectedFilter={selectedTag?.label || ''}
                onSetSelectedStub={handleSelectStub}
                selectedStubId={dialogState.stubId}
                selectedStubIndex={dialogState.stubIndex}
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
                    setDialogState({ stubId: stubId, isOpen: true, stubIndex: 0 });
                }}
                sx={{
                    padding: '8px',
                    marginBottom: '0.75rem',
                }}
            >
                {props.name} ({filteredStudies.length} of {props.stubStudies.length})
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

            <Droppable droppableId={props.id}>
                {(provided) => (
                    <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{ overflowY: 'auto', flexGrow: 1, overflowX: 'hidden' }}
                    >
                        {props.stubStudies.length === 0 && (
                            <Typography sx={{ marginBottom: '0.5rem' }} color="warning.dark">
                                No studies
                            </Typography>
                        )}
                        {props.stubStudies.map((stubStudy, index) => (
                            <CurationStubStudy
                                key={stubStudy.id}
                                columnIndex={props.columnIndex}
                                onSelectStubStudy={handleSelectStub}
                                isVisible={getVisibility(stubStudy, selectedTag)}
                                index={index}
                                {...stubStudy}
                            />
                        ))}
                        {provided.placeholder}
                    </Box>
                )}
            </Droppable>
        </Box>
    );
};

export default CurationColumn;
