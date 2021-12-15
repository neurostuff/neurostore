import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Button } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useHistory } from 'react-router';
import { TextExpansion, StudiesTable, NeurosynthLoader } from '../../../components';
import TextEdit from '../../../components/TextEdit/TextEdit';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { DatasetsApiResponse, StudyApiResponse } from '../../../utils/api';
import DatasetPageStyles from './DatasetPage.styles';

const DatasetPage: React.FC = (props) => {
    const [dataset, setDataset] = useState<DatasetsApiResponse | undefined>();
    const { getAccessTokenSilently } = useAuth0();
    const history = useHistory();
    const context = useContext(GlobalContext);
    const params: { datasetId: string } = useParams();
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const getDataset = async (id: string) => {
            API.Services.DataSetsService.datasetsIdGet(id, true)
                .then((res) => {
                    if (isMountedRef.current) {
                        const receivedDataset = res.data;
                        setDataset(receivedDataset);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getDataset(params.datasetId);
    }, [params.datasetId, isMountedRef]);

    const handleSaveTextEdit = (fieldName: 'name' | 'description' | 'publication' | 'doi') => {
        return async (editedText: string) => {
            try {
                const token = await getAccessTokenSilently();
                console.log(token);

                context.handleToken(token);
            } catch (exception) {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            if (!dataset) return;

            API.Services.DataSetsService.datasetsIdPut(params.datasetId, {
                name: dataset.name,
                studies: (dataset.studies as StudyApiResponse[]).map((x) => x.id as string),
                [fieldName]: editedText,
            })
                .then(() => {
                    context.showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                    if (isMountedRef.current) {
                        setDataset((prevState) => {
                            if (!prevState) return prevState;
                            return {
                                ...prevState,
                                [fieldName]: editedText,
                            };
                        });
                    }
                })
                .catch((err) => {
                    context.showSnackbar(
                        'there was an error updating the dataset',
                        SnackbarType.ERROR
                    );
                    console.error(err);
                });
        };
    };

    const handleDeleteDataset = async (idToDelete: string | undefined) => {
        if (idToDelete) {
            try {
                const token = await getAccessTokenSilently();
                context.handleToken(token);
            } catch (exception) {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            console.log(idToDelete);

            API.Services.DataSetsService.datasetsIdDelete(idToDelete)
                .then((res) => {
                    console.log(res);
                    history.push('/datasets/userdatasets');
                    context.showSnackbar('deleted dataset', SnackbarType.SUCCESS);
                })
                .catch((err) => {
                    context.showSnackbar(
                        'there was a problem deleting the dataset',
                        SnackbarType.ERROR
                    );
                    console.error(err);
                });
        }
    };

    return (
        <NeurosynthLoader loaded={!!dataset}>
            {dataset && (
                <>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <TextEdit
                            onSave={handleSaveTextEdit('name')}
                            sx={{ fontSize: '1.25rem' }}
                            label="Name"
                            textToEdit={dataset.name || ''}
                        >
                            <Box sx={DatasetPageStyles.displayedText}>
                                <Typography
                                    sx={{
                                        ...DatasetPageStyles.displayedText,
                                        ...(!dataset.name ? DatasetPageStyles.noData : {}),
                                    }}
                                    variant="h6"
                                >
                                    {dataset.name || 'No name'}
                                </Typography>
                            </Box>
                        </TextEdit>

                        <TextEdit
                            onSave={handleSaveTextEdit('publication')}
                            label="Publication"
                            textToEdit={dataset.publication || ''}
                        >
                            <Box sx={DatasetPageStyles.displayedText}>
                                <Typography
                                    sx={{
                                        ...DatasetPageStyles.displayedText,
                                        ...(!dataset.publication ? DatasetPageStyles.noData : {}),
                                    }}
                                >
                                    {dataset.publication || 'No publication'}
                                </Typography>
                            </Box>
                        </TextEdit>
                        <TextEdit
                            label="DOI"
                            onSave={handleSaveTextEdit('doi')}
                            textToEdit={dataset.doi || ''}
                        >
                            <Box sx={DatasetPageStyles.displayedText}>
                                <Typography
                                    sx={{
                                        ...DatasetPageStyles.displayedText,
                                        ...(!dataset.doi ? DatasetPageStyles.noData : {}),
                                    }}
                                >
                                    {dataset.doi || 'No DOI'}
                                </Typography>
                            </Box>
                        </TextEdit>
                        <TextEdit
                            onSave={handleSaveTextEdit('description')}
                            label="Description"
                            textToEdit={dataset.description || ''}
                            multiline
                        >
                            <Box
                                sx={{
                                    ...DatasetPageStyles.displayedText,
                                    ...(!dataset.description ? DatasetPageStyles.noData : {}),
                                }}
                            >
                                <TextExpansion
                                    sx={{ fontSize: '12px' }}
                                    text={dataset.description || 'No description'}
                                />
                            </Box>
                        </TextEdit>
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="h6" sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                            Studies in this dataset
                        </Typography>
                    </Box>
                    <StudiesTable studies={dataset.studies as StudyApiResponse[]} />
                    <Button
                        onClick={() => handleDeleteDataset(dataset.id)}
                        variant="contained"
                        color="error"
                        sx={{ marginTop: '1rem' }}
                    >
                        Delete this dataset
                    </Button>
                </>
            )}
        </NeurosynthLoader>
    );
};

export default DatasetPage;
