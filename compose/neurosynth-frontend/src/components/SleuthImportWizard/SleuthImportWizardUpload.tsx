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
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import HelpDialog from 'components/Dialogs/HelpDialog/HelpDialog';
import React, { useMemo, useState } from 'react';

const stringToNumber = (s: string): { value: number; isValid: boolean } => {
    const parsedNum = Number(s);
    if (isNaN(parsedNum)) {
        return {
            value: parsedNum,
            isValid: false,
        };
    }
    return {
        value: 0,
        isValid: true,
    };
};

// [x, y, z]
const parseCoordinate = (coordinates: string): { coords: number[]; isValid: boolean } => {
    const parsedCoordinates: number[] = [];
    const coordinatesAsStringArr = coordinates.split(/\t/);
    for (const coordinateString of coordinatesAsStringArr) {
        const { value, isValid } = stringToNumber(coordinateString);
        if (!isValid) return { coords: [], isValid: false };
        parsedCoordinates.push(value);
    }
    return {
        coords: parsedCoordinates,
        isValid: true,
    };
};

const stringsAreValidFileFormat = (
    sleuthStudy: string
): { isValid: boolean; errorMessage?: string } => {
    let containsDOI = false;
    let containsAtLeastOneExperimentName = false;
    const parsedSleuthStudy = sleuthStudy.replaceAll(/\/\/\s*/g, '').split('\n');
    let hasReachedCoordinates = false;
    for (let line of parsedSleuthStudy) {
        if (hasReachedCoordinates) {
            if (!parseCoordinate(line).isValid) {
                return {
                    isValid: false,
                    errorMessage: `Invalid coordinates: ${line}`,
                };
            }
        } else {
            if (line.toLocaleLowerCase().includes('subjects')) {
                const [_, numSubjects] = line.split('=');
                const { isValid } = stringToNumber(numSubjects);
                if (!isValid) {
                    return {
                        isValid: false,
                        errorMessage: `Expected number of subjects. Encountered error at: ${line}`,
                    };
                }
                hasReachedCoordinates = true; // we assume that subjects is last before coordinates
            } else if (line.toLocaleLowerCase().includes('doi')) {
                const [_, id] = line.split('=');
                if (!id) {
                    return {
                        isValid: false,
                        errorMessage: `Expected valid DOI but found. Encountered error at: ${line}`,
                    };
                }
                if (containsDOI) {
                    return {
                        isValid: false,
                        errorMessage: `Encountered multiple DOIs: ${line}`,
                    };
                } else {
                    containsDOI = true;
                }
            } else {
                const [authorInfo, experimentName] = line.split(':');
                if (!experimentName?.trim()) {
                    return {
                        isValid: false,
                        errorMessage: `Invalid experiment name. (Hint: Did you use a semi colon instead of a colon?) Encountered error at: ${line}`,
                    };
                }

                if (!authorInfo?.trim()) {
                    return {
                        isValid: false,
                        errorMessage: `Unexpected format. Encountered error at: ${line}`,
                    };
                }
                containsAtLeastOneExperimentName = true;
            }
        }
    }

    if (!containsDOI) {
        return {
            isValid: false,
            errorMessage: `Missing DOI: Encountered error at: ${sleuthStudy.slice(0, 100)}...`,
        };
    }
    if (!containsAtLeastOneExperimentName) {
        return {
            isValid: false,
            errorMessage: `At least one experiment name is required. Encountered error at: ${sleuthStudy.slice(
                0,
                100
            )}...`,
        };
    }

    return { isValid: true };
};

