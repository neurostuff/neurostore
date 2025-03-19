import { Box, Button, TextField, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import { useState } from 'react';
import CurationImportBaseStyles from './CurationImport.styles';
import CurationImportFinalizeReview from './CurationImportFinalizeReview';

const CurationImportFinalizeNameAndReview: React.FC<{
    importMode: EImportMode;
    onNavigate: (button: ENavigationButton) => void;
    onNameImport: (name: string) => void;
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
}> = (props) => {
    const { onNameImport, onNavigate, stubs, unimportedStubs, importMode } = props;

    const [importName, setImportName] = useState(
        `${importMode}: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
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
                        disabled={!importName}
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
