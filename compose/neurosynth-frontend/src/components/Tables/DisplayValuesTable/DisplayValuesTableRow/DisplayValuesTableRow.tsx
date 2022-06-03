import { TableCell, TableRow, Button, Box } from '@mui/material';
import React from 'react';
import { IDisplayValuesTableRowModel } from '..';
import { getType } from 'components/EditMetadata';
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

const DisplayMetadataTableRow: React.FC<IDisplayValuesTableRowModel> = (props) => {
    const handleRowSelect = (event: React.MouseEvent) => {
        if (props.canSelectRow) props.onSelectRow(props.uniqueKey);
    };

    return (
        <TableRow
            onClick={handleRowSelect}
            sx={props.canSelectRow ? DisplayValuesTableRowStyles.selectableRow : {}}
        >
            {props.columnValues.map((col, index) => {
                let typedStyles: any;
                if (col.shouldHighlightNoData) {
                    typedStyles = { color: 'warning.dark' };
                } else if (col.colorByType) {
                    typedStyles = DisplayValuesTableRowStyles[getType(col.value)];
                } else {
                    typedStyles = {};
                }

                return (
                    <TableCell key={index} sx={{ textAlign: col.center ? 'center' : 'left' }}>
                        {col.isAction ? (
                            <Button
                                onClick={() => props.onSelectAction(`${props.uniqueKey}`)}
                                color={col.actionStyling}
                            >
                                {getValue(col.value)}
                            </Button>
                        ) : (
                            <Box
                                component="span"
                                sx={[
                                    { fontWeight: col.bold ? 'bold' : 'normal' },
                                    DisplayValuesTableRowStyles.root,
                                    typedStyles,
                                ]}
                            >
                                {getValue(col.value)}
                            </Box>
                        )}
                    </TableCell>
                );
            })}
        </TableRow>
    );
};

export default DisplayMetadataTableRow;
