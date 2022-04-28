import { Box, Typography, Button, MenuItem, MenuList } from '@mui/material';
import { DataGrid, GridCallbackDetails, GridSelectionModel } from '@mui/x-data-grid';
import React, { useRef, useState } from 'react';
import { IEditAnalysisPoints } from '../..';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AddIcon from '@mui/icons-material/Add';
import { NeurosynthPopper } from '../../../..';

const NeurosynthDataGridHeader: React.FC<{ selectedPoints: GridSelectionModel }> = (props) => {
    const [popperIsOpen, setPopperIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleClickClose = () => {
        setPopperIsOpen(false);
    };

    return (
        <>
            {props.selectedPoints.length === 0 && <></>}
            {props.selectedPoints.length > 0 && (
                <Box
                    sx={{
                        height: '60px',
                        borderBottom: '1px solid lightgray',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <Typography sx={{ margin: '0 1rem' }} variant="h6">
                        {props.selectedPoints.length} point(s) selected
                    </Typography>

                    <Button
                        onClick={() => setPopperIsOpen(true)}
                        ref={buttonRef}
                        sx={{ margin: '0 1rem' }}
                        variant="outlined"
                        startIcon={<CompareArrowsIcon />}
                    >
                        Move points to another analysis
                    </Button>
                    <NeurosynthPopper
                        onClickAway={handleClickClose}
                        anchorElement={buttonRef.current}
                        open={popperIsOpen}
                    >
                        <MenuList>
                            <MenuItem>14646</MenuItem>
                            <MenuItem>14644</MenuItem>
                        </MenuList>
                    </NeurosynthPopper>
                </Box>
            )}
        </>
    );
};

const EditAnalysisPoints: React.FC<IEditAnalysisPoints> = (props) => {
    const [selectedPoints, setSelectedPoints] = useState<GridSelectionModel>([]);

    const handleSelection = (selected: GridSelectionModel, _details: GridCallbackDetails) => {
        setSelectedPoints(selected);
    };

    const handleDelete = () => {};

    return (
        <>
            <Button sx={{ marginBottom: '1rem' }} endIcon={<AddIcon />} variant="outlined">
                Add points to analysis
            </Button>
            <Box sx={{ height: '500px', overflow: 'auto' }}>
                <DataGrid
                    hideFooter
                    onSelectionModelChange={handleSelection}
                    checkboxSelection
                    components={{
                        Toolbar: NeurosynthDataGridHeader,
                    }}
                    componentsProps={{
                        toolbar: {
                            selectedPoints: selectedPoints,
                        },
                    }}
                    rows={[
                        {
                            id: '1',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '2',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '3',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '4',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '5',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '6',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '7',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '8',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '9',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                        {
                            id: '10',
                            x: 2,
                            y: 1,
                            z: 2,
                        },
                    ]}
                    columns={[
                        {
                            field: 'x',
                            headerName: 'X Coordinate',
                            editable: true,
                            flex: 1,
                        },
                        {
                            field: 'y',
                            headerName: 'Y Coordinate',
                            editable: true,
                            flex: 1,
                        },
                        {
                            field: 'z',
                            headerName: 'Z Coordinate',
                            editable: true,
                            flex: 1,
                        },
                        {
                            field: 'kind',
                            headerName: 'kind',
                            editable: true,
                            flex: 1.5,
                        },
                        {
                            field: 'space',
                            headerName: 'space',
                            editable: true,
                            flex: 1.5,
                        },
                        {
                            field: 'delete',
                            headerName: '',
                            editable: false,
                            width: 100,
                            renderCell: (params) => {
                                console.log(params);

                                return (
                                    <Button color="error" onClick={(_event) => {}}>
                                        Delete
                                    </Button>
                                );
                            },
                        },
                    ]}
                />
            </Box>
        </>
    );
};

export default EditAnalysisPoints;
