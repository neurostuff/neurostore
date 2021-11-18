import { TableCell, TableRow } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import { IDisplayValuesTableRowModel } from '..';
import { EPropertyType } from '../..';
import DisplayValuesTableRowStyles from './DisplayValuesTableRow.styles';

const getValue = (value: any): string => {
    if (value === null) {
        return 'null';
    } else if (value === undefined) {
        return 'none';
    } else {
        return value.toString();
    }
};

const getType = (value: any): EPropertyType => {
    const type = typeof value;
    switch (type) {
        case EPropertyType.BOOLEAN:
            return EPropertyType.BOOLEAN;
        case EPropertyType.STRING:
            return EPropertyType.STRING;
        case EPropertyType.NUMBER:
            return EPropertyType.NUMBER;
        default:
            return EPropertyType.NONE;
    }
};

const DisplayMetadataTableRow: React.FC<IDisplayValuesTableRowModel> = (props) => {
    return (
        <TableRow>
            {props.columnValues.map((col, index) => {
                const typedStyles = col.colorByType
                    ? DisplayValuesTableRowStyles[getType(col.value)]
                    : {};

                return (
                    <TableCell key={index} sx={{ textAlign: col.center ? 'center' : 'left' }}>
                        <Box
                            component="span"
                            sx={{
                                fontWeight: col.bold ? 'bold' : 'normal',
                                ...DisplayValuesTableRowStyles.root,
                                ...typedStyles,
                            }}
                        >
                            {getValue(col.value)}
                        </Box>
                    </TableCell>
                );
            })}
        </TableRow>
    );
};

export default DisplayMetadataTableRow;
