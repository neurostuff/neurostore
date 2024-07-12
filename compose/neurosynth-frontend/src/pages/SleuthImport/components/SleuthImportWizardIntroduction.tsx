import { Box, Button, Typography } from '@mui/material';
import CurationImportBaseStyles from 'pages/CurationImport/components/CurationImport.styles';

const SleuthImportWizardIntroduction: React.FC<{ onNext: () => void }> = (props) => {
    const { onNext } = props;
    return (
        <Box>
            <Box>
                <Typography variant="h6" gutterBottom>
                    This is a step by step interface for creating a project from a sleuth file.
                </Typography>
                <Typography gutterBottom my="1rem">
                    Once a sleuth file is uploaded in the next page, neurosynth compose will try and
                    map the studies within the sleuth file to existing studies.
                </Typography>
                <Typography gutterBottom my="1rem">
                    Neurosynth compose will treat each file uploaded as a separate meta-analysis.
                    Upload multiple sleuth files to create multiple runnable meta-analyses in
                    neurosynth compose.
                </Typography>
                <Typography gutterBottom my="1rem">
                    The next step will guide you through the upload process. On the next page, click
                    on the question mark icon at the top of the page to see the correct, expected
                    format for sleuth files.
                </Typography>
                <Typography>Click next to get started.</Typography>
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
                        onClick={() => onNext()}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SleuthImportWizardIntroduction;
