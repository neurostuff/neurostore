import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import React from 'react';
import { DisplayMetadataTableModel, DisplayMetadataTableRowModel } from '.';
import DisplayMetadataTableRow from './DisplayMetadataTableRow/DisplayMetadataTableRow';
import { Box } from '@mui/system';

const DisplayMetadataTable: React.FC<DisplayMetadataTableModel> = (props) => {
    if (!props.metadata) {
        return (
            <Box component="span" sx={{ color: 'warning.dark' }}>
                No Metadata
            </Box>
        );
    }

    const rowData = Object.keys(props.metadata).map<DisplayMetadataTableRowModel>((key) => ({
        metadataKey: key,
        metadataValue: props.metadata[key],
    }));

    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Value</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rowData.map((row, index) => (
                        <DisplayMetadataTableRow
                            key={index}
                            metadataKey={row.metadataKey}
                            metadataValue={row.metadataValue}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DisplayMetadataTable;
