import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Button } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useHistory } from 'react-router';
import AddIcon from '@mui/icons-material/Add';
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
import useIsMounted from '../../../hooks/useIsMounted';
import API, {
    AnnotationsApiResponse,
    StudysetsApiResponse,
    StudyApiResponse,
} from '../../../utils/api';
import StudysetPageStyles from './StudysetPage.styles';

const StudysetsPage: React.FC = (props) => {
    const [studyset, setStudyset] = useState<StudysetsApiResponse | undefined>();
    const [annotations, setAnnotations] = useState<AnnotationsApiResponse[] | undefined>();
    const { isAuthenticated } = useAuth0();
    const history = useHistory();
    const { showSnackbar } = useContext(GlobalContext);

    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);
    const [createDetailsIsOpen, setCreateDetailsIsOpen] = useState(false);

    const params: { studysetId: string } = useParams();
    const { current } = useIsMounted();

    useEffect(() => {
        const getStudyset = async (id: string) => {
            API.NeurostoreServices.StudySetsService.studysetsIdGet(id, true)
                .then((res) => {
                    if (current) {
                        const receivedStudyset = res.data;
                        setStudyset(receivedStudyset);
                    }
                })
                .catch((err) => {
                    console.error(err);
                    setStudyset({});
                    showSnackbar('there was an error', SnackbarType.ERROR);
                });
        };

        getStudyset(params.studysetId);
    }, [params.studysetId, current, showSnackbar]);

    useEffect(() => {
        const getAnnotations = async (id: string) => {
            API.NeurostoreServices.AnnotationsService.annotationsGet(id).then(
                (res) => {
                    if (current && res?.data?.results) {
                        setAnnotations(res.data.results);
                    }
                },
                (err) => {
                    console.error(err);
                    setAnnotations([]);
                    showSnackbar(
                        'there was an error getting annotations for this studyset',
                        SnackbarType.ERROR
                    );
                }
            );
        };

        if (params.studysetId) getAnnotations(params.studysetId);
    }, [params.studysetId, showSnackbar, current]);

    const handleSaveTextEdit = (editedText: string, fieldName: string) => {
        if (!studyset) return;

        API.NeurostoreServices.StudySetsService.studysetsIdPut(params.studysetId, {
            name: studyset.name,
            studies: (studyset.studies as StudyApiResponse[]).map((x) => x.id as string),
            [fieldName]: editedText,
        })
            .then(() => {
                showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                if (current) {
                    setStudyset((prevState) => {
                        if (!prevState) return prevState;
                        return {
                            ...prevState,
                            [fieldName]: editedText,
                        };
                    });
                }
            })
            .catch((err) => {
                showSnackbar('there was an error updating the studyset', SnackbarType.ERROR);
                console.error(err);
            });
    };

    const handleCloseDialog = async (confirm: boolean | undefined) => {
        setConfirmationIsOpen(false);

        if (studyset?.id && confirm) {
            API.NeurostoreServices.StudySetsService.studysetsIdDelete(studyset.id)
                .then((res) => {
                    history.push('/userstudysets');
                    showSnackbar('deleted studyset', SnackbarType.SUCCESS);
                })
                .catch((err) => {
                    showSnackbar('there was a problem deleting the studyset', SnackbarType.ERROR);
                    console.error(err);
                });
        }
    };

    const handleCreateAnnotation = async (name: string, description: string) => {
        if (studyset && studyset?.id) {
            API.NeurostoreServices.AnnotationsService.annotationsPost('neurosynth', undefined, {
                name,
                description,
                note_keys: {},
                studyset: params.studysetId,
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
        <NeurosynthLoader loaded={!!studyset}>
            {studyset && (
                <>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <TextEdit
                            onSave={handleSaveTextEdit}
                            sx={{ fontSize: '1.25rem' }}
                            label="name"
                            textToEdit={studyset.name || ''}
                        >
                            <Box sx={StudysetPageStyles.displayedText}>
                                <Typography
                                    sx={[
                                        StudysetPageStyles.displayedText,
                                        !studyset.name ? StudysetPageStyles.noData : {},
                                    ]}
                                    variant="h6"
                                >
                                    {studyset.name || 'No name'}
                                </Typography>
                            </Box>
                        </TextEdit>

                        <TextEdit
                            onSave={handleSaveTextEdit}
                            label="publication"
                            textToEdit={studyset.publication || ''}
                        >
                            <Box sx={StudysetPageStyles.displayedText}>
                                <Typography
                                    sx={{
                                        ...StudysetPageStyles.displayedText,
                                        ...(!studyset.publication ? StudysetPageStyles.noData : {}),
                                    }}
                                >
                                    {studyset.publication || 'No publication'}
                                </Typography>
                            </Box>
                        </TextEdit>
                        <TextEdit
                            label="doi"
                            onSave={handleSaveTextEdit}
                            textToEdit={studyset.doi || ''}
                        >
                            <Box sx={StudysetPageStyles.displayedText}>
                                <Typography
                                    sx={[
                                        StudysetPageStyles.displayedText,
                                        !studyset.doi ? StudysetPageStyles.noData : {},
                                    ]}
                                >
                                    {studyset.doi || 'No DOI'}
                                </Typography>
                            </Box>
                        </TextEdit>
                        <TextEdit
                            onSave={handleSaveTextEdit}
                            label="description"
                            textToEdit={studyset.description || ''}
                            multiline
                        >
                            <Box
                                sx={{
                                    ...StudysetPageStyles.displayedText,
                                    ...(!studyset.description ? StudysetPageStyles.noData : {}),
                                }}
                            >
                                <TextExpansion
                                    sx={{ fontSize: '12px' }}
                                    text={studyset.description || 'No description'}
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
                                Annotations for this studyset
                            </Typography>
                            <Button
                                onClick={() => setCreateDetailsIsOpen(true)}
                                variant="contained"
                                sx={{ width: '200px' }}
                                startIcon={<AddIcon />}
                                disabled={!isAuthenticated}
                            >
                                new Annotation
                            </Button>
                            <CreateDetailsDialog
                                titleText="Create new Annotation"
                                isOpen={createDetailsIsOpen}
                                onCreate={handleCreateAnnotation}
                                onCloseDialog={() => setCreateDetailsIsOpen(false)}
                            />
                        </Box>
                        <AnnotationsTable
                            studysetId={params.studysetId}
                            annotations={annotations || []}
                        />
                    </Box>

                    <Box>
                        <Typography variant="h6" sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                            Studies in this studyset
                        </Typography>
                    </Box>
                    <StudiesTable studies={studyset.studies as StudyApiResponse[]} />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <ConfirmationDialog
                            dialogTitle="Are you sure you want to delete the studyset?"
                            dialogMessage="You will not be able to undo this action"
                            confirmText="Yes"
                            rejectText="No"
                            isOpen={confirmationIsOpen}
                            onCloseDialog={handleCloseDialog}
                        />
                        <Button
                            onClick={() => setConfirmationIsOpen(true)}
                            variant="contained"
                            sx={{ width: '200px' }}
                            color="error"
                            disabled={!isAuthenticated}
                        >
                            Delete studyset
                        </Button>
                    </Box>
                </>
            )}
        </NeurosynthLoader>
    );
};

export default StudysetsPage;
