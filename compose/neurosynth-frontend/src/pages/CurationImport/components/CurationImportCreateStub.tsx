import { Box, Button, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ISource } from 'hooks/projects/useGetProjects';
import { ChangeEvent, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CurationImportBaseStyles from './CurationImport.styles';
import CreateStubStudyStyles from './CurationImportCreateStub.styles';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import CurationPopupIdentificationSourceSelector from 'pages/Curation/components/CurationPopupIdentificationSourceSelector';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';

const CurationImportCreateStub: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
}> = (props) => {
    const [formFieldTouched, setFormFieldTouched] = useState({
        name: false,
        doi: false,
        pmid: false,
    });
    const [doiRequired, setDoiRequired] = useState(true);
    const [pmidRequired, setPmidRequired] = useState(true);
    const [noIdentifiersDialogOpen, setNoIdentifiersDialogOpen] = useState(false);

    const [form, setForm] = useState<{
        name: string;
        authors: string;
        pmid: string;
        pmcid: string;
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
        pmcid: '',
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

    const doiMissing = doiRequired && form.doi.trim().length === 0;
    const pmidMissing = pmidRequired && form.pmid.trim().length === 0;
    const showDoiError = doiMissing && (formFieldTouched.doi || form.name.length > 0);
    const showPmidError = pmidMissing && (formFieldTouched.pmid || form.name.length > 0);

    const createStubAndNavigate = () => {
        if (!form.identificationSource) return;
        props.onImportStubs([
            {
                id: uuidv4(),
                title: form.name,
                authors: form.authors,
                keywords: form.keywords,
                pmid: form.pmid,
                pmcid: form.pmcid,
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
        props.onNavigate(ENavigationButton.NEXT);
    };

    const handleButtonClick = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onNavigate(button);
        } else {
            if (!doiRequired && !pmidRequired) {
                setNoIdentifiersDialogOpen(true);
                return;
            }
            createStubAndNavigate();
        }
    };

    const disableCreateButton = form.name.length === 0 || !form.identificationSource || doiMissing || pmidMissing;

    return (
        <Box sx={{ padding: '10px 0', margin: '2rem 0 6rem 0' }}>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', lg: '2fr 2fr 1fr' },
                    gap: '20px',
                    paddingBottom: '1rem',
                    alignItems: 'flex-start',
                }}
            >
                <Box sx={{ display: 'flex', whiteSpace: 'nowrap' }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!doiRequired}
                                onChange={(event) => {
                                    setForm((prev) => ({
                                        ...prev,
                                        doi: '',
                                    }));
                                    setDoiRequired(!event.target.checked);
                                }}
                            />
                        }
                        label="No DOI"
                    />
                    <TextField
                        value={form.doi}
                        onChange={handleUpdateForm}
                        required={doiRequired}
                        helperText={showDoiError ? 'DOI is required unless "No DOI" is checked.' : ''}
                        error={showDoiError}
                        name="doi"
                        label="DOI"
                        disabled={!doiRequired}
                        placeholder="10.1016/S0896-6273(00)80715-1"
                        fullWidth
                    />
                </Box>
                <Box sx={{ display: 'flex', whiteSpace: 'nowrap' }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!pmidRequired}
                                onChange={(event) => {
                                    setForm((prev) => ({
                                        ...prev,
                                        pmid: '',
                                    }));
                                    setPmidRequired(!event.target.checked);
                                }}
                            />
                        }
                        label="No PMID"
                    />
                    <TextField
                        onChange={handleUpdateForm}
                        required={pmidRequired}
                        helperText={showPmidError ? 'PMID is required unless "No PMID" is checked.' : ''}
                        error={showPmidError}
                        label="PubMed ID"
                        value={form.pmid}
                        name="pmid"
                        disabled={!pmidRequired}
                        fullWidth
                        placeholder="21706013"
                    />
                </Box>
                <TextField
                    onChange={handleUpdateForm}
                    label="PubMed Central ID"
                    value={form.pmcid}
                    name="pmcid"
                    fullWidth
                    placeholder="PMC3146590"
                />
            </Box>
            <ConfirmationDialog
                dialogTitle="No identifiers provided"
                dialogMessage="You've marked both DOI and PMID as missing. This study will be added without any identifiers. Are you sure you want to continue?"
                confirmText="Continue"
                rejectText="Cancel"
                isOpen={noIdentifiersDialogOpen}
                onCloseDialog={(ok) => {
                    setNoIdentifiersDialogOpen(false);
                    if (ok) {
                        createStubAndNavigate();
                    }
                }}
            />
            <Box sx={{ display: 'flex', gap: '15px' }}>
                <TextField
                    sx={{ width: '200px' }}
                    onWheel={(event) => {
                        event.preventDefault();
                    }}
                    onChange={handleUpdateForm}
                    value={form.articleYear}
                    label="Article Year"
                    name="articleYear"
                    type="number"
                    fullWidth
                    placeholder="2012"
                />
                <TextField
                    onChange={handleUpdateForm}
                    required
                    value={form.name}
                    helperText={formFieldTouched.name && form.name.length === 0 ? 'study name cannot be empty' : ''}
                    error={formFieldTouched.name && form.name.length === 0}
                    sx={CreateStubStudyStyles.textInput}
                    name="name"
                    label="Study Name"
                    placeholder="My study name"
                />
            </Box>
            <TextField
                value={form.authors}
                onChange={handleUpdateForm}
                sx={CreateStubStudyStyles.textInput}
                label="Authors"
                name="authors"
                placeholder="John Smith, Jane Doe, et al"
            />
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
                    <CurationPopupIdentificationSourceSelector
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
                    <Button variant="outlined" onClick={() => handleButtonClick(ENavigationButton.PREV)}>
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

export default CurationImportCreateStub;
