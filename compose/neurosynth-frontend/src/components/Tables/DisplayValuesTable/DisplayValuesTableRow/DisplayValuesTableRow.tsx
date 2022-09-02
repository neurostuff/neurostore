import { TableCell, TableRow, Button, Box } from '@mui/material';
import React from 'react';
import { IDisplayValuesTableRowModel } from '..';
import { getType } from 'components/EditMetadata';
import DisplayValuesTableRowStyles from './DisplayValuesTableRow.styles';
import TextExpansion from 'components/TextExpansion/TextExpansion';

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
                let typedStyles: any = {};
                if (col.shouldHighlightNoData) {
                    typedStyles = { color: 'warning.dark' };
                } else if (col.colorByType) {
                    typedStyles = DisplayValuesTableRowStyles[getType(col.value)];
                }

                return (
                    <TableCell
                        key={index}
                        sx={[
                            { textAlign: col.center ? 'center' : 'left' },
                            col.width ? { width: `${col.width}%` } : {},
                            col.noWrap ? { whiteSpace: 'nowrap' } : {},
                        ]}
                    >
                        {col.isAction ? (
                            <Button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    props.onSelectAction(`${props.uniqueKey}`);
                                }}
                                color={col.actionStyling}
                            >
                                {getValue(col.value)}
                            </Button>
                        ) : col.expandable ? (
                            <TextExpansion text={getValue(col.value)} />
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
