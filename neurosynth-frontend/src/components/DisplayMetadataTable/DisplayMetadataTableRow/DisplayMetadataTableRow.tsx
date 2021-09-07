import { TableCell, TableRow } from '@material-ui/core';
import React from 'react';
import DisplayMetadataTableRowStyles from './DisplayMetadataTableRowStyles';

export interface DisplayMetadataTableRowModel {
    metadataKey: string;
    metadataValue: any;
}

const getMetadataValue = (value: any): string => {
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

// filters:
/**
 * unique toggle
 * toggle to show your own studies only (public/mine)
 * filter by source (neurosynth, neurovault, neuroquery)
 *
 * green if you own it, yellow if its an original, red if it belongs to someone else
 *
 * add ability to search, move up these fields: name, description, journal name, authors
 *
 * add ownership column to table (if neurosynth owns it, then just say neurosynth original)
 *
 * name, description, journal name, authors
 *
 */
