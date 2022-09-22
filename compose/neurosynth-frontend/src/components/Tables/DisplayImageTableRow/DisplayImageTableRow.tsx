import { Box, Collapse, IconButton, TableCell, TableRow, Typography } from '@mui/material';
import KeyboardArrowUpRounded from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import React, { useState } from 'react';
import DisplayImageTableRowStyles from './DisplayImageTableRow.styles';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { ImageReturn } from 'neurostore-typescript-sdk';

export interface IDisplayImageTableRow {
    onRowSelect: (selectedImage: ImageReturn | undefined) => void;
    image: ImageReturn;
    active: boolean;
}

const DisplayImageTableRow: React.FC<IDisplayImageTableRow> = (props) => {
    const [expanded, setExpanded] = useState(false);

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
                        <Typography
                            variant="subtitle1"
                            sx={{ marginTop: '10px', marginLeft: '15px', fontWeight: 'bold' }}
                        >
                            Image Metadata
                        </Typography>
                        <Box sx={{ marginBottom: '20px' }}>
                            <NeurosynthTable
                                tableConfig={{
                                    tableHeaderBackgroundColor: 'transparent',
                                    tableElevation: 0,
                                    noDataDisplay: (
                                        <Typography color="warning.dark" sx={{ padding: '1rem' }}>
                                            No image metadata
                                        </Typography>
                                    ),
                                }}
                                headerCells={[
                                    {
                                        text: 'Name',
                                        key: 'name',
                                        styles: {},
                                    },
                                    {
                                        text: 'Values',
                                        key: 'values',
                                        styles: {},
                                    },
                                ]}
                                rows={Object.entries(props.image?.metadata || {}).map(
                                    ([key, value]) => (
                                        <TableRow key={key}>
                                            <TableCell>{key}</TableCell>
                                            <TableCell>{value}</TableCell>
                                        </TableRow>
                                    )
                                )}
                            />
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

export default DisplayImageTableRow;
