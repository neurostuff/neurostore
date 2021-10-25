import { Box, Collapse, IconButton, TableCell, TableRow, Typography } from '@mui/material';
import { KeyboardArrowDownRounded, KeyboardArrowUpRounded } from '@mui/icons-material';
import React, { useState } from 'react';
import { DisplayValuesTable, DisplayValuesTableModel } from '../..';
import DisplayImageTableRowStyles from './DisplayImageTableRowStyles';
import { DisplayImagesTableRowModel } from '..';

const DisplayImagesTableRow: React.FC<DisplayImagesTableRowModel> = (props) => {
    const [expanded, setExpanded] = useState(false);

    const metadataForTable: DisplayValuesTableModel = {
        columnHeaders: ['Name', 'Value'],
        rowData: Object.entries(props.image?.metadata || {}).map(([key, value]) => ({
            uniqueKey: key,
            columnValues: [
                {
                    value: key,
                    colorByType: false,
                    bold: true,
                },
                {
                    value: value,
                    colorByType: true,
                    bold: true,
                },
            ],
        })),
    };

    return (
        <>
            <TableRow
                onClick={() => {
                    props.onRowSelect(props.image);
                }}
                sx={{
                    ...DisplayImageTableRowStyles.root,
                    ...(props.active ? DisplayImageTableRowStyles.selected : {}),
                }}
            >
                <TableCell>
                    <IconButton
                        onClick={(event) => {
                            // prevent click from bubbling up and triggering a select event
                            event.stopPropagation();
                            setExpanded(!expanded);
                        }}
                    >
                        {expanded ? <KeyboardArrowUpRounded /> : <KeyboardArrowDownRounded />}
                    </IconButton>
                </TableCell>
                <TableCell>{props.image.value_type}</TableCell>
                <TableCell>{props.image.space}</TableCell>
            </TableRow>
            <TableRow>
                <TableCell sx={{ paddingBottom: 0, paddingTop: 0 }} colSpan={3}>
                    <Collapse in={expanded}>
                        <Typography variant="subtitle2" sx={{ margin: '5px 0' }}>
                            <b>Image Metadata</b>
                        </Typography>
                        <Box sx={{ marginBottom: '20px' }}>
                            <DisplayValuesTable {...metadataForTable} />
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

export default DisplayImagesTableRow;
