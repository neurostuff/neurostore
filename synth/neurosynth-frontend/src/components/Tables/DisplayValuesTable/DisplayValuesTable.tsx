import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';
import { Box } from '@mui/system';
import { IDisplayValuesTableModel } from '.';
import DisplayValuesTableRow from './DisplayValuesTableRow/DisplayValuesTableRow';

const DisplayValuesTable: React.FC<IDisplayValuesTableModel> = (props) => {
    const noRowData = !props.rowData || props.rowData.length === 0;
    if (props.selectable && !props.onValueSelected)
        throw new Error('table is selectable but handler is not defined');

    const handleRowSelect = (selectedVal: string | number) => {
        if (props.selectable && props.onValueSelected) props.onValueSelected(selectedVal);
    };

    return (
        <TableContainer component={props.paper ? Paper : 'div'}>
            <Table size="small">
                <TableHead>
                    <TableRow
                        sx={{
                            backgroundColor: props.tableHeadRowColor
                                ? props.tableHeadRowColor
                                : 'initial',
                        }}
                    >
                        {props.columnHeaders.map((colHeader, index) => (
                            <TableCell
                                sx={{
                                    fontWeight: colHeader.bold ? 'bold' : 'normal',
                                    textAlign: colHeader.center ? 'center' : 'left',
                                    color: props.tableHeadRowTextContrastColor
                                        ? props.tableHeadRowTextContrastColor
                                        : 'black',
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
                        <DisplayValuesTableRow
                            canSelectRow={!!props.selectable}
                            onSelectRow={handleRowSelect}
                            key={row.uniqueKey}
                            {...row}
                        />
                    ))}
                </TableBody>
            </Table>
            {noRowData && <Box sx={{ color: 'warning.dark', padding: '0.5rem 1rem' }}>No data</Box>}
        </TableContainer>
    );
};

export default DisplayValuesTable;
