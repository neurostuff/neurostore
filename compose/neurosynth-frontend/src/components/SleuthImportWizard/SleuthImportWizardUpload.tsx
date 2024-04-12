import FileUploadIcon from '@mui/icons-material/FileUpload';
import { Box, Button } from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import React from 'react';

const SleuthImportWizardUpload: React.FC = (props) => {
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event?.target?.files) return;
        alert(event.target.files.length);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <Button component="label" endIcon={<FileUploadIcon />}>
                    Upload file
                    <input multiple onChange={handleFileUpload} type="file" hidden />
                </Button>
            </Box>
            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box
                    sx={[
                        CurationImportBaseStyles.fixedButtonsContainer,
                        { justifyContent: 'flex-end' },
                    ]}
                >
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SleuthImportWizardUpload;
