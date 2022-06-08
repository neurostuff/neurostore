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

const IsSupported: React.FC<{ isSupported: boolean; isStarred?: boolean }> = (props) => {
    return (
        <TableCell
            sx={{ backgroundColor: props.isSupported ? 'green' : 'red', borderBottom: 'none' }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {props.isSupported ? (
                    <CheckCircleIcon fontSize="large" sx={{ color: 'primary.contrastText' }} />
                ) : (
                    <CancelIcon
                        fontSize="large"
                        sx={{
                            color: 'primary.contrastText',
                        }}
                    />
                )}
                {props.isStarred && (
                    <Box component="span" sx={{ color: 'white' }}>
                        *
                    </Box>
                )}
            </Box>
        </TableCell>
    );
};

const PlatformComparisonTable: React.FC = (props) => {
    const platforms = {
        compose: [
            { isChecked: true, starred: false },
            { isChecked: true, starred: false },
            { isChecked: true, starred: false },
            { isChecked: true, starred: true },
            { isChecked: true, starred: false },
            { isChecked: true, starred: true },
        ],
        neurosynth: [false, false, true, false, false, false],
        neuroquery: [false, false, true, false, false, false],
        brainmap: [true, true, false, true, false, false],
        brainspell: [true, true, true, false, false, false],
    };

    return (
        <>
            <TableContainer elevation={5} component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Platform/Database</TableCell>
                            <TableCell>Editable Studies</TableCell>
                            <TableCell>Filter/Select Studies</TableCell>
                            <TableCell>Browser Based Workflow</TableCell>
                            <TableCell>Volume Based Morphometry (VBM)</TableCell>
                            <TableCell>Multiple fMRI Meta-Analysis Algorithms</TableCell>
                            <TableCell>Image Based Meta-Analysis (IBMA)</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Neurosynth-Compose</TableCell>
                            {platforms.compose.map((status, index) => (
                                <IsSupported
                                    key={index}
                                    isSupported={status.isChecked}
                                    isStarred={status.starred}
                                />
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Neurosynth</TableCell>
                            {platforms.neurosynth.map((isChecked, index) => (
                                <IsSupported key={index} isSupported={isChecked} />
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Neuroquery</TableCell>
                            {platforms.neuroquery.map((isChecked, index) => (
                                <IsSupported key={index} isSupported={isChecked} />
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Brainmap.org</TableCell>
                            {platforms.brainmap.map((isChecked, index) => (
                                <IsSupported key={index} isSupported={isChecked} />
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Brainspell</TableCell>
                            {platforms.brainspell.map((isChecked, index) => (
                                <IsSupported key={index} isSupported={isChecked} />
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
            <Box sx={{ marginTop: '10px', color: 'white', textAlign: 'end' }}>
                *On the roadmap to be implemented
            </Box>
        </>
    );
};

export default PlatformComparisonTable;
