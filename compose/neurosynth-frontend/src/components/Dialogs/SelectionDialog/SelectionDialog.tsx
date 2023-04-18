import { Box, Button, ListItem, ListItemText, Typography } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useGetAnnotationById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import BaseDialog, { IDialog } from '../BaseDialog';

const SelectionDialog: React.FC<IDialog> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { data: project } = useGetProjectById(projectId);
    const { data: annotation } = useGetAnnotationById(
        project?.provenance?.extractionMetadata?.annotationId
    );
    const { mutate } = useUpdateProject();

    const [selectedValue, setSelectedValue] = useState<
        { selectionKey: string; type: EPropertyType } | undefined
    >(
        project?.provenance?.filtrationMetadata?.filter?.filtrationKey
            ? {
                  selectionKey: project?.provenance?.filtrationMetadata?.filter?.filtrationKey,
                  type: project?.provenance?.filtrationMetadata?.filter?.type,
              }
            : undefined
    );

    const options = Object.entries(annotation?.note_keys || {})
        .map(([key, value]) => ({
            selectionKey: key,
            type: value as EPropertyType,
        }))
        .filter((x) => x.type === EPropertyType.BOOLEAN);

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
                                    filtrationKey: selectedValue.selectionKey,
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

    console.log(annotation);

    return (
        <BaseDialog
            isOpen={props.isOpen}
            maxWidth="md"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            dialogTitle={`0 / 73 analyses selected`}
        >
            <Box>
                <Typography gutterBottom>
                    Select the <b>annotation inclusion column</b> that you would like to use to
                    select the analyses for your meta-analysis.
                </Typography>
                <Typography sx={{ color: 'warning.dark', marginBottom: '1rem' }}>
                    At the moment, only boolean columns will be supported. We will be adding support
                    for the other types in the near future.
                </Typography>

                <NeurosynthAutocomplete
                    label="Inclusion Column"
                    shouldDisable={false}
                    isOptionEqualToValue={(option, value) =>
                        option?.selectionKey === value?.selectionKey
                    }
                    value={selectedValue}
                    size="medium"
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option.selectionKey}>
                            <ListItemText
                                sx={{
                                    color: NeurosynthTableStyles[option.type || EPropertyType.NONE],
                                }}
                                primary={option?.selectionKey || ''}
                            />
                        </ListItem>
                    )}
                    getOptionLabel={(option) => option?.selectionKey || ''}
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

export default SelectionDialog;
