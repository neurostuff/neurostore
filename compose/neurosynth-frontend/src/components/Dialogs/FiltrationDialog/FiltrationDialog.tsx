import { Box, Button, ListItem, ListItemText, Typography } from '@mui/material';
import { EPropertyType, getType } from 'components/EditMetadata';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useGetAnnotationById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import BaseDialog, { IDialog } from '../BaseDialog';

const FiltrationDialog: React.FC<IDialog> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { data: project } = useGetProjectById(projectId);
    const { data: annotation } = useGetAnnotationById(
        project?.provenance?.extractionMetadata?.annotationId
    );
    const { mutate } = useUpdateProject();

    const [selectedValue, setSelectedValue] = useState<
        { key: string; type: EPropertyType } | undefined
    >(
        project?.provenance?.filtrationMetadata?.filter
            ? {
                  key: project.provenance.filtrationMetadata.filter.filtrationKey,
                  type: project.provenance.filtrationMetadata.filter.type,
              }
            : undefined
    );

    const options = Object.entries(annotation?.note_keys || {}).map(([key, value]) => ({
        key: key,
        type: value as EPropertyType,
    }));

    const handleSelectFilter = () => {
        if (projectId && project?.provenance && selectedValue) {
            mutate(
                {
                    projectId: projectId,
                    project: {
                        provenance: {
                            ...project.provenance,
                            filtrationMetadata: {
                                filter: {
                                    filtrationKey: selectedValue.key,
                                    type: selectedValue.type as EPropertyType,
                                },
                            },
                        },
                    },
                },
                {
                    onSuccess: () => {
                        props.onCloseDialog();
                    },
                }
            );
        }
    };

    return (
        <BaseDialog
            isOpen={props.isOpen}
            maxWidth="md"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            dialogTitle="Select Filter"
        >
            <Box>
                <Typography gutterBottom sx={{ marginBottom: '1rem' }}>
                    Select the annotation <b>inclusion column</b> that you would like to use to
                    filter the analyses for your meta-analysis.
                </Typography>

                <NeurosynthAutocomplete
                    label="Inclusion Column"
                    shouldDisable={false}
                    isOptionEqualToValue={(option, value) => option?.key === value?.key}
                    value={selectedValue}
                    size="medium"
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option.key}>
                            <ListItemText
                                sx={{ color: NeurosynthTableStyles[getType(option.type)] }}
                                primary={option?.key || ''}
                            />
                        </ListItem>
                    )}
                    getOptionLabel={(option) => option?.key || ''}
                    onChange={(_event, newVal, _reason) => setSelectedValue(newVal || undefined)}
                    options={options}
                />

                <Button
                    onClick={handleSelectFilter}
                    sx={{ marginTop: '1rem' }}
                    disabled={selectedValue === undefined}
                    variant="contained"
                >
                    select filter
                </Button>
            </Box>
        </BaseDialog>
    );
};

export default FiltrationDialog;
