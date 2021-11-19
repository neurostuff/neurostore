import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box } from '@mui/system';
import { DisplayValuesTableModel } from '.';
import DisplayValuesTableRow from './DisplayValuesTableRow/DisplayValuesTableRow';

const DisplayValuesTable: React.FC<DisplayValuesTableModel> = (props) => {
    if (
        !props.rowData ||
        props.rowData.length === 0 ||
        !props.columnHeaders ||
        props.columnHeaders.length === 0
    ) {
        return (
            <Box component="span" sx={{ color: 'warning.dark' }}>
                No data
            </Box>
        );
    }

    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {props.columnHeaders.map((header, index) => (
                            <TableCell key={index}>{header}</TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.rowData.map((row) => (
                        <DisplayValuesTableRow key={row.uniqueKey} {...row} />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DisplayValuesTable;
