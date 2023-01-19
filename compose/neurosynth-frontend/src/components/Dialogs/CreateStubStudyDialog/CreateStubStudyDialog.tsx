import { TextField, Box, Button, Typography, Chip } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import TagSelectorPopup from 'components/CurationComponents/TagSelectorPopup/TagSelectorPopup';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import CreateStubStudyDialogStyles from 'components/Dialogs/CreateStubStudyDialog/CreateStubStudyDialog.styles';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { ITag } from 'hooks/requests/useGetProjects';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import React, { ChangeEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const CreateStubStudyDialog: React.FC<IDialog> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const {
        data: project,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        mutate: updateProject,
        isLoading: updateProjectIsLoading,
        isError: updateProjectIsError,
    } = useUpdateProject();

    const [formFieldTouched, setFormFieldTouched] = useState({
        name: false,
        doi: false,
    });

    const [form, setForm] = useState<{
        name: string;
        authors: string;
        pmid: string;
        keywords: string;
        articleYear: string;
        doi: string;
        journal: string;
        abstract: string;
        tags: ITag[];
    }>({
        name: '',
        authors: '',
        pmid: '',
        keywords: '',
        articleYear: '',
        doi: '',
        journal: '',
        abstract: '',
        tags: [],
    });

    const handleUpdateForm = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormFieldTouched((prev) => {
            return {
                ...prev,
                [event.target.name]: true,
            };
        });
        setForm((prev) => {
            let value = event.target.value as string | number;
            if (event.target.name === 'articleYear') value = parseInt(event.target.value) || 0;

            return {
                ...prev,
                [event.target.name]: value,
            };
        });
    };

    const handleAddTag = (tag: ITag) => {
        if (form.tags.findIndex((formTag) => formTag.id === tag.id) < 0)
            setForm((prev) => ({
                ...prev,
                tags: [...prev.tags, tag],
            }));
    };

    const handleDeleteTag = (tag: ITag) => {
        setForm((prev) => ({
            ...prev,
            tags: [...prev.tags.filter((formTag) => formTag.id !== tag.id)],
        }));
    };

    const handleCreateStudy = () => {
        if (project?.provenance?.curationMetadata?.columns[0]?.stubStudies) {
            const updatedProvenance = { ...project.provenance };
            const updatedColumn = project.provenance.curationMetadata.columns[0];

            updatedColumn.stubStudies = [
                {
                    id: uuidv4(),
                    title: form.name,
                    authors: form.authors,
                    keywords: form.keywords,
                    pmid: form.pmid,
                    doi: form.doi,
                    journal: form.journal,
                    articleYear: form.articleYear,
                    abstractText: form.abstract,
                    articleLink: form.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${form.pmid}` : '',
                    exclusionTag: undefined,
                    tags: [...form.tags],
                },
                ...updatedColumn.stubStudies,
            ];

            updateProject(
                {
                    projectId: projectId,
                    project: { provenance: updatedProvenance },
                },
                {
                    onSuccess: () => {
                        props.onCloseDialog();
                    },
                }
            );
        }
    };

    const disableCreateButton = form.name.length === 0 || form.pmid.length === 0;

    return (
        <BaseDialog
            fullWidth
            maxWidth="sm"
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Create new study"
        >
            <Box sx={{ padding: '10px 0' }}>
                <TextField
                    onChange={handleUpdateForm}
                    required
                    helperText={
                        formFieldTouched.name && form.name.length === 0
                            ? 'study name cannot be empty'
                            : ''
                    }
                    error={formFieldTouched.name && form.name.length === 0}
                    sx={CreateStubStudyDialogStyles.textInput}
                    name="name"
                    label="Study Name"
                    placeholder="My study name"
                />
                <TextField
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Authors"
                    name="authors"
                    placeholder="John Smith, Jane Doe, et al"
                />
                <Box sx={[{ display: 'flex' }, CreateStubStudyDialogStyles.textInput]}>
                    <TextField
                        onChange={handleUpdateForm}
                        sx={[{ marginRight: '0.5rem' }]}
                        label="PMID"
                        name="pmid"
                        required
                        fullWidth
                        placeholder="2393823"
                    />
                    <TextField
                        onChange={handleUpdateForm}
                        sx={[{ marginLeft: '0.5rem' }]}
                        label="Article Year"
                        name="articleYear"
                        type="number"
                        fullWidth
                        placeholder="2012"
                    />
                </Box>
                <TextField
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    name="journal"
                    label="Journal"
                    placeholder="Neuron"
                />
                <TextField
                    onChange={handleUpdateForm}
                    helperText={
                        formFieldTouched.doi && form.doi.length === 0 ? 'doi cannot be empty' : ''
                    }
                    error={formFieldTouched.doi && form.doi.length === 0}
                    sx={CreateStubStudyDialogStyles.textInput}
                    name="doi"
                    label="DOI"
                    placeholder="10.1016/S0896-6273(00)80715-1"
                />
                <TextField
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    name="keywords"
                    label="Keywords"
                    placeholder="cognition, behavior, intelligence"
                />
                <TextField
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Abstract Text"
                    multiline
                    rows={3}
                    name="abstract"
                    placeholder="Lorem Ipsum..."
                />

                <Box sx={{ marginBottom: '0.5rem' }}>
                    <Typography gutterBottom>Tag this study</Typography>
                    <TagSelectorPopup
                        onCreateTag={handleAddTag}
                        onAddTag={handleAddTag}
                        isExclusion={false}
                        sx={{ width: '100%' }}
                    />
                    <Box sx={{ margin: '1rem 0' }}>
                        {form.tags.map((tag) => (
                            <Chip
                                sx={{ margin: '0 3px', marginBottom: '5px' }}
                                onDelete={() => handleDeleteTag(tag)}
                                label={tag.label}
                                key={tag.id}
                            />
                        ))}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={props.onCloseDialog} color="error" variant="text">
                        cancel
                    </Button>
                    <LoadingButton
                        sx={{ width: '85px' }}
                        isLoading={updateProjectIsLoading}
                        disabled={disableCreateButton}
                        variant="contained"
                        onClick={handleCreateStudy}
                        text="create"
                        loaderColor="secondary"
                    />
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CreateStubStudyDialog;
