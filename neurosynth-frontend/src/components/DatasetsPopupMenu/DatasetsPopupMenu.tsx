import { AddCircle, Add } from '@mui/icons-material';
import { IconButton, MenuItem, Divider, Box, TextField, Button, MenuList } from '@mui/material';
import React, { ChangeEvent, useState, useRef } from 'react';
import { NeurosynthLoader, NeurosynthPopper } from '..';
import { DatasetsApiResponse, StudyApiResponse } from '../../utils/api';

export interface IDatasetsPopupMenu {
    datasets: DatasetsApiResponse[] | undefined;
    study: StudyApiResponse;
    onCreateDataset: (datasetName: string, datasetDescription: string) => void;
    onStudyAddedToDataset: (study: StudyApiResponse, updatedDataset: DatasetsApiResponse) => void;
}

const DatasetsPopupMenu: React.FC<IDatasetsPopupMenu> = (props) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [inCreateMode, setInCreateMode] = useState(false);
    const [datasetDetails, setDetasetDetails] = useState({
        name: '',
        description: '',
    });

    const handleClickClose = (event: MouseEvent | TouchEvent) => {
        event.stopPropagation();
        handleClose();
    };

    const handleClose = () => {
        setInCreateMode(false);
        setDetasetDetails({
            name: '',
            description: '',
        });
        setOpen(false);
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setOpen(true);
    };

    const handleDatasetDetailsChange = (
        event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
        setDetasetDetails((prevState) => ({
            ...prevState,
            [event.target.name]: event.target.value,
        }));
    };

    return (
        <>
            <IconButton onClick={handleOpenMenu} ref={anchorRef}>
                <AddCircle color="primary" />
            </IconButton>

            <NeurosynthPopper
                open={open}
                onClickAway={handleClickClose}
                anchorElement={anchorRef.current}
            >
                <MenuList>
                    <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{ padding: '6px 16px', fontSize: '1rem' }}
                    >
                        <Box sx={{ fontWeight: 'bold', marginBottom: '8px' }}>
                            Add to a dataset...
                        </Box>
                    </Box>
                    <NeurosynthLoader loadingText="fetching datasets" loaded={!!props.datasets}>
                        {props.datasets && (
                            <>
                                {props.datasets.length > 0 && <Divider />}
                                <Box sx={{ maxHeight: '300px', overflowY: 'scroll' }}>
                                    {props.datasets.map((dataset) => (
                                        <MenuItem
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                props.onStudyAddedToDataset(props.study, dataset);
                                                setOpen(false);
                                            }}
                                            key={dataset.id}
                                        >
                                            {dataset.name || dataset.id}
                                        </MenuItem>
                                    ))}
                                </Box>
                                <Divider sx={{ margin: '0 !important' }} />
                                {inCreateMode ? (
                                    <MenuItem
                                        onKeyDown={(e) => e.stopPropagation()}
                                        disableRipple
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            width: '100%',
                                        }}
                                    >
                                        <TextField
                                            name="name"
                                            onChange={handleDatasetDetailsChange}
                                            value={datasetDetails.name}
                                            sx={{ marginBottom: '0.5rem', width: '100%' }}
                                            label="Dataset name"
                                            variant="standard"
                                            id="dataset-name"
                                        />
                                        <TextField
                                            name="description"
                                            onChange={handleDatasetDetailsChange}
                                            value={datasetDetails.description}
                                            label="Dataset description"
                                            variant="standard"
                                            sx={{ width: '100%' }}
                                            id="dataset-description"
                                        />
                                        <Button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                props.onCreateDataset(
                                                    datasetDetails.name,
                                                    datasetDetails.description
                                                );
                                                handleClose();
                                            }}
                                            disabled={datasetDetails.name.length === 0}
                                            sx={{ marginTop: '1rem', width: '100%' }}
                                        >
                                            Create
                                        </Button>
                                    </MenuItem>
                                ) : (
                                    <MenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInCreateMode(true);
                                        }}
                                        sx={{ marginTop: '8px' }}
                                    >
                                        <Add sx={{ marginRight: '0.5rem' }} />
                                        Create new dataset
                                    </MenuItem>
                                )}
                            </>
                        )}
                    </NeurosynthLoader>
                </MenuList>
            </NeurosynthPopper>
        </>
    );
};

export default DatasetsPopupMenu;
