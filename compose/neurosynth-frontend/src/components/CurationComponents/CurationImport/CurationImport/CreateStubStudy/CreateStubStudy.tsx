import { Box, Chip, TextField } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import { ISource, ITag } from 'hooks/requests/useGetProjects';
import { ChangeEvent, useState } from 'react';
import CreateStubStudyStyles from './CreateStubStudy.styles';
import { v4 as uuidv4 } from 'uuid';

const CreateStubStudy: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[]) => void;
}> = (props) => {
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

    const handleButtonClick = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onNavigate(button);
        } else {
            if (!form.identificationSource) return;
            props.onImportStubs([
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
        }
    };

    const disableCreateButton =
        form.name.length === 0 || form.doi.length === 0 || !form.identificationSource;

    return (
        <Box sx={{ padding: '10px 0', margin: '2rem 0' }}>
            <TextField
                onChange={handleUpdateForm}
                required
                value={form.name}
                helperText={
                    formFieldTouched.name && form.name.length === 0
                        ? 'study name cannot be empty'
                        : ''
                }
                error={formFieldTouched.name && form.name.length === 0}
                sx={CreateStubStudyStyles.textInput}
                name="name"
                label="Study Name"
                placeholder="My study name"
            />
            <TextField
                value={form.authors}
                onChange={handleUpdateForm}
                sx={CreateStubStudyStyles.textInput}
                label="Authors"
                name="authors"
                placeholder="John Smith, Jane Doe, et al"
            />
            <Box sx={{ display: 'flex', paddingBottom: '1rem' }}>
                <TextField
                    value={form.doi}
                    onChange={handleUpdateForm}
                    helperText={
                        formFieldTouched.doi && form.doi.length === 0 ? 'doi cannot be empty' : ''
                    }
                    error={formFieldTouched.doi && form.doi.length === 0}
                    name="doi"
                    label="DOI"
                    required
                    placeholder="10.1016/S0896-6273(00)80715-1"
                    sx={{ display: 'flex', flex: '1 1 300px', marginRight: '15px' }}
                />
                <TextField
                    onChange={handleUpdateForm}
                    sx={{ display: 'flex', flex: '1 1 200px', marginRight: '15px' }}
                    label="PMID"
                    value={form.pmid}
                    name="pmid"
                    fullWidth
                    placeholder="2393823"
                />
                <TextField
                    sx={{ display: 'flex', flex: '1 1 150px' }}
                    onChange={handleUpdateForm}
                    value={form.articleYear}
                    label="Article Year"
                    name="articleYear"
                    type="number"
                    fullWidth
                    placeholder="2012"
                />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ width: '50%', marginRight: '7.5px' }}>
                    <TextField
                        onChange={handleUpdateForm}
                        sx={CreateStubStudyStyles.textInput}
                        name="journal"
                        value={form.journal}
                        label="Journal"
                        placeholder="Neuron"
                    />
                </Box>
                <Box sx={{ width: '50%', marginLeft: '7.5px' }}>
                    <IdentificationSourcePopup
                        required
                        initialValue={form.identificationSource || undefined}
                        onAddSource={handleAddSource}
                        onCreateSource={handleAddSource}
                        sx={{ width: '100%' }}
                        label="select study data source"
                    />
                </Box>
            </Box>

            <TextField
                onChange={handleUpdateForm}
                sx={CreateStubStudyStyles.textInput}
                name="keywords"
                value={form.keywords}
                label="Keywords"
                placeholder="cognition, behavior, intelligence"
            />
            <TextField
                onChange={handleUpdateForm}
                sx={CreateStubStudyStyles.textInput}
                label="Abstract Text"
                multiline
                rows={3}
                value={form.abstract}
                name="abstract"
                placeholder="Lorem Ipsum..."
            />

            <Box sx={{ marginBottom: '0.5rem' }}>
                <TagSelectorPopup
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
            <Box sx={{ margin: '2rem 0' }}>
                <NavigationButtons
                    onButtonClick={handleButtonClick}
                    nextButtonDisabled={disableCreateButton}
                />
            </Box>
        </Box>
    );
};

export default CreateStubStudy;
