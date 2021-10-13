import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box } from '@mui/system';
import { useHistory } from 'react-router-dom';
import { ReadOnly, Study } from '../../gen/api';
import { StudyApiResponse } from '../../utils/api';
import DisplayStudiesTableStyles from './DisplayStudiesTableStyles';

interface DisplayStudiesTableModel {
    studies: StudyApiResponse[];
}

const DisplayStudiesTable: React.FC<DisplayStudiesTableModel> = (props) => {
    const history = useHistory();

    const handleSelectTableRow = (row: Study & ReadOnly) => {
        history.push(`/studies/${row.id}`);
    };

    return (
        <TableContainer sx={DisplayStudiesTableStyles.root}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Authors</TableCell>
                        <TableCell>Journal</TableCell>
                        <TableCell>Owner</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.studies.map((row, index) => (
                        <TableRow
                            key={index}
                            sx={DisplayStudiesTableStyles.tableRow}
                            onClick={() => handleSelectTableRow(row)}
                        >
                            <TableCell>
                                <Box sx={DisplayStudiesTableStyles.tableCellTextContainer}>
                                    {row.name}
                                </Box>
                            </TableCell>
                            <TableCell>
                                {row.authors || (
                                    <Box component="span" sx={DisplayStudiesTableStyles.noContent}>
                                        No Authors Available
                                    </Box>
                                )}
                            </TableCell>
                            <TableCell>
                                <Box sx={DisplayStudiesTableStyles.tableCellTextContainer}>
                                    {row.publication || (
                                        <Box
                                            component="span"
                                            sx={DisplayStudiesTableStyles.noContent}
                                        >
                                            No Publication Available
                                        </Box>
                                    )}
                                </Box>
                            </TableCell>
                            <TableCell>
                                <Box sx={DisplayStudiesTableStyles.tableCellTextContainer}>
                                    {row.user || <span>Neurosynth</span>}
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {props.studies.length === 0 && (
                <Box sx={{ color: 'warning.dark' }}>
                    <br />
                    No results
                </Box>
            )}
        </TableContainer>
    );
};

export default DisplayStudiesTable;
