import { Box, Button, TextField, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ChangeEvent, useEffect, useState } from 'react';
import FileUploadIcon from '@mui/icons-material/FileUpload';

interface IPubMedWizardUploadStep {
    onChangeStep: (change: ENavigationButton, ids: string[]) => void;
}

const PubMedWizardUploadStep: React.FC<IPubMedWizardUploadStep> = (props) => {
    const [ids, setIds] = useState<string[]>([]);
    const [file, setFile] = useState<File>();
    const [idText, setIdText] = useState('');
    const [isValid, setIsValid] = useState(false);

    useEffect(() => {
        // testing for PMIDs - we expect any number of numbers followed by a newline
        const regex = /^(?:[0-9]+(?:\\[rn]|[\r\n]|$))+$/;
        const isValid = regex.test(idText);

        if (isValid) {
            const textIdsToStringArr = idText.split(/\r?\n/);
            setIds(textIdsToStringArr);
        }
        setIsValid(isValid);
    }, [idText]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event?.target?.files && event.target.files[0]) {
            const file = event.target.files[0];
            setFile(file);

            const reader = new FileReader();
            reader.onload = function (e) {
                const content = reader.result;
                if (content && typeof content === 'string') {
                    const list = content.split(/\r?\n/);
                    setIds(list);
                    // we have trouble testing string patterns for carriage returns like \r\n, so we replace them here with new \n newlines
                    const replacedText = content.replace(/(?:[\r\n])+/g, '\n');

                    setIdText(replacedText);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleInputIds = (event: ChangeEvent<HTMLInputElement>) => {
        setIdText(event.target.value);
    };

    const handleClickNext = () => {
        props.onChangeStep(ENavigationButton.NEXT, ids);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button component="label" endIcon={<FileUploadIcon />}>
                    {file?.name || 'Upload File'}
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
                <Box
                    sx={{
                        marginBottom: '2rem',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    <TextField
                        value={idText}
                        onChange={handleInputIds}
                        rows={8}
                        multiline
                        helperText={isValid ? '' : 'PubMed ID format is incorrect or empty'}
                        error={!isValid}
                        sx={{ width: '400px' }}
                    />
                </Box>
            </Box>

            <NavigationButtons
                nextButtonStyle="contained"
                prevButtonDisabled={true}
                nextButtonDisabled={!isValid}
                onButtonClick={handleClickNext}
            />
        </Box>
    );
};

export default PubMedWizardUploadStep;