import {
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Box,
    Paper,
} from '@mui/material';
import React from 'react';
import { useHistory } from 'react-router';
import { DatasetsApiResponse } from '../../../utils/api';
import DatasetsTableStyles from './DatasetsTable.styles';

export interface IDatasetsTable {
    datasets: DatasetsApiResponse[];
    tableSize?: 'small' | 'medium';
}

const DatasetsTable: React.FC<IDatasetsTable> = (props) => {
    const history = useHistory();

    const handleRowClick = (id: string) => {
        history.push(`/datasets/${id}`);
    };

    if (!props || !props.datasets || props.datasets.length === 0) return <Box>No datasets</Box>;

    return (
        <TableContainer component={Paper} elevation={3}>
            <Table size={props.tableSize || 'small'}>
                <TableHead>
                    <TableRow sx={{ backgroundColor: '#42ab55' }}>
                        <TableCell sx={DatasetsTableStyles.headerCell}>Name</TableCell>
                        <TableCell sx={DatasetsTableStyles.headerCell}># of Studies</TableCell>
                        <TableCell sx={DatasetsTableStyles.headerCell}>Description</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.datasets.map((dataset, index) => (
                        <TableRow
                            onClick={() => {
                                handleRowClick(dataset.id as string);
                            }}
                            key={dataset.id || index}
                            sx={DatasetsTableStyles.tableRow}
                        >
                            <TableCell>
                                <Box sx={!dataset.name ? { color: 'warning.dark' } : {}}>
                                    {dataset.name || 'No name'}
                                </Box>
                            </TableCell>
                            <TableCell>
                                <Box
                                    sx={
                                        (dataset.studies || []).length === 0
                                            ? { color: 'warning.dark' }
                                            : {}
                                    }
                                >
                                    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                                        {(dataset.studies || []).length}{' '}
                                        {(dataset.studies || []).length === 1 ? 'study' : 'studies'}
                                    </Box>
                                </Box>
                            </TableCell>
                            <TableCell>
                                <Box sx={!dataset.description ? { color: 'warning.dark' } : {}}>
                                    {dataset.description || 'No description'}
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DatasetsTable;
