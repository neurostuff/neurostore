import FileUploadIcon from '@mui/icons-material/FileUpload';
import { Box, Button, TextField } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ChangeEvent, useEffect, useState } from 'react';
import CurationImportBaseStyles from './CurationImport.styles';

enum EValidationReason {
    EMPTY = 'PubMed ID input is empty',
    INCORRECT = 'PubMed ID format is incorrect or unsupported',
    TOO_BIG = 'Please limit uploads to 1500 PMIDs at a time',
}

const isValidNumberList = (rawIdText: string | undefined) => {
    if (!rawIdText) return false;
    return rawIdText
        .trim()
        .split(/[\r?\n]+/)
        .every((pmid) => /^\d+$/.test(pmid));
};

const CurationImportPMIDsUpload: React.FC<{
    onPubmedIdsUploaded: (parsedIds: string[]) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
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
        if (uploadState.rawIdText.length === 0) {
            setUploadState((prev) => ({
                ...prev,
                isValid: false,
                validationReason: EValidationReason.EMPTY,
            }));
            return;
        }

        const isValid = isValidNumberList(uploadState.rawIdText);
        if (!isValid) {
            setUploadState((prev) => ({
                ...prev,
                isValid: false,
                validationReason: EValidationReason.INCORRECT,
            }));
            return;
        }
        const textIdsToStringArr = uploadState.rawIdText
            .split(/[\r?\n]+/)
            .map((x) => x.trim())
            .filter((x) => !!x);
        if (textIdsToStringArr.length > 1500) {
            setUploadState((prev) => ({
                ...prev,
                isValid: false,
                validationReason: EValidationReason.TOO_BIG,
            }));
            return;
        }

        setUploadState((prev) => ({
            ...prev,
            parsedIdList: textIdsToStringArr,
            isValid: true,
            validationReason: null,
        }));
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
                    // we have trouble testing string patterns for carriage returns like \r\n, so we replace them here with new \n newlines
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
            props.onPubmedIdsUploaded(uploadState.parsedIdList);
        }
    };

    return (
        <Box sx={{ width: '100%', marginBottom: '6rem' }}>
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
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    <TextField
                        value={uploadState.rawIdText}
                        onChange={handleInputIds}
                        rows={10}
                        multiline
                        placeholder="Enter list of pubmed IDs separated by a newline"
                        helperText={uploadState.validationReason || ''}
                        error={!uploadState.isValid}
                        sx={{ width: '400px' }}
                    />
                </Box>
            </Box>
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
                        disabled={
                            uploadState.parsedIdList.length === 0 || uploadState.isValid === false
                        }
                        onClick={() => handleButtonClick(ENavigationButton.NEXT)}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CurationImportPMIDsUpload;
