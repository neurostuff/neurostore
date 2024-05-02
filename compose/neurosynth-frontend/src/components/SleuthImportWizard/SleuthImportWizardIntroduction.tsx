import { Box, Button, Typography } from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';

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
                    map the studies within the sleuth file to existing studies based on the provided
                    DOI.
                </Typography>
                <Typography gutterBottom my="1rem">
                    Neurosynth compose will treat each file uploaded as a separate meta-analysis.
                    Upload multiple sleuth files to create multiple runnable meta-analyses in
                    neurosynth compose.
                </Typography>
                <Typography>
                    To see the expected format for sleuth files, please go to the next step and
                    click on the question mark icon at the top of the page.
                </Typography>
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
