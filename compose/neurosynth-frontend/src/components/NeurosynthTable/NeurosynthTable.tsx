import {
    Table,
    TableContainer,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    Paper,
    LinearProgress,
    Box,
    Typography,
} from '@mui/material';
import React from 'react';
import { SystemStyleObject } from '@mui/system';
import { ColorOptions } from 'index';

export interface INeurosynthTable {
    tableConfig: {
        tableHeaderBackgroundColor?: string;
        tableElevation?: number;
        isLoading?: boolean;
        loaderColor?: ColorOptions;
        noDataDisplay?: JSX.Element;
    };
    headerCells: {
        text: string;
        key: number | string;
        styles: SystemStyleObject | SystemStyleObject[];
    }[];
    rows: JSX.Element[];
}

export const getValue = (value: any): string => {
    if (value === null) {
        return 'null';
    } else if (value === undefined) {
        return 'none';
    } else {
        return value.toString();
    }
};

const NeurosynthTable: React.FC<INeurosynthTable> = React.memo((props) => {
    const { tableConfig, headerCells = [], rows = [] } = props;
    const {
        tableHeaderBackgroundColor = 'primary.main',
        tableElevation = 2,
        isLoading = false,
        loaderColor = 'primary',
        noDataDisplay = (
            <Box sx={{ padding: '1rem' }}>
                <Typography color="warning.dark">No data</Typography>
            </Box>
        ),
    } = tableConfig;

    return (
        <TableContainer component={Paper} elevation={tableElevation}>
            <Table>
                <TableHead>
                    <TableRow sx={{ backgroundColor: tableHeaderBackgroundColor }}>
                        {headerCells.map((headerCell) => (
                            <TableCell key={headerCell.key} sx={headerCell.styles}>
                                {headerCell.text}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow sx={{ display: isLoading ? 'table-row' : 'none' }}>
                        <TableCell sx={{ padding: 0 }} colSpan={headerCells.length}>
                            <Box>
                                <LinearProgress color={loaderColor} />
                            </Box>
                        </TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>{rows}</TableBody>
            </Table>
            {rows.length === 0 && noDataDisplay}
        </TableContainer>
    );
});

export default NeurosynthTable;
