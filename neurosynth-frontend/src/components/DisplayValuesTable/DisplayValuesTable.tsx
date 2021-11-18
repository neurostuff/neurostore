import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box } from '@mui/system';
import { IDisplayValuesTableModel } from '.';
import DisplayValuesTableRow from './DisplayValuesTableRow/DisplayValuesTableRow';

const DisplayValuesTable: React.FC<IDisplayValuesTableModel> = (props) => {
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
                        {props.columnHeaders.map((colHeader, index) => (
                            <TableCell
                                sx={{
                                    fontWeight: colHeader.bold ? 'bold' : 'normal',
                                    textAlign: colHeader.center ? 'center' : 'left',
                                }}
                                key={index}
                            >
                                {colHeader.value}
                            </TableCell>
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
