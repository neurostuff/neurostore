import { useAuth0 } from '@auth0/auth0-react';
import { AddCircle, Add } from '@mui/icons-material';
import { IconButton, MenuItem, Divider, Box, TextField, Button, MenuList } from '@mui/material';
import React, { ChangeEvent, useContext, useState, useRef } from 'react';
import { NeurosynthLoader, NeurosynthPopper } from '..';
import { GlobalContext, SnackbarType } from '../../contexts/GlobalContext';
import API, { DatasetsApiResponse, StudyApiResponse } from '../../utils/api';

export interface IDatasetsPopupMenu {
    datasets: DatasetsApiResponse[] | undefined;
    study: StudyApiResponse;
    onDatasetCreated: (createdDataset: DatasetsApiResponse) => void;
}

const DatasetsPopupMenu: React.FC<IDatasetsPopupMenu> = (props) => {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const { getAccessTokenSilently } = useAuth0();
    const [inCreateMode, setInCreateMode] = useState(false);
    const context = useContext(GlobalContext);
    const [datasetDetails, setDetasetDetails] = useState({
        name: '',
        description: '',
    });

    const handleClickClose = (event: MouseEvent | TouchEvent) => {
        event.stopPropagation();

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

    const handleCreateDataset = async (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        try {
            const token = await getAccessTokenSilently();
            context.handleToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }
        API.Services.DataSetsService.datasetsPost()
            .then((res) => {
                props.onDatasetCreated(res.data);

                context.showSnackbar('dataset created', SnackbarType.SUCCESS);
                setOpen(false);
            })
            .catch((err) => {
                console.error(err);
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                setOpen(false);
            });
    };

    const handleClickDataset = async (
        event: React.MouseEvent,
        selectedDataset: DatasetsApiResponse
    ) => {
        event.stopPropagation();
        if (!selectedDataset.id) return;
        try {
            const token = await getAccessTokenSilently();
            context.handleToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        selectedDataset.studies.push(props.study);

        const selectedDatasetStudyIds = (selectedDataset.studies as StudyApiResponse[]).map(
            (study) => study.id
        );
        selectedDatasetStudyIds.push(props.study.id);

        API.Services.DataSetsService.datasetsIdPut(selectedDataset.id, {
            name: selectedDataset.name,
            studies: selectedDatasetStudyIds as string[],
        })
            .then((res) => {
                context.showSnackbar(
                    `study added to ${selectedDataset.name || selectedDataset.id}`,
                    SnackbarType.SUCCESS
                );
                setOpen(false);
            })
            .catch((err) => {
                console.error(err);
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                setOpen(false);
            });
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
                                {props.datasets.map((dataset) => (
                                    <MenuItem
                                        onClick={(event) => handleClickDataset(event, dataset)}
                                        key={dataset.id}
                                    >
                                        {dataset.name || dataset.id}
                                    </MenuItem>
                                ))}
                                <Divider sx={{ margin: '0 !important' }} />
                                {inCreateMode ? (
                                    <MenuItem
                                        onKeyDown={(e) => e.stopPropagation()}
                                        disableRipple
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <TextField
                                            name="name"
                                            onChange={handleDatasetDetailsChange}
                                            value={datasetDetails.name}
                                            sx={{ marginBottom: '0.5rem' }}
                                            label="Dataset name"
                                            variant="standard"
                                        />
                                        <TextField
                                            name="description"
                                            onChange={handleDatasetDetailsChange}
                                            value={datasetDetails.description}
                                            label="Dataset description"
                                            variant="standard"
                                        />
                                        <Button
                                            onClick={handleCreateDataset}
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

            {/* <Popper
                style={{ zIndex: 1 }}
                anchorEl={anchorRef.current}
                open={open}
                disablePortal
                transition
                placement="bottom-start"
            >
                {({ TransitionProps, placement }) => (
                    <Grow
                        {...TransitionProps}
                        style={{
                            transformOrigin:
                                placement === 'bottom-start' ? 'left-top' : 'left-bottom',
                        }}
                    >
                        <Paper>
                            <ClickAwayListener onClickAway={handleClickClose}>
                                <MenuList>
                                    <Box
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{ padding: '6px 16px', fontSize: '1rem' }}
                                    >
                                        <Box sx={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                            Add to a dataset...
                                        </Box>
                                    </Box>
                                    {!props.datasets ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                            <CircularProgress />
                                        </Box>
                                    ) : (
                                        <>
                                            {props.datasets.length > 0 && <Divider />}
                                            {props.datasets.map((dataset) => (
                                                <MenuItem
                                                    onClick={(event) =>
                                                        handleClickDataset(event, dataset)
                                                    }
                                                    key={dataset.id}
                                                >
                                                    {dataset.name || dataset.id}
                                                </MenuItem>
                                            ))}
                                            <Divider sx={{ margin: '0 !important' }} />
                                            {inCreateMode ? (
                                                <MenuItem
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    disableRipple
                                                    onClick={(e) => e.stopPropagation()}
                                                    sx={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                    }}
                                                >
                                                    <TextField
                                                        name="name"
                                                        onChange={handleDatasetDetailsChange}
                                                        value={datasetDetails.name}
                                                        sx={{ marginBottom: '0.5rem' }}
                                                        label="Dataset name"
                                                        variant="standard"
                                                    />
                                                    <TextField
                                                        name="description"
                                                        onChange={handleDatasetDetailsChange}
                                                        value={datasetDetails.description}
                                                        label="Dataset description"
                                                        variant="standard"
                                                    />
                                                    <Button
                                                        onClick={handleCreateDataset}
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
                                </MenuList>
                            </ClickAwayListener>
                        </Paper>
                    </Grow>
                )}
            </Popper> */}
        </>
    );
};

export default DatasetsPopupMenu;
