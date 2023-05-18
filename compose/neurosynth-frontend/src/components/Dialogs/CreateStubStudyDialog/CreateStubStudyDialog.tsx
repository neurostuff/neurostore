import { TextField, Box, Button, Chip } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import CreateStubStudyDialogStyles from 'components/Dialogs/CreateStubStudyDialog/CreateStubStudyDialog.styles';
import { ISource, ITag } from 'hooks/requests/useGetProjects';
import { useAddNewCurationStubs } from 'pages/Projects/ProjectPage/ProjectStore';
import React, { ChangeEvent, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const CreateStubStudyDialog: React.FC<IDialog> = (props) => {
    const addNewStubs = useAddNewCurationStubs();

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
        identificationSource: ISource | null;
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
        identificationSource: null,
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

    const handleAddSource = (source: ISource) => {
        setForm((prev) => ({
            ...prev,
            identificationSource: source,
        }));
    };

    const handleDeleteTag = (tag: ITag) => {
        setForm((prev) => ({
            ...prev,
            tags: [...prev.tags.filter((formTag) => formTag.id !== tag.id)],
        }));
    };

    const handleCreateStudy = () => {
        if (!form.identificationSource) return;

        addNewStubs([
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
                exclusionTag: null,
                tags: [...form.tags],
                identificationSource: form.identificationSource as ISource,
            },
        ]);

        handleCloseDialog();
    };

    const handleCloseDialog = () => {
        setForm({
            name: '',
            authors: '',
            pmid: '',
            keywords: '',
            articleYear: '',
            doi: '',
            journal: '',
            abstract: '',
            tags: [],
            identificationSource: null,
        });
        setFormFieldTouched({
            name: false,
            doi: false,
        });
        props.onCloseDialog();
    };

    const disableCreateButton =
        form.name.length === 0 || form.pmid.length === 0 || !form.identificationSource;

    return (
        <BaseDialog
            fullWidth
            maxWidth="sm"
            onCloseDialog={handleCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Create new study"
        >
            <Box sx={{ padding: '10px 0' }}>
                <TextField
                    size="small"
                    onChange={handleUpdateForm}
                    required
                    value={form.name}
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
                    size="small"
                    value={form.authors}
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Authors"
                    name="authors"
                    placeholder="John Smith, Jane Doe, et al"
                />
                <Box sx={[{ display: 'flex' }, CreateStubStudyDialogStyles.textInput]}>
                    <TextField
                        size="small"
                        onChange={handleUpdateForm}
                        sx={[{ marginRight: '0.5rem' }]}
                        label="PMID"
                        value={form.pmid}
                        name="pmid"
                        required
                        fullWidth
                        placeholder="2393823"
                    />
                    <TextField
                        size="small"
                        onChange={handleUpdateForm}
                        sx={[{ marginLeft: '0.5rem' }]}
                        value={form.articleYear}
                        label="Article Year"
                        name="articleYear"
                        type="number"
                        fullWidth
                        placeholder="2012"
                    />
                </Box>
                <TextField
                    size="small"
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    name="journal"
                    value={form.journal}
                    label="Journal"
                    placeholder="Neuron"
                />
                <TextField
                    size="small"
                    value={form.doi}
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
                    size="small"
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    name="keywords"
                    value={form.keywords}
                    label="Keywords"
                    placeholder="cognition, behavior, intelligence"
                />
                <Box sx={{ marginBottom: '1rem' }}>
                    <IdentificationSourcePopup
                        required
                        size="small"
                        initialValue={form.identificationSource || undefined}
                        onAddSource={handleAddSource}
                        onCreateSource={handleAddSource}
                        sx={{ width: '100%' }}
                        label="select study source"
                    />
                </Box>
                <TextField
                    size="small"
                    onChange={handleUpdateForm}
                    sx={CreateStubStudyDialogStyles.textInput}
                    label="Abstract Text"
                    multiline
                    rows={3}
                    value={form.abstract}
                    name="abstract"
                    placeholder="Lorem Ipsum..."
                />

                <Box sx={{ marginBottom: '0.5rem' }}>
                    <TagSelectorPopup
                        size="small"
                        onCreateTag={handleAddTag}
                        onAddTag={handleAddTag}
                        sx={{ width: '100%' }}
                        label="tag this study"
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
