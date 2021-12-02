import {
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Box,
} from '@mui/material';
import React from 'react';
import { useHistory } from 'react-router';
import { DatasetsApiResponse } from '../../../utils/api';
import DatasetsTableStyles from './DatasetsTable.styles';

export interface IDatasetsTable {
    datasets: DatasetsApiResponse[];
}

const DatasetsTable: React.FC<IDatasetsTable> = (props) => {
    const history = useHistory();

    const handleRowClick = (id: string) => {
        history.push(`/datasets/${id}`);
    };

    if (!props || !props.datasets || props.datasets.length === 0) return <Box>No datasets</Box>;

    return (
        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Description</TableCell>
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
