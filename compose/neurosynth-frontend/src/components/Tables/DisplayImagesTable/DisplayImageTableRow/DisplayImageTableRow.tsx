import { Box, Collapse, IconButton, TableCell, TableRow, Typography } from '@mui/material';
import { KeyboardArrowDownRounded, KeyboardArrowUpRounded } from '@mui/icons-material';
import React, { useState } from 'react';
import { DisplayValuesTable, IDisplayValuesTableModel, DisplayImagesTableRowModel } from '../../..';
import DisplayImageTableRowStyles from './DisplayImageTableRow.styles';

const DisplayImagesTableRow: React.FC<DisplayImagesTableRowModel> = (props) => {
    const [expanded, setExpanded] = useState(false);

    const metadataForTable: IDisplayValuesTableModel = {
        columnHeaders: [
            {
                value: 'Name',
                center: false,
                bold: false,
            },
            {
                value: 'Value',
                center: false,
                bold: false,
            },
        ],
        rowData: Object.entries(props.image?.metadata || {}).map(([key, value]) => ({
            uniqueKey: key,
            columnValues: [
                {
                    value: key,
                    colorByType: false,
                    center: false,
                    bold: true,
                },
                {
                    value: value,
                    colorByType: true,
                    center: false,
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
                sx={[
                    DisplayImageTableRowStyles.root,
                    props.active ? DisplayImageTableRowStyles.selected : {},
                ]}
            >
                <TableCell>
                    <IconButton
                        onClick={(event) => {
                            // prevent event from bubbling up and triggering a click event in the parent
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
