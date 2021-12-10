import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, Button } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { NeurosynthLoader } from '../../../components';
import CreateDatasetDialog from '../../../components/Dialogs/CreateDatasetDialog/CreateDatasetDialog';
import DatasetsTable from '../../../components/Tables/DatasetsTable/DatasetsTable';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { DatasetsApiResponse } from '../../../utils/api';

const UserDatasetsPage: React.FC = (props) => {
    const { user, getAccessTokenSilently } = useAuth0();
    const [datasets, setDatasets] = useState<DatasetsApiResponse[]>();
    const context = useContext(GlobalContext);
    const [createDatasetDialogIsOpen, setCreateDatasetDialogIsOpen] = useState(false);
    const isMountedRef = useIsMounted();

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
                user?.sub
            )
                .then((res) => {
                    if (isMountedRef.current && res?.data?.results) {
                        setDatasets(res.data.results);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getDatasets();
    }, [user?.sub, isMountedRef]);

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

        API.Services.DataSetsService.datasetsPost()
            .then((res) => {
                const newDataset = res.data;
                setCreateDatasetDialogIsOpen(false);

                if (isMountedRef.current) {
                    setDatasets((prevState) => {
                        if (!prevState) return prevState;
                        const newState = [...prevState];
                        newState.push(newDataset);
                        return newState;
                    });
                }
            })
            .catch((err) => {
                console.log(err);
            });
    };

    return (
        <NeurosynthLoader loaded={!!datasets}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                }}
            >
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

            <DatasetsTable tableSize="medium" datasets={datasets || []} />
        </NeurosynthLoader>
    );
};

export default UserDatasetsPage;
