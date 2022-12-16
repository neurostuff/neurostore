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

export interface ICurationColumn {
    name: string;
    id: string;
    stubStudies: ICurationStubStudy[];
}

const CurationColumn: React.FC<ICurationColumn & { columnIndex: number }> = (props) => {
    const [selectedTag, setSelectedTag] = useState<ITag>();
    const { projectId }: { projectId: string } = useParams();
    const { data } = useGetProjectById(projectId);
    const [categorizeDialogIsOpen, setCategorizeDialogIsOpen] = useState(false);

    // It is expected to return a negative value if the first argument is less than the second argument
    // zero if they're equal
    // and a positive value otherwise.
    const tags = (data?.provenance?.curationMetadata?.tags || []).sort(
        (a, b) => +b.isExclusionTag - +a.isExclusionTag
    );

    const handleSelectStubStudy = () => {};

    return (
        <Box sx={CurationColumnStyles.columnContainer}>
            <Button
                variant="contained"
                disableElevation
                onClick={() => setCategorizeDialogIsOpen(true)}
                sx={{
                    padding: '8px',
                    marginBottom: '0.75rem',
                }}
            >
                {props.name} ({props.stubStudies.length})
            </Button>

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
                        {props?.stubStudies?.map((stubStudy, index) => (
                            <CurationStubStudy
                                key={stubStudy.id}
                                columnIndex={props.columnIndex}
                                onSelectStubStudy={handleSelectStubStudy}
                                isVisible={
                                    !selectedTag ||
                                    stubStudy.tags.some((tag) => tag.id === selectedTag?.id) ||
                                    selectedTag.id === stubStudy.exclusionTag?.id
                                }
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
