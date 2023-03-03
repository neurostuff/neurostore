import { Box, Button, TextField, Typography } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ChangeEvent, useEffect, useState } from 'react';
const Cite = require('citation-js');
require('@citation-js/plugin-enw');
require('@citation-js/plugin-bibtex');
require('@citation-js/plugin-ris');

enum EValidationReason {
    EMPTY = 'Input is empty',
    INCORRECT = 'Format is incorrect',
}

const ImportStandardFormat: React.FC = (props) => {
    Cite.parse.bibtex.text();
    const [uploadState, setUploadState] = useState<{
        parsedIdList: string[];
        rawIdText: string;
        file: File | undefined;
        isValid: boolean;
        validationReason: EValidationReason | null;
    }>({
        parsedIdList: [],
        rawIdText: '',
        file: undefined,
        isValid: false,
        validationReason: EValidationReason.EMPTY,
    });

    useEffect(() => {
        console.log(uploadState.rawIdText);
        try {
            const example = new Cite(uploadState.rawIdText);
            console.log(example);
            console.log(example.format('data', { format: 'object' }));
        } catch (e) {
            console.error(e);
        }
    }, [uploadState.rawIdText]);

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
                    console.log(replacedText);
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

    const handleButtonClick = (button: ENavigationButton) => {};

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <Button component="label" endIcon={<FileUploadIcon />}>
                    {uploadState.file?.name || 'Upload File'}
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
                    <Typography></Typography>
                </Box>
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
                        multiline
                        helperText={uploadState.validationReason || ''}
                        error={!uploadState.isValid}
                        sx={{ width: '100%' }}
                    />
                </Box>
            </Box>
            <Box>
                <NavigationButtons
                    nextButtonStyle="contained"
                    nextButtonDisabled={uploadState.parsedIdList.length === 0}
                    onButtonClick={handleButtonClick}
                />
            </Box>
        </Box>
    );
};

export default ImportStandardFormat;
