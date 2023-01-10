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
import { ITag } from 'hooks/requests/useGetProjects';
import { useState } from 'react';
import CurationStubStudy, {
    ICurationStubStudy,
} from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import CurationColumnStyles from './CurationColumn.styles';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';
import CurationDialog from 'components/Dialogs/CurationDialog/CurationDialog';
import MoveToExtractionDialog from 'components/Dialogs/MoveToExtractionDialog/MoveToExtractionDialog';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';

export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

const CurationColumn: React.FC<ICurationColumn & { columnIndex: number }> = (props) => {
    const [selectedTag, setSelectedTag] = useState<ITag>();
    const { projectId }: { projectId: string } = useParams();
    const { data } = useGetProjectById(projectId);
    const [lastColExtractionDialogIsOpen, setLastColExtractionDialogIsOpen] = useState(false);
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        stubId: string | undefined;
    }>({
        isOpen: false,
        stubId: undefined,
    });

    // It is expected to return a negative value if the first argument is less than the second argument
    // zero if they're equal
    // and a positive value otherwise.
    const tags = (data?.provenance?.curationMetadata?.tags || []).sort(
        (a, b) => +b.isExclusionTag - +a.isExclusionTag
    );

    const handleSelectStub = (stubId: string) => {
        setDialogState({
            isOpen: true,
            stubId,
        });
    };

    const getVisibility = (stub: ICurationStubStudy, selectedTag: ITag | undefined): boolean => {
        let isVisible = false;
        if (!selectedTag) {
            isVisible = true;
        } else if (selectedTag.isExclusionTag) {
            isVisible = selectedTag.id === stub.exclusionTag?.id;
        } else if (selectedTag.id === ENeurosynthTagIds.UNTAGGED_TAG_ID) {
            isVisible = stub.tags.length === 0 && stub?.exclusionTag === undefined;
        } else {
            isVisible = stub.tags.some((tag) => tag.id === selectedTag.id);
        }
        return isVisible;
    };

    const filteredStudies = props.stubStudies.filter((stub) => getVisibility(stub, selectedTag));
    const isLastColumn =
        (data?.provenance.curationMetadata?.columns || []).length <= props.columnIndex + 1;

    const hasIncludedStudies = isLastColumn && props.stubStudies.length > 0;

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
                {props.name} ({filteredStudies.length} of {props.stubStudies.length})
            </Button>

            {hasIncludedStudies && (
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
                        create studyset
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
                    groupBy={(option) =>
                        option.isExclusionTag ? 'Exclusion Tags' : 'General Tags'
                    }
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
                        sx={{ overflowY: 'auto', flexGrow: 1 }}
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
