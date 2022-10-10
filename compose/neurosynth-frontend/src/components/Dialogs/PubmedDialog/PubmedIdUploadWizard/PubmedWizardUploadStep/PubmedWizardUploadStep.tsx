import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';

interface IPubmedWizardUploadStep {
    onFileUpload: (file: File) => void;
    onPubmedIdsInputted: (pubmedIds: string) => void;
    uploadedFile: File | undefined;
    inputtedPubmedIds: string;
    onChangeStep: (change: ENavigationButton) => void;
}

const PubmedWizardUploadStep: React.FC<IPubmedWizardUploadStep> = (props) => {
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event?.target?.files && event.target.files[0]) {
            const file = event.target.files[0];
            props.onFileUpload(file);
        }
    };

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        props.onPubmedIdsInputted(event.target.value);
    };

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button component="label" endIcon={<FileUploadIcon />}>
                    {props?.uploadedFile?.name || 'Upload File'}{' '}
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
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Typography>Enter list of pubmed IDs separated by a newline</Typography>
                </Box>
                <TextField
                    value={props.inputtedPubmedIds}
                    onChange={handleChange}
                    rows={8}
                    multiline
                    sx={{ width: '100%', marginBottom: '2rem' }}
                />
            </Box>

            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <Button color="primary" disabled>
                    previous
                </Button>
                <Button
                    color="primary"
                    onClick={() => {
                        props.onChangeStep(ENavigationButton.NEXT);
                    }}
                    disabled={
                        props.inputtedPubmedIds.length === 0 && props.uploadedFile === undefined
                    }
                >
                    next
                </Button>
            </Box>
        </>
    );
};

export default PubmedWizardUploadStep;
