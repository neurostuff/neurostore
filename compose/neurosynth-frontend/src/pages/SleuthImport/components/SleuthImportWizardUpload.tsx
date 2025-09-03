/* eslint-disable react/jsx-no-comment-textnodes */
import { Warning } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import {
    Box,
    Button,
    IconButton,
    Link,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material';
import CurationImportBaseStyles from 'pages/CurationImport/components/CurationImport.styles';
import React, { useMemo, useState } from 'react';
import { ISleuthFileUploadStubs, parseFile, sleuthUploadToStubs } from '../SleuthImport.helpers';
import SleuthImportHelpDialog from './SleuthImportHelpDialog';

const SleuthImportWizardUpload: React.FC<{
    onNext: (sleuthUploads: ISleuthFileUploadStubs[]) => void;
    onPrevious: () => void;
}> = (props) => {
    const { onNext, onPrevious } = props;

    const [sleuthFileUploads, setSleuthFileUploads] = useState<
        {
            file: File;
            parsedFileContents: string;
            isValidFile: boolean;
            errorMessage?: string;
        }[]
    >([]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event?.target?.files) return;
        const uploadedFiles: {
            file: File;
            parsedFileContents: string;
            isValidFile: boolean;
            errorMessage?: string;
        }[] = [];

        for (const targetFile of [...event.target.files]) {
            try {
                let parsedFile = await parseFile(targetFile);
                // Normalize Windows and lone carriage returns to Unix/Mac line endings
                parsedFile = parsedFile.replace(/\r\n|\r/g, '\n');
                uploadedFiles.push({
                    file: targetFile,
                    parsedFileContents: parsedFile,
                    isValidFile: true,
                });
            } catch (error: any) {
                uploadedFiles.push({
                    file: targetFile,
                    parsedFileContents: '',
                    errorMessage: error?.message || '',
                    isValidFile: false,
                });
            }
        }

        setSleuthFileUploads((prev) => {
            return [...uploadedFiles, ...prev];
        });
        event.target.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setSleuthFileUploads(sleuthFileUploads.filter((_, i) => i !== index));
    };

    const handleClickNext = () => {
        const convertedUploads: ISleuthFileUploadStubs[] = [];
        for (let file of sleuthFileUploads) {
            const { sleuthStubs, space } = sleuthUploadToStubs(file.parsedFileContents);
            convertedUploads.push({
                fileName: file.file.name,
                sleuthStubs,
                space,
            });
        }
        onNext(convertedUploads);
    };

    const nextButtonDisabled = useMemo(() => {
        return sleuthFileUploads.length === 0 || sleuthFileUploads.some((x) => !x.isValidFile);
    }, [sleuthFileUploads]);

    return (
        <Box>
            <Box mb="1rem" sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography>
                    Please ensure that your sleuth files are in the <Link>correct format</Link>{' '}
                    before uploading
                </Typography>
                <Box ml="10px">
                    <SleuthImportHelpDialog />
                </Box>
            </Box>
            <Box sx={{ display: 'flex', height: '350px', marginBottom: '6rem' }}>
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
                                        <InsertDriveFileIcon color="primary" />
                                    ) : (
                                        <Warning color="error" />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    sx={{
                                        color: sleuthFile.isValidFile
                                            ? 'primary.main'
                                            : 'error.main',
                                        overflowWrap: 'break-word',
                                    }}
                                    secondaryTypographyProps={{
                                        color: sleuthFile.isValidFile ? 'inherit' : 'error',
                                    }}
                                    secondary={
                                        sleuthFile.isValidFile
                                            ? sleuthFile.file.type
                                            : sleuthFile.errorMessage ||
                                              'The format of this file is invalid'
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
                        { justifyContent: 'space-between' },
                    ]}
                >
                    <Button
                        color="secondary"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        onClick={() => onPrevious()}
                    >
                        previous
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={nextButtonDisabled}
                        onClick={handleClickNext}
                    >
                        create project
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SleuthImportWizardUpload;
