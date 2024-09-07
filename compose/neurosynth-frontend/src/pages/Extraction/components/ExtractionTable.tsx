import {
    Box,
    IconButton,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useGetStudysetById, useGetStudysets } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
} from 'pages/Project/store/ProjectStore';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { EExtractionStatus } from '../ExtractionPage';

const ExtractionTable: React.FC = () => {
    const studysetId = useProjectExtractionStudysetId();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isRefetching: getStudysetIsRefetching,
        isError: getStudysetIsError,
    } = useGetStudysetById(studysetId, true);

    return (
        <TableContainer sx={{ maxHeight: '90vh' }}>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <TableCell width="30%">
                            <Box sx={{ marginBottom: '0.2rem' }}>
                                <Typography>Name</Typography>
                                <TextField
                                    placeholder="filter by name"
                                    size="small"
                                    sx={{
                                        width: '100%',
                                        '.MuiOutlinedInput-input': {
                                            padding: '4px 10px',
                                        },
                                    }}
                                />
                            </Box>
                        </TableCell>
                        <TableCell width="20%">
                            <Box sx={{ marginBottom: '0.2rem' }}>
                                <Typography>Authors</Typography>
                                <TextField
                                    placeholder="filter by name"
                                    size="small"
                                    sx={{
                                        width: '100%',
                                        '.MuiOutlinedInput-input': {
                                            padding: '4px 10px',
                                        },
                                    }}
                                />
                            </Box>
                        </TableCell>
                        <TableCell width="10%">
                            <Box sx={{ marginBottom: '0.2rem' }}>
                                <Typography>Journal</Typography>
                                <TextField
                                    placeholder="filter by publication"
                                    size="small"
                                    sx={{
                                        width: '100%',
                                        wordBreak: 'break-all',
                                        whiteSpace: 'break-spaces',
                                        '.MuiOutlinedInput-input': {
                                            padding: '4px 10px',
                                        },
                                    }}
                                />
                            </Box>
                        </TableCell>
                        <TableCell width="17%">
                            <Box sx={{ marginBottom: '0.2rem' }}>
                                <Typography>DOI</Typography>
                                <TextField
                                    placeholder="filter by DOI"
                                    size="small"
                                    sx={{
                                        width: '100%',
                                        '.MuiOutlinedInput-input': {
                                            padding: '4px 10px',
                                        },
                                    }}
                                />
                            </Box>
                        </TableCell>
                        <TableCell width="13%">
                            <Box sx={{ marginBottom: '0.2rem' }}>
                                <Typography>PMID</Typography>
                                <TextField
                                    placeholder="21665078"
                                    size="small"
                                    sx={{
                                        width: '100%',
                                        '.MuiOutlinedInput-input': {
                                            padding: '4px 10px',
                                        },
                                    }}
                                />
                            </Box>
                        </TableCell>
                        <TableCell width="10%">
                            <Box>
                                <Typography>Status</Typography>
                                <Select
                                    value="none"
                                    size="small"
                                    sx={{
                                        width: '100%',
                                        '.MuiOutlinedInput-input': {
                                            padding: '4px 10px',
                                        },
                                    }}
                                >
                                    <MenuItem value="none">None</MenuItem>
                                    <MenuItem value={EExtractionStatus.COMPLETED}>
                                        Completed
                                    </MenuItem>
                                    <MenuItem value={EExtractionStatus.SAVEDFORLATER}>
                                        Save for Later
                                    </MenuItem>
                                    <MenuItem value={EExtractionStatus.UNCATEGORIZED}>
                                        Uncategorized
                                    </MenuItem>
                                </Select>
                            </Box>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {((studyset?.studies || []) as StudyReturn[]).map(
                        ({ id, name, authors, publication, doi, pmid }) => {
                            const status = studyStatusList.find((x) => x.id === id);
                            const extractionStatus =
                                status === undefined
                                    ? EExtractionStatus.UNCATEGORIZED
                                    : status.status;

                            const backgroundColor =
                                extractionStatus === EExtractionStatus.UNCATEGORIZED
                                    ? 'white'
                                    : extractionStatus === EExtractionStatus.SAVEDFORLATER
                                    ? 'rgba(140, 195, 255, 0.29)'
                                    : 'rgba(107, 255, 27, 0.2)';

                            return (
                                <TableRow
                                    key={id}
                                    component={TableRow}
                                    onClick={() => alert(name)}
                                    sx={{
                                        backgroundColor: backgroundColor,
                                        ':hover': {
                                            cursor: 'pointer',
                                            filter: 'brightness(0.9)',
                                        },
                                    }}
                                >
                                    <TableCell sx={{ fontWeight: 'bold', borderBottom: '0px' }}>
                                        {name}
                                    </TableCell>
                                    <TableCell sx={{ borderBottom: '0px' }}>{authors}</TableCell>
                                    <TableCell sx={{ borderBottom: '0px' }}>
                                        {publication}
                                    </TableCell>
                                    <TableCell
                                        sx={{ wordBreak: 'break-word', borderBottom: '0px' }}
                                    >
                                        {doi}
                                    </TableCell>
                                    <TableCell sx={{ borderBottom: '0px' }}>{pmid}</TableCell>
                                    <TableCell sx={{ borderBottom: '0px' }}>
                                        <Box>
                                            {extractionStatus ===
                                            EExtractionStatus.UNCATEGORIZED ? (
                                                <>
                                                    <IconButton color="success">
                                                        <CheckIcon />
                                                    </IconButton>
                                                    <IconButton color="info">
                                                        <BookmarkIcon />
                                                    </IconButton>
                                                </>
                                            ) : extractionStatus ===
                                              EExtractionStatus.SAVEDFORLATER ? (
                                                <IconButton color="success">
                                                    <CheckIcon />
                                                </IconButton>
                                            ) : (
                                                <IconButton color="info">
                                                    <BookmarkIcon />
                                                </IconButton>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        }
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ExtractionTable;
