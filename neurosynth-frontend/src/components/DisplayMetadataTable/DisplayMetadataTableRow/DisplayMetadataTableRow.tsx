import { TableCell, TableRow } from '@mui/material';
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
    const classes = DisplayMetadataTableRowStyles();
    const type = typeof props.metadataValue;
    let className: 'type_other' | 'type_string' | 'type_number' | 'type_boolean' = 'type_other';
    switch (type) {
        case 'boolean':
            className = 'type_boolean';
            break;
        case 'string':
            className = 'type_string';
            break;
        case 'number':
            className = 'type_number';
            break;
        default:
            className = 'type_other';
            break;
    }

    const value = getMetadataValue(props.metadataValue);

    return (
        <TableRow>
            <TableCell>
                <span>
                    <b>{props.metadataKey}</b>
                </span>
            </TableCell>
            <TableCell className={classes[className]}>{value}</TableCell>
        </TableRow>
    );
};

export default DisplayMetadataTableRow;
