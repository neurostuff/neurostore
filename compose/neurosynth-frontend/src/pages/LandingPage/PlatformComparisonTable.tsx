import {
    Paper,
    TableContainer,
    TableRow,
    TableHead,
    Table,
    TableCell,
    TableBody,
    Box,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PlatformComparisonTableStyles from './PlatformComparisonTable.styles';

const PlatformComparisonTable: React.FC = (props) => {
    return (
        <>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={[PlatformComparisonTableStyles.cellRowHeader]}>
                                Features
                            </TableCell>
                            <TableCell
                                sx={[
                                    PlatformComparisonTableStyles.cellColHeader,
                                    { fontWeight: 'bold' },
                                ]}
                            >
                                neurosynth compose
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cellColHeader}>
                                neurosynth
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow sx={{ backgroundColor: 'secondary.dark' }}>
                            <TableCell sx={PlatformComparisonTableStyles.cellRowHeader}>
                                Large study database
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={PlatformComparisonTableStyles.cellRowHeader}>
                                Browser based workflow
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow sx={{ backgroundColor: 'secondary.dark' }}>
                            <TableCell sx={PlatformComparisonTableStyles.cellRowHeader}>
                                Editable studies
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CloseIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'error.dark' },
                                    ]}
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={PlatformComparisonTableStyles.cellRowHeader}>
                                Filterable/Selectable studies
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CloseIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'error.dark' },
                                    ]}
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow sx={{ backgroundColor: 'secondary.dark' }}>
                            <TableCell sx={PlatformComparisonTableStyles.cellRowHeader}>
                                Multiple fMRI Meta-Analysis Algorithms
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CloseIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'error.dark' },
                                    ]}
                                />
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={PlatformComparisonTableStyles.cellRowHeader}>
                                Image Based Meta-Analysis (IBMA)
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CheckIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'success.main' },
                                    ]}
                                />
                                *
                            </TableCell>
                            <TableCell sx={PlatformComparisonTableStyles.cell}>
                                <CloseIcon
                                    sx={[
                                        PlatformComparisonTableStyles.cellIcon,
                                        { color: 'error.dark' },
                                    ]}
                                />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ marginTop: '2rem', color: 'white', textAlign: 'start' }}>
                *On the roadmap to be implemented
            </Box>
        </>
    );
};

export default PlatformComparisonTable;
