import { useAuth0 } from '@auth0/auth0-react';
import { AddCircle, Add } from '@mui/icons-material';
import { IconButton, MenuItem, Divider, Box, TextField, Button, MenuList } from '@mui/material';
import React, { ChangeEvent, useContext, useState, useRef } from 'react';
import { NeurosynthLoader, NeurosynthPopper } from '..';
import { GlobalContext, SnackbarType } from '../../contexts/GlobalContext';
import useIsMounted from '../../hooks/useIsMounted';
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
    const isMountedRef = useIsMounted();
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

                if (isMountedRef.current) setOpen(false);
            })
            .catch((err) => {
                console.error(err);
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                if (isMountedRef.current) setOpen(false);
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

        const selectedDatasetStudies = [...selectedDataset.studies] as StudyApiResponse[];

        selectedDatasetStudies.push(props.study);

        const selectedDatasetStudyIds = selectedDatasetStudies.map((study) => study.id);
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
                if (isMountedRef.current) setOpen(false);
            })
            .catch((err) => {
                console.error(err);
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                if (isMountedRef.current) setOpen(false);
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
                                <Box sx={{ maxHeight: '300px', overflowY: 'scroll' }}>
                                    {props.datasets.map((dataset) => (
                                        <MenuItem
                                            onClick={(event) => handleClickDataset(event, dataset)}
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
                                        />
                                        <TextField
                                            name="description"
                                            onChange={handleDatasetDetailsChange}
                                            value={datasetDetails.description}
                                            label="Dataset description"
                                            variant="standard"
                                            sx={{ width: '100%' }}
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
        </>
    );
};

export default DatasetsPopupMenu;
