import FileUploadIcon from '@mui/icons-material/FileUpload';
import { Box, Button, TextField, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import IdentificationSourcePopup from 'components/CurationComponents/SelectorPopups/SourcePopup/SourcePopup';
import { ISource } from 'hooks/projects/useGetProjects';
import { ENeurosynthSourceIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { ChangeEvent, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CurationImportBaseStyles from '../../CurationImportBase.styles';
const Cite = require('citation-js');
require('@citation-js/plugin-enw');
require('@citation-js/plugin-bibtex');
require('@citation-js/plugin-ris');

enum EValidationReason {
    EMPTY = 'Input is empty',
    INCORRECT = 'Format is incorrect or unsupported',
}

interface CSLJSONDateParts {
    'date-parts'?:
        | [string | number, number | number, string | number][]
        | [string | number, string | number][]
        | [string | number][];
}

interface CSLJSON {
    DOI?: string;
    ISSN?: string;
    PMID?: string;
    PMCID?: string;
    URL?: string;
    abstract?: string;
    accessed?: CSLJSONDateParts;
    annote?: string;
    author?: {
        given?: string;
        family?: string;
        'non-dropping-particle'?: string;
        'dropping-particle'?: string;
    }[];
    'citation-key'?: string;
    genre?: string;
    'container-title'?: string;
    id?: string;
    issue?: string;
    issued?: CSLJSONDateParts;
    language?: string;
    note?: string;
    page?: string;
    title?: string;
    'title-short'?: string;
    type?: string;
    volume?: string;
}

const ImportStandardFormat: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[]) => void;
}> = (props) => {
    const [source, setSource] = useState<ISource>();
    const [uploadState, setUploadState] = useState<{
        stubs: ICurationStubStudy[];
        rawIdText: string;
        file: File | undefined;
        isValid: boolean;
        validationReason: EValidationReason | null;
    }>({
        stubs: [],
        rawIdText: '',
        file: undefined,
        isValid: false,
        validationReason: EValidationReason.EMPTY,
    });

    useEffect(() => {
        if (uploadState.rawIdText.length === 0) {
            setUploadState((prev) => ({
                ...prev,
                isValid: false,
                validationReason: EValidationReason.EMPTY,
            }));
            return;
        }

        if (!source) return;

        try {
            const citeObj = new Cite(uploadState.rawIdText);
            citeObj.format('data', { format: 'object' });

            const formattedArticles: ICurationStubStudy[] = ((citeObj.data as CSLJSON[]) || []).map(
                (article) => ({
                    id: uuidv4(),
                    title: article.title || article['title-short'] || '',
                    authors: (article.author || []).reduce((acc, curr, index, arr) => {
                        const middleParticle =
                            curr['non-dropping-particle'] || curr['dropping-particle'] || '';
                        return `${acc}${curr.given} ${middleParticle ? middleParticle + ' ' : ''}${
                            curr.family
                        }${index < arr.length - 1 ? ', ' : ''}`;
                    }, ''),
                    keywords: '',
                    pmid: article.PMID || '',
                    doi: article.DOI || '',
                    articleYear: `${article?.issued?.['date-parts']?.[0]?.[0] || ''}`,
                    journal: article['container-title'] || '',
                    abstractText: article.abstract || article.annote || '',
                    articleLink:
                        article.URL ||
                        (article.PMID ? `https://pubmed.ncbi.nlm.nih.gov/${article.PMID}` : ''),
                    exclusionTag: null,
                    identificationSource: source,
                    tags: [],
                })
            );

            setUploadState((prev) => ({
                ...prev,
                isValid: true,
                stubs: formattedArticles,
                validationReason: null,
            }));
        } catch (e) {
            setUploadState((prev) => ({
                ...prev,
                isValid: false,
                validationReason: EValidationReason.INCORRECT,
            }));
        }
    }, [source, uploadState.rawIdText]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event?.target?.files && event.target.files[0]) {
            const file = event.target.files[0];
            setUploadState((prev) => ({
                ...prev,
                file: file,
            }));

            const reader = new FileReader();
            reader.onload = function (e) {
                const content = reader.result;

                if (content && typeof content === 'string') {
                    const replacedText = content.replace(/(?:[\r\n])+/g, '\n');
                    setUploadState((prev) => ({
                        ...prev,
                        rawIdText: replacedText,
                    }));
                }
            };
            reader.readAsText(file);
        }
    };

    const handleInputIds = (event: ChangeEvent<HTMLInputElement>) => {
        setUploadState((prev) => ({
            ...prev,
            rawIdText: event.target.value,
        }));
    };

    const handleButtonClick = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onNavigate(button);
        } else {
            props.onImportStubs(uploadState.stubs);
        }
    };

    const handleAddSource = (source: ISource) => {
        setSource(source);
    };

    return (
        <Box sx={{ width: '100%', marginBottom: '6rem' }}>
            <Box
                sx={{
                    margin: '2rem 0 1rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: 'column',
                }}
            >
                <Typography sx={{ maxWidth: '600px' }} gutterBottom>
                    Enter the source that you imported your data from. If you don't see it below,
                    start typing in the input to add it.
                </Typography>
                <IdentificationSourcePopup
                    excludeSources={[ENeurosynthSourceIds.NEUROSTORE]}
                    sx={{ width: '100%', maxWidth: '600px' }}
                    onAddSource={handleAddSource}
                    label="enter data source (i.e. PubMed, Scopus)"
                    onCreateSource={handleAddSource}
                />
            </Box>
            {source && (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <Button component="label" endIcon={<FileUploadIcon />}>
                            {uploadState.file?.name || 'Upload a valid .enw, .bib, or .ris file'}
                            <input onChange={handleFileUpload} type="file" hidden />
                        </Button>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginBottom: '0.5rem',
                        }}
                    >
                        or
                    </Box>
                    <Box>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                            }}
                        >
                            <TextField
                                value={uploadState.rawIdText}
                                onChange={handleInputIds}
                                rows={16}
                                placeholder="paste in valid endnote, bibtex, or RIS syntax"
                                multiline
                                helperText={uploadState.validationReason || ''}
                                error={!uploadState.isValid}
                                sx={{ width: '100%' }}
                            />
                        </Box>
                    </Box>
                </>
            )}
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
                        disabled={!source || uploadState.stubs.length === 0 || !uploadState.isValid}
                        onClick={() => handleButtonClick(ENavigationButton.NEXT)}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default ImportStandardFormat;