const validateFileContents = (
    fileContents: string
): { isValid: boolean; errorMessage?: string } => {
    // we expect the first line to be something like: "// Reference"
    let [expectedReferenceString, ...lines] = fileContents.split(/\r?\n/);
    if (!expectedReferenceString || lines.length === 0) {
        return {
            isValid: false,
            errorMessage: 'File has no data',
        };
    }
    if (!expectedReferenceString.toLocaleLowerCase().includes('reference')) {
        return {
            isValid: false,
            errorMessage: 'File does not have a reference',
        };
    }

    const splitLinesBySleuthStudy = fileContents
        .replace(expectedReferenceString + '\n', '')
        .trim()
        .split(/\n\s*\n/);
    for (const sleuthStudy of splitLinesBySleuthStudy) {
        const { isValid, errorMessage = '' } = stringsAreValidFileFormat(sleuthStudy);
        if (!isValid) {
            return {
                isValid: false,
                errorMessage:
                    errorMessage ||
                    `Unexpected format. Encountered error at: ${sleuthStudy.slice(0, 80)}...`,
            };
        }
    }
    return {
        isValid: true,
        errorMessage: undefined,
    };
};

const parseFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (file.type !== 'text/plain') {
            return reject(new Error('File should be .txt'));
        }

        const fileReader = new FileReader();
        fileReader.readAsText(file, 'UTF-8');
        fileReader.onload = (e) => {
            const fileContents = e.target?.result;
            if (!fileContents || typeof fileContents !== 'string') {
                return reject(new Error('File contents are invalid (expected string)'));
            }
            const { isValid, errorMessage } = validateFileContents(fileContents);
            return isValid
                ? resolve(fileContents)
                : reject(new Error(errorMessage || 'File is invalid'));
        };

        fileReader.onerror = (err) => {
            reject(err);
        };
        fileReader.onabort = (err) => {
            reject(err);
        };
    });
};

const SleuthImportWizardUpload: React.FC<{
    onNext: (sleuthUploads: string[]) => void;
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
                const parsedFile = await parseFile(targetFile);
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
                        <Typography gutterBottom>
                            Neurosynth Compose expects files in a specific format.
                        </Typography>
                        <Typography gutterBottom>
                            In order to make sure that the files you upload are compatible, please
                            make sure to format your files using the following standards:
                        </Typography>

                        <ul>
                            <li>
                                Begin the file with a Reference specifying coordinate space. This
                                should only appear in the file once, at the top.
                                <br />
                                ex: <b>// Reference=MNI"</b>
                            </li>
                            <li>
                                The next line should contain the DOI associated with the study.
                                <br />
                                ex: <b>// DOI=1234567</b>
                            </li>
                            <li>
                                The next line(s) should contain the author followed by the
                                experiment, separated by a colon.
                                <br />
                                ex: <b>// Smith et al., 2019: Working Memory vs Baseline</b>
                            </li>
                            <li>
                                The next line should contain the number of subjects.
                                <br />
                                ex: <b>// Subjects=23</b>
                            </li>
                            <li>
                                The following lines should contain the tab separated coordinates
                                <br />
                                ex: <b>-7.5/t-8.5/t-9.5</b>
                            </li>
                            <li>
                                Finally, a newline should be added as a delimiter, separating each
                                of the studies in the file
                            </li>
                        </ul>

                        <Typography mb="1rem">
                            Files should be plain text files with a .txt suffix.
                        </Typography>

                        <Typography gutterBottom>Example: myFile.txt</Typography>

                        <CodeSnippet
                            linesOfCode={[
                                '// Reference=MNI',
                                '// DOI=1234567',
                                '// Smith et al., 2019: Working Memory vs Baseline',
                                '// Subjects=23',
                                '-7.5/t-8.5/t-9.5',
                                '10/t-12/t-62',
                                '21/t-14/t-2',
                                '0/t-9/t16',
                                '\n',
                                '// DOI=1234568',
                                '// Roberts et al., 1995: 2 Back vs 1 Back',
                                '// Graeff et al., 2000: 1 Back vs 0 Back',
                                '// Edwards et al., 2017: 2 Back vs 0 Back',
                                `// Subjects=62`,
                                '82/t12/t0',
                                '-27/t34/t72',
                                '-7/t-8/t-9',
                                '10/t-12/t-62',
                                '\n',
                            ]}
                        />
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
                        onClick={() => onNext(sleuthFileUploads.map((x) => x.parsedFileContents))}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SleuthImportWizardUpload;
