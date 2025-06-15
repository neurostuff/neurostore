import { Box, Button, TextField, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import { useState } from 'react';
import CurationImportBaseStyles from './CurationImport.styles';
import CurationImportFinalizeReview from './CurationImportFinalizeReview';
import { SearchCriteria } from 'pages/Study/Study.types';

const generateDefaultImportName = (
    importMode: EImportMode,
    stubs: ICurationStubStudy[],
    searchCriteria: SearchCriteria | undefined,
    fileName: string | undefined
) => {
    switch (importMode) {
        case EImportMode.NEUROSTORE_IMPORT: {
            let finalImportName = '';

            if (searchCriteria?.genericSearchStr) {
                finalImportName = `${searchCriteria.genericSearchStr}`;
            }

            if (searchCriteria?.nameSearch) {
                const nameStrSegment = searchCriteria.nameSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} with name "${nameStrSegment}"`
                        : `name "${nameStrSegment}"`;
            }

            if (searchCriteria?.journalSearch) {
                const journalStrSegment = searchCriteria.journalSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} in journal "${journalStrSegment}"`
                        : `journal "${journalStrSegment}"`;
            }

            if (searchCriteria?.authorSearch) {
                const authorStrSegment = searchCriteria.authorSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} by author "${authorStrSegment}"`
                        : `author "${authorStrSegment}"`;
            }

            if (searchCriteria?.descriptionSearch) {
                const descriptionStrSegment = searchCriteria.descriptionSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} with description "${descriptionStrSegment}"`
                        : `description "${descriptionStrSegment}"`;
            }

            return finalImportName;
        }
        case EImportMode.FILE_IMPORT: {
            const source = stubs[0].identificationSource; // this is safe because we know we must have at least one stub
            const finalImportName = fileName ? `${fileName} from ${source.label}` : source.label;
            return finalImportName;
        }
        case EImportMode.MANUAL_CREATE:
            return stubs[0].title || '';
        case EImportMode.PUBMED_IMPORT:
            if (fileName) {
                return `${fileName}`;
            } else {
                const pmids = stubs.reduce((acc, curr, index) => {
                    if (index === 0) return curr.pmid;
                    return `${acc}, ${curr.pmid}`;
                }, '');

                return pmids;
            }
    }
};

const CurationImportFinalizeNameAndReview: React.FC<{
    importMode: EImportMode;
    onNavigate: (button: ENavigationButton) => void;
    onNameImport: (name: string) => void;
    stubs: ICurationStubStudy[];
    searchCriteria: SearchCriteria | undefined;
    unimportedStubs: string[];
    fileName: string | undefined;
}> = ({ onNameImport, onNavigate, stubs, unimportedStubs, importMode, fileName, searchCriteria }) => {
    const [importName, setImportName] = useState(
        generateDefaultImportName(importMode, stubs, searchCriteria, fileName)
    );

    const handleClickNext = () => {
        if (!importName) return;
        onNameImport(importName);
        return;
    };

    return (
        <Box sx={{ paddingTop: '0.5rem' }}>
            <Box sx={{ margin: '1rem 0' }}>
                <Typography
                    gutterBottom
                    sx={{ fontWeight: 'bold', marginRight: '4px', display: 'inline' }}
                    variant="h6"
                >
                    Give your import a name:
                </Typography>
                <TextField
                    sx={{ width: '100%', marginTop: '0.5rem' }}
                    size="small"
                    value={importName}
                    onChange={(val) => setImportName(val.target.value)}
                />

                <CurationImportFinalizeReview stubs={stubs} unimportedStubs={unimportedStubs} />
            </Box>
            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button variant="outlined" onClick={() => onNavigate(ENavigationButton.PREV)}>
                        back
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={!importName || stubs.length === 0}
                        onClick={handleClickNext}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CurationImportFinalizeNameAndReview;
