import { useAuth0 } from '@auth0/auth0-react';
import { AddCircle, Add } from '@mui/icons-material';
import { IconButton, MenuItem, Menu, Divider, Box, TextField, Button } from '@mui/material';
import React, { ChangeEvent, useContext, useState } from 'react';
import { GlobalContext, SnackbarType } from '../../contexts/GlobalContext';
import API, { DatasetsApiResponse, StudyApiResponse } from '../../utils/api';
import DatasetsPopupMenuStyles from './DatasetsPopupMenu.styles';

export interface IDatasetsPopupMenu {
    datasets: DatasetsApiResponse[];
    study: StudyApiResponse;
    onDatasetCreated: (createdDataset: DatasetsApiResponse) => void;
}

const DatasetsPopupMenu: React.FC<IDatasetsPopupMenu> = (props) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const { getAccessTokenSilently } = useAuth0();
    const [inCreateMode, setInCreateMode] = useState(false);
    const open = Boolean(anchorEl);
    const context = useContext(GlobalContext);
    const [datasetDetails, setDetasetDetails] = useState({
        name: '',
        description: '',
    });

    const handleClose = (event: {}, reason: string) => {
        if (reason === 'tabKeyDown') return;
        setAnchorEl(null);
    };

    const handleClickClose = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setInCreateMode(false);
        setDetasetDetails({
            name: '',
            description: '',
        });
        setAnchorEl(null);
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
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
                setAnchorEl(null);
            })
            .catch((err) => {
                console.error(err);
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                setAnchorEl(null);
            });
    };

    const handleClickDataset = async (selectedDataset: DatasetsApiResponse) => {
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
                setAnchorEl(null);
            })
            .catch((err) => {
                console.error(err);
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                setAnchorEl(null);
            });
    };

    return (
        <>
            <IconButton onClick={handleOpenMenu}>
                <AddCircle color="primary" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose} onClick={handleClickClose}>
                <Box sx={{ padding: '6px 16px', fontSize: '1rem' }}>
                    <Box sx={{ fontWeight: 'bold' }}>Add to a dataset...</Box>
                </Box>
                {props.datasets.length > 0 && <Divider />}
                {props.datasets.map((dataset) => (
                    <MenuItem onClick={() => handleClickDataset(dataset)} key={dataset.id}>
                        {dataset.name || dataset.id}
                    </MenuItem>
                ))}
                <Divider sx={{ margin: '0 !important' }} />
                {inCreateMode ? (
                    <MenuItem
                        onKeyDown={(e) => e.stopPropagation()}
                        disableRipple
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'flex', flexDirection: 'column' }}
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
                    >
                        <Add sx={{ marginRight: '1rem' }} />
                        Create new dataset
                    </MenuItem>
                )}
            </Menu>
        </>
    );
};

export default DatasetsPopupMenu;
