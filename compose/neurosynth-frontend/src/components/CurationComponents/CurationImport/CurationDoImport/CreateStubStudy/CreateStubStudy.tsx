import { Box, Button, TextField } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import { ISource } from 'hooks/projects/useGetProjects';
import { ChangeEvent, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CurationImportBaseStyles from '../../CurationImportBase.styles';
import CreateStubStudyStyles from './CreateStubStudy.styles';

const CreateStubStudy: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
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
        articleLink: string;
        abstract: string;
        identificationSource: ISource | null;
    }>({
        name: '',
        authors: '',
        pmid: '',
        keywords: '',
        articleYear: '',
        doi: '',
        journal: '',
        articleLink: '',
        abstract: '',
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

    const handleAddSource = (source: ISource) => {
        setForm((prev) => ({
            ...prev,
            identificationSource: source,
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
                    pmcid: '',
                    doi: form.doi,
                    journal: form.journal,
                    articleYear: form.articleYear,
                    abstractText: form.abstract,
                    articleLink: form.articleLink,
                    exclusionTag: null,
                    tags: [],
                    identificationSource: form.identificationSource as ISource,
                },
            ]);
            props.onNavigate(button);
        }
    };

    const disableCreateButton = form.name.length === 0 || !form.identificationSource;

    return (
        <Box sx={{ padding: '10px 0', margin: '2rem 0 6rem 0' }}>
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
                    placeholder="10.1016/S0896-6273(00)80715-1"
                    sx={{ width: '35%', marginRight: '15px' }}
                />
                <TextField
                    onChange={handleUpdateForm}
                    sx={{ width: '25%', marginRight: '15px' }}
                    label="PubMed ID"
                    value={form.pmid}
                    name="pmid"
                    fullWidth
                    placeholder="21706013"
                />
                <TextField
                    onChange={handleUpdateForm}
                    sx={{ width: '25%', marginRight: '15px' }}
                    label="PubMed Central ID"
                    value={form.pmid}
                    name="pmcid"
                    fullWidth
                    placeholder="PMC3146590"
                />
                <TextField
                    onWheel={(event) => {
                        event.preventDefault();
                    }}
                    sx={{ width: '15%' }}
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
                label="article link"
                name="articleLink"
                placeholder="https://www ..."
                value={form.articleLink}
            />
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
            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button
                        variant="outlined"
                        onClick={() => handleButtonClick(ENavigationButton.PREV)}
                    >
                        back
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={disableCreateButton}
                        onClick={() => handleButtonClick(ENavigationButton.NEXT)}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CreateStubStudy;
