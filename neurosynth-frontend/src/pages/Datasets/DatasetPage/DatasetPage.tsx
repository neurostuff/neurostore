import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Button } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useHistory } from 'react-router';
import {
    TextExpansion,
    StudiesTable,
    NeurosynthLoader,
    ConfirmationDialog,
    CreateDetailsDialog,
} from '../../../components';
import AnnotationsTable from '../../../components/Tables/AnnotationsTable/AnnotationsTable';
import TextEdit from '../../../components/TextEdit/TextEdit';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { AnnotationNote } from '../../../gen/api';
import useIsMounted from '../../../hooks/useIsMounted';
import API, {
    AnalysisApiResponse,
    AnnotationsApiResponse,
    DatasetsApiResponse,
    StudyApiResponse,
} from '../../../utils/api';
import DatasetPageStyles from './DatasetPage.styles';

const DatasetPage: React.FC = (props) => {
    const [dataset, setDataset] = useState<DatasetsApiResponse | undefined>();
    const [annotations, setAnnotations] = useState<AnnotationsApiResponse[] | undefined>();
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();
    const history = useHistory();
    const { showSnackbar, handleToken } = useContext(GlobalContext);

    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);
    const [createDetailsIsOpen, setCreateDetailsIsOpen] = useState(false);

    const params: { datasetId: string } = useParams();
    const { current } = useIsMounted();

    useEffect(() => {
        const getDataset = async (id: string) => {
            API.Services.DataSetsService.datasetsIdGet(id, true)
                .then((res) => {
                    if (current) {
                        const receivedDataset = res.data;
                        setDataset(receivedDataset);
                    }
                })
                .catch((err) => {
                    console.error(err);
                    showSnackbar('there was an error', SnackbarType.ERROR);
                });
        };

        getDataset(params.datasetId);
    }, [params.datasetId, current, showSnackbar]);

    useEffect(() => {
        const getAnnotations = async (id: string) => {
            API.Services.AnnotationsService.annotationsGet(id).then(
                (res) => {
                    if (current && res?.data?.results) {
                        setAnnotations(res.data.results);
                    }
                },
                (err) => {
                    console.error(err);
                    showSnackbar(
                        'there was an error getting annotations for this dataset',
                        SnackbarType.ERROR
                    );
                }
            );
        };

        if (params.datasetId) getAnnotations(params.datasetId);
    }, [params.datasetId, showSnackbar, current]);

    const handleSaveTextEdit = (fieldName: 'name' | 'description' | 'publication' | 'doi') => {
        return async (editedText: string) => {
            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            if (!dataset) return;

            API.Services.DataSetsService.datasetsIdPut(params.datasetId, {
                name: dataset.name,
                studies: (dataset.studies as StudyApiResponse[]).map((x) => x.id as string),
                [fieldName]: editedText,
            })
                .then(() => {
                    showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                    if (current) {
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
                    showSnackbar('there was an error updating the dataset', SnackbarType.ERROR);
                    console.error(err);
                });
        };
    };

    const handleCloseDialog = async (confirm: boolean | undefined) => {
        setConfirmationIsOpen(false);

        if (dataset?.id && confirm) {
            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }
            API.Services.DataSetsService.datasetsIdDelete(dataset.id)
                .then((res) => {
                    history.push('/datasets/userdatasets');
                    showSnackbar('deleted dataset', SnackbarType.SUCCESS);
                })
                .catch((err) => {
                    showSnackbar('there was a problem deleting the dataset', SnackbarType.ERROR);
                    console.error(err);
                });
        }
    };

    const handleCreateAnnotation = async (name: string, description: string) => {
        if (dataset && dataset?.id) {
            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            const notes: AnnotationNote[] = (dataset.studies as StudyApiResponse[]).reduce(
                (total: AnnotationNote[], curr) => {
                    const convertedNotes: AnnotationNote[] = (
                        curr.analyses as AnalysisApiResponse[]
                    ).map((analysis) => ({
                        analysis: analysis.id,
                        study: analysis.study,
                        note: {},
                    }));

                    return total.concat(convertedNotes);
                },
                []
            );

            API.Services.AnnotationsService.annotationsPost('neurosynth', undefined, {
                name,
                description,
                notes: [
                    {
                        analysis: 'abc',
                        study: 'abc',
                        annotation: 'abc',
                        note: {},
                    },
                ], // TODO: discuss how handling of annotations will work in order to stay up to date with studies that are added/removed
                dataset: params.datasetId,
            })
                .then((res) => {
                    showSnackbar('successfully created annotation', SnackbarType.SUCCESS);
                    setAnnotations((prevState) => {
                        if (!prevState) return prevState;
                        const newState = [...prevState];
                        newState.push(res.data);
                        return newState;
                    });
                })
                .catch((err) => {
                    showSnackbar('there was a problem getting annotations', SnackbarType.ERROR);
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

                    <Box sx={{ marginBottom: '1rem' }}>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '1rem',
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{ marginBottom: '1rem', fontWeight: 'bold', margin: 'auto 0' }}
                            >
                                Annotations for this dataset
                            </Typography>
                            <Button
                                onClick={() => setCreateDetailsIsOpen(true)}
                                color="primary"
                                variant="contained"
                                disabled={!isAuthenticated}
                            >
                                Create new Annotation
                            </Button>
                            <CreateDetailsDialog
                                titleText="Create new Annotation"
                                isOpen={createDetailsIsOpen}
                                onCreate={handleCreateAnnotation}
                                onCloseDialog={() => setCreateDetailsIsOpen(false)}
                            />
                        </Box>
                        <AnnotationsTable
                            datasetId={params.datasetId}
                            annotations={annotations || []}
                        />
                    </Box>

                    <Box>
                        <Typography variant="h6" sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                            Studies in this dataset
                        </Typography>
                    </Box>
                    <StudiesTable studies={dataset.studies as StudyApiResponse[]} />
                    <Button
                        onClick={() => setConfirmationIsOpen(true)}
                        variant="contained"
                        color="error"
                        sx={{ marginTop: '1rem' }}
                        disabled={!isAuthenticated}
                    >
                        Delete this dataset
                    </Button>
                    <ConfirmationDialog
                        message="Are you sure you want to delete the dataset?"
                        confirmText="Yes"
                        rejectText="No"
                        isOpen={confirmationIsOpen}
                        onCloseDialog={handleCloseDialog}
                    />
                </>
            )}
        </NeurosynthLoader>
    );
};

export default DatasetPage;
