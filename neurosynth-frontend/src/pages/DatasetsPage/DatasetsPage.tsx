import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Typography } from '@mui/material';
import React, { useContext, useEffect, useState } from 'react';
import CreateDatasetDialog from '../../components/Dialogs/CreateDatasetDialog/CreateDatasetDialog';
import DatasetsTable from '../../components/Tables/DatasetsTable/DatasetsTable';
import { GlobalContext, SnackbarType } from '../../contexts/GlobalContext';
import API, { DatasetsApiResponse } from '../../utils/api';

const DatasetsPage: React.FC = (props) => {
    const { getAccessTokenSilently, user } = useAuth0();
    const context = useContext(GlobalContext);
    const [datasets, setDatasets] = useState<DatasetsApiResponse[]>([]);
    const [createDatasetDialogIsOpen, setCreateDatasetDialogIsOpen] = useState(false);

    useEffect(() => {
        const getDatasets = async () => {
            API.Services.DataSetsService.datasetsGet(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                user?.sub || ''
            )
                .then((res) => {
                    if (res?.data?.results) {
                        setDatasets(res.data.results);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getDatasets();
    }, [user?.sub]);

    const handleCreateDataset = async (newDatasetDetails: {
        name: string;
        description: string;
    }) => {
        try {
            const token = await getAccessTokenSilently();
            context.handleToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        // TODO: create a dataset with args
        API.Services.DataSetsService.datasetsPost()
            .then((res) => {
                const newDataset = res.data;
                setCreateDatasetDialogIsOpen(false);

                setDatasets((prevState) => {
                    const newState = [...prevState];
                    newState.push(newDataset);
                    return newState;
                });
            })
            .catch((err) => {
                console.log(err);
            });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <Typography variant="h4">My Datasets</Typography>
                <Button
                    variant="contained"
                    onClick={() => {
                        setCreateDatasetDialogIsOpen(true);
                    }}
                >
                    Create new dataset
                </Button>
            </Box>

            <CreateDatasetDialog
                onCloseDialog={() => {
                    setCreateDatasetDialogIsOpen(false);
                }}
                onCreateDataset={handleCreateDataset}
                isOpen={createDatasetDialogIsOpen}
            />

            <DatasetsTable datasets={datasets} />
        </Box>
    );
};

export default DatasetsPage;
