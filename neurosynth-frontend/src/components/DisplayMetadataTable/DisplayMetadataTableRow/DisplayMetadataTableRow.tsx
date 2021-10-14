import { TableCell, TableRow } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import { DisplayMetadataTableRowModel } from '..';
import DisplayMetadataTableRowStyles from './DisplayMetadataTableRowStyles';

export const getMetadataValue = (value: any): string => {
    if (value === null) {
        return 'null';
    } else {
        return value.toString();
    }
};

const DisplayMetadataTableRow: React.FC<DisplayMetadataTableRowModel> = (props) => {
    const type = typeof props.metadataValue;
    let typeStyle: 'type_other' | 'type_string' | 'type_number' | 'type_boolean' = 'type_other';
    switch (type) {
        case 'boolean':
            typeStyle = 'type_boolean';
            break;
        case 'string':
            typeStyle = 'type_string';
            break;
        case 'number':
            typeStyle = 'type_number';
            break;
        default:
            typeStyle = 'type_other';
            break;
    }

    const value = getMetadataValue(props.metadataValue);

    return (
        <TableRow>
            <TableCell>
                <Box component="span" sx={{ fontWeight: 'bold' }}>
                    {props.metadataKey}
                </Box>
            </TableCell>
            <TableCell sx={DisplayMetadataTableRowStyles[typeStyle]}>{value}</TableCell>
        </TableRow>
    );
};

export default DisplayMetadataTableRow;
