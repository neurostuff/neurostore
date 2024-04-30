import { Warning } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import {
    Box,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import HelpDialog from 'components/Dialogs/HelpDialog/HelpDialog';
import React, { useMemo, useState } from 'react';

const validateFileContents = (fileContents: string): boolean => {
    const lines = fileContents.split(/\r?\n/);
    console.log({ lines });
    return false;
};

const parseFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsText(file, 'UTF-8');
        fileReader.onload = (e) => {
            const fileContents = e.target?.result;
            if (!fileContents || typeof fileContents !== 'string') {
                reject(new Error('File is invalid'));
                return;
            }
            const isValid = validateFileContents(fileContents);
            return isValid ? resolve(fileContents) : reject(new Error('File is invalid'));
        };

        fileReader.onerror = (err) => {
            reject(err);
        };
        fileReader.onabort = (err) => {
            reject(err);
        };
    });
};

const SleuthImportWizardUpload: React.FC = (props) => {
    const [sleuthFileUploads, setSleuthFileUploads] = useState<
        {
            file: File;
            parsedFileContents: string;
            isValidFile: boolean;
        }[]
    >([]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event?.target?.files) return;
        const uploadedFiles: {
            file: File;
            parsedFileContents: string;
            isValidFile: boolean;
        }[] = [];

        [...(event.target.files || [])].forEach(async (file) => {
            try {
                const parsedFile = await parseFile(file);
                console.log({ parsedFile });
                uploadedFiles.push({
                    file: file,
                    parsedFileContents: '',
                    isValidFile: true,
                });
            } catch (e) {
                uploadedFiles.push({
                    file: file,
                    parsedFileContents: '',
                    isValidFile: false,
                });
            }
        });

        setSleuthFileUploads((prev) => {
            return [...uploadedFiles, ...prev];
        });
    };

    const handleRemoveFile = (index: number) => {
        setSleuthFileUploads(sleuthFileUploads.filter((_, i) => i !== index));
    };

    const nextButtonDisabled = useMemo(() => {
        return sleuthFileUploads.length === 0 || sleuthFileUploads.some((x) => !x.isValidFile);
    }, [sleuthFileUploads]);

    return (
        <Box>
            <Box mb="1rem" sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography color="muted.main">
                    Please ensure that your sleuth files are in the correct format before uploading
                </Typography>
                <Box ml="10px">
                    <HelpDialog dialogTitle="Compatible sleuth files">
                        <Typography variant="body1">
                            Neurosynth Compose expects sleuth files in a specific format
                        </Typography>
                    </HelpDialog>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', height: '350px' }}>
                <Box
                    sx={{
                        width: '50%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Button
                        sx={{
                            width: '100%',
                            height: '100%',
                            border: '4px dashed #f4f4f4',
                            fontSize: '1.4rem',
                        }}
                        component="label"
                    >
                        <Box
                            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                            <FileUploadIcon
                                sx={{
                                    width: '50px',
                                    height: '50px',
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                }}
                            />
                            <Typography sx={{ fontSize: '1.5rem', textTransform: 'none' }}>
                                Click to Upload File
                            </Typography>
                        </Box>
                        <input multiple onChange={handleFileUpload} type="file" hidden />
                    </Button>
                </Box>
                <Box sx={{ width: '50%', overflowY: 'auto' }}>
                    <List sx={{ padding: '0 1rem' }} disablePadding>
                        {sleuthFileUploads.length === 0 && (
                            <Typography sx={{ padding: '1rem' }} color="warning.dark">
                                No files uploaded
                            </Typography>
                        )}
                        {sleuthFileUploads.map((sleuthFile, index) => (
                            <ListItem key={index}>
                                <ListItemIcon>
                                    {sleuthFile.isValidFile ? (
                                        <InsertDriveFileIcon />
                                    ) : (
                                        <Warning color="error" />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    sx={{ color: 'error.main' }}
                                    secondaryTypographyProps={{
                                        color: sleuthFile.isValidFile ? '' : 'error',
                                    }}
                                    secondary={
                                        sleuthFile.isValidFile
                                            ? sleuthFile.file.type
                                            : 'This format of this file is invalid'
                                    }
                                >
                                    {sleuthFile.file.name}
                                </ListItemText>
                                <IconButton
                                    sx={{ color: 'error.main' }}
                                    onClick={() => handleRemoveFile(index)}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </ListItem>
                        ))}
                    </List>
                </Box>
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
                        disabled={nextButtonDisabled}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SleuthImportWizardUpload;
