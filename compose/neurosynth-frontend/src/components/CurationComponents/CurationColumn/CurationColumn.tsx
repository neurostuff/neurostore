import { Droppable } from '@hello-pangea/dnd';
import { Box, Button, ListItem, ListItemText, Paper, Divider, Typography } from '@mui/material';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
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

const CurationColumn: React.FC<ICurationColumn> = (props) => {
    const [selectedTag, setSelectedTag] = useState<ITag>();
    const { projectId }: { projectId: string } = useParams();
    const { data } = useGetProjectById(projectId);
    const [categorizeDialogIsOpen, setCategorizeDialogIsOpen] = useState(false);

    const tags = data?.provenance?.curationMetadata?.tags || [];

    return (
        <Box sx={CurationColumnStyles.columnContainer}>
            <Button
                variant="text"
                onClick={() => setCategorizeDialogIsOpen(true)}
                sx={{ padding: '8px', color: 'rgb(94, 108, 132)', marginBottom: '0.75rem' }}
            >
                {props.name} ({props.stubStudies.length})
            </Button>

            <Paper elevation={0} sx={{ width: '100%' }}>
                <NeurosynthAutocomplete
                    noOptionsText="No tags"
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option?.id}>
                            <ListItemText
                                sx={{ color: option.isExclusion ? 'error.dark' : '' }}
                                primary={option?.label || ''}
                            />
                        </ListItem>
                    )}
                    value={selectedTag}
                    label="filter"
                    size="small"
                    options={[
                        ...tags,
                        { label: 'untagged', id: 'neurosynth_untagged_id', isExclusionTag: false },
                    ]}
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
                        sx={CurationColumnStyles.droppableContainer}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {props.stubStudies.length === 0 && (
                            <Typography sx={{ marginBottom: '0.5rem' }} color="warning.dark">
                                No studies
                            </Typography>
                        )}
                        {props?.stubStudies?.map((stubStudy, index) => (
                            <CurationStubStudy
                                key={stubStudy.id}
                                isVisible={true}
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
