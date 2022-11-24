import { TextField, Box, Button, Typography, Chip } from '@mui/material';
import TagSelectorPopup from 'components/CurationComponents/TagSelectorPopup/TagSelectorPopup';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import CreateStubStudyDialogStyles from 'components/Dialogs/CreateStubStudyDialog/CreateStubStudyDialog.styles';
import { ITag } from 'hooks/requests/useGetProjects';
import { useState } from 'react';

const CreateStubStudyDialog: React.FC<Omit<IDialog, 'dialogTitle'>> = (props) => {
    const [tags, setTags] = useState<ITag[]>([]);

    return (
        <BaseDialog
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Create new study"
        >
            <Box sx={{ padding: '10px 0' }}>
                <TextField
                    required
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Study Name"
                    placeholder="My study name"
                />
                <TextField
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Authors"
                    placeholder="John Smith, Jane Doe, et al"
                />
                <Box sx={[{ display: 'flex' }, CreateStubStudyDialogStyles.textInput]}>
                    <TextField
                        sx={[{ marginRight: '0.5rem' }]}
                        label="PMID"
                        placeholder="2393823"
                    />
                    <TextField
                        sx={[{ marginLeft: '0.5rem' }]}
                        label="Article Year"
                        placeholder="2012"
                    />
                </Box>
                <TextField
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="DOI"
                    placeholder="10.1016/S0896-6273(00)80715-1"
                />
                <TextField
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Abstract Text"
                    multiline
                    rows={4}
                    placeholder="Lorem Ipsum ..."
                />

                <Box>
                    <Typography gutterBottom>Tag this study</Typography>
                    <TagSelectorPopup
                        sx={{ width: '100%' }}
                        onCreateTag={(tagName) => {}}
                        onAddTag={(tag) => {
                            // if (props.selectedTags.findIndex((x) => x.id === tag.id) >= 0) return;
                            // const newTags = [...props.selectedTags, tag];
                            // props.onUpdateTags(newTags);
                        }}
                    />
                    <Box sx={{ margin: '1rem 0' }}>
                        {tags.map((tag) => (
                            <Chip
                                sx={{ margin: '0 3px' }}
                                onDelete={() => {
                                    // const newTags = [...props.selectedTags].filter(
                                    //     (x) => x.id !== tag.id
                                    // );
                                    // props.onUpdateTags(newTags);
                                }}
                                label={tag.label}
                                key={tag.id}
                            />
                        ))}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button color="primary" variant="contained">
                        create
                    </Button>
                    <Button onClick={props.onCloseDialog} color="error" variant="text">
                        cancel
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CreateStubStudyDialog;
