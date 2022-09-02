import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    LinearProgress,
} from '@mui/material';
import { IDisplayValuesTableModel } from '.';
import DisplayValuesTableRow from './DisplayValuesTableRow/DisplayValuesTableRow';

const DisplayValuesTable: React.FC<IDisplayValuesTableModel> = (props) => {
    const {
        isLoading = false,
        rowData = [],
        selectable,
        onValueSelected = (_val) => {},
        tableHeadRowColor,
        tableHeadRowTextContrastColor,
        columnHeaders,
        paper,
        onActionSelected = (_value) => {},
    } = props;

    const noRowData = !rowData || rowData.length === 0;
    if (selectable && !onValueSelected)
        throw new Error('table is selectable but handler is not defined');

    const handleRowSelect = (selectedVal: string | number) => {
        if (selectable && onValueSelected) onValueSelected(selectedVal);
    };

    let TableInfoComponent = <></>;
    if (isLoading) {
        TableInfoComponent = (
            <Box sx={{ width: '100%', paddingBottom: props.rowData.length > 0 ? '0' : '2rem' }}>
                <LinearProgress color="primary" />
            </Box>
        );
    } else if (noRowData) {
        TableInfoComponent = <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No data</Box>;
    }

    return (
        <TableContainer component={paper ? Paper : 'div'}>
            <Table>
                <TableHead>
                    <TableRow
                        sx={{
                            backgroundColor: tableHeadRowColor ? tableHeadRowColor : 'initial',
                        }}
                    >
                        {columnHeaders.map((colHeader, index) => (
                            <TableCell
                                sx={{
                                    fontWeight: colHeader.bold ? 'bold' : 'normal',
                                    textAlign: colHeader.center ? 'center' : 'left',
                                    color: tableHeadRowTextContrastColor
                                        ? tableHeadRowTextContrastColor
                                        : 'black',
                                }}
                                key={index}
                            >
                                {colHeader.value}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ padding: 0 }} colSpan={columnHeaders.length}>
                            {TableInfoComponent}
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.rowData.map((row) => (
                        <DisplayValuesTableRow
                            onSelectAction={onActionSelected}
                            canSelectRow={!!selectable}
                            onSelectRow={handleRowSelect}
                            key={row.uniqueKey}
                            {...row}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DisplayValuesTable;
