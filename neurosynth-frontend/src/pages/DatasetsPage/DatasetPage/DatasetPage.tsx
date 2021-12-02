import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Button } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { TextExpansion, StudiesTable } from '../../../components';
import TextEdit from '../../../components/TextEdit/TextEdit';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API, { DatasetsApiResponse, StudyApiResponse } from '../../../utils/api';
import DatasetPageStyles from './DatasetPage.styles';

const DatasetPage: React.FC = (props) => {
    const [dataset, setDataset] = useState<DatasetsApiResponse>();
    const { getAccessTokenSilently } = useAuth0();
    const context = useContext(GlobalContext);
    const params: { datasetId: string } = useParams();

    useEffect(() => {
        const getDataset = async (id: string) => {
            API.Services.DataSetsService.datasetsIdGet(id, true)
                .then((res) => {
                    const receivedDataset = res.data;
                    setDataset(receivedDataset);
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getDataset(params.datasetId);
    }, [params.datasetId]);

    const handleSaveTextEdit = (fieldName: 'name' | 'description' | 'publication' | 'doi') => {
        return async (editedText: string) => {
            try {
                const token = await getAccessTokenSilently();
                context.handleToken(token);
            } catch (exception) {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            API.Services.DataSetsService.datasetsIdPut(params.datasetId, {
                name: (dataset as DatasetsApiResponse).name,
                studies: (dataset as DatasetsApiResponse).studies,
                [fieldName]: editedText,
            })
                .then(() => {
                    context.showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                    setDataset((prevState) => {
                        if (!prevState) return prevState;
                        return {
                            ...prevState,
                            [fieldName]: editedText,
                        };
                    });
                })
                .catch((err) => {
                    context.showSnackbar(
                        'there was an error updating the analysis',
                        SnackbarType.ERROR
                    );
                    console.error(err);
                });
        };
    };

    // const values =

    return (
        <>
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
                        <Typography
                            variant="h6"
                            sx={{ marginBottom: '1rem', fontWeight: 'bold', margin: 'auto 0' }}
                        >
                            Studies in this dataset
                        </Typography>
                        <Button variant="contained" color="error">
                            Delete this dataset
                        </Button>
                    </Box>
                    <StudiesTable studies={dataset.studies as StudyApiResponse[]} />
                </>
            )}
        </>
    );
};

export default DatasetPage;
