import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, Button, IconButton, Link, TableRow, TableCell } from '@mui/material';
import { useState } from 'react';
import { useParams } from 'react-router';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { useHistory } from 'react-router';
import AddIcon from '@mui/icons-material/Add';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import TextEdit from 'components/TextEdit/TextEdit';
import StudysetPageStyles from './StudysetPage.styles';
import HelpIcon from '@mui/icons-material/Help';
import useGetTour from 'hooks/useGetTour';
import {
    useCreateAnnotation,
    useDeleteStudyset,
    useGetAnnotationsByStudysetId,
    useGetStudysetById,
    useUpdateStudyset,
} from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useIsFetching } from 'react-query';
import { NavLink } from 'react-router-dom';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';

const StudysetsPage: React.FC = (props) => {
    const { startTour } = useGetTour('StudysetPage');
    const { user, isAuthenticated } = useAuth0();
    const history = useHistory();

    const [deleteStudysetConfirmationIsOpen, setDeleteStudysetConfirmationIsOpen] = useState(false);
    const [
        deleteStudyFromStudysetConfirmationIsOpen,
        setDeleteStudyFromStudysetConfirmationIsOpen,
    ] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: undefined });
    const [createDetailsIsOpen, setCreateDetailsIsOpen] = useState(false);

    const params: { studysetId: string } = useParams();

    const { mutate: updateStudysetName, isLoading: updateStudysetNameIsLoading } =
        useUpdateStudyset();
    const { mutate: updateStudysetDescription, isLoading: updateStudysetDescriptionIsLoading } =
        useUpdateStudyset();
    const { mutate: updateStudysetPublication, isLoading: updateStudysetPublicationIsLoading } =
        useUpdateStudyset();
    const { mutate: updateStudysetDoi, isLoading: updateStudysetDoiIsLoading } =
        useUpdateStudyset();
    const { mutate: deleteStudyFromStudyset, isLoading: deleteStudyFromStudysetIsLoading } =
        useUpdateStudyset();
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(params.studysetId);
    const isFetching = useIsFetching(['studysets', params.studysetId]);
    const { data: annotations, isLoading: getAnnotationsIsLoading } = useGetAnnotationsByStudysetId(
        params?.studysetId
    );
    const { mutate: createAnnotation } = useCreateAnnotation();
    const { mutate: deleteStudyset } = useDeleteStudyset();

    const thisUserOwnsthisStudyset = (studyset?.user || undefined) === (user?.sub || null);

    const handleUpdateField = (updatedText: string, label: string) => {
        const updateStudysetObj = {
            studysetId: params.studysetId,
            studyset: {
                [label]: updatedText,
            },
        };
        /**
         * in order to make sure that each field visually loads independently, we need to split the studyset update
         * into separate useQuery instances (otherwise to name will show the loading icon for all fields)
         */
        switch (label) {
            case 'name':
                updateStudysetName(updateStudysetObj);
                break;
            case 'description':
                updateStudysetDescription(updateStudysetObj);
                break;
            case 'doi':
                updateStudysetDoi(updateStudysetObj);
                break;
            case 'publication':
                updateStudysetPublication(updateStudysetObj);
                break;
            default:
                break;
        }
    };

    const handleCloseDeleteStudysetDialog = async (confirm: boolean | undefined) => {
        setDeleteStudysetConfirmationIsOpen(false);

        if (studyset?.id && confirm) {
            deleteStudyset(studyset?.id, {
                onSuccess: () => history.push('/userstudysets'),
            });
        }
    };

    const handleCloseDeleteStudyFromStudysetDialog = (confirm: boolean | undefined, data: any) => {
        if (confirm) {
            if (studyset && studyset.studies && params.studysetId && data?.studyId) {
                const updatedStudiesList = (studyset.studies as StudyReturn[]).filter(
                    (x) => x.id !== data.studyId
                );

                deleteStudyFromStudyset({
                    studysetId: params.studysetId,
                    studyset: {
                        studies: updatedStudiesList.map((x) => x.id || ''),
                    },
                });
            }
        }
        setDeleteStudyFromStudysetConfirmationIsOpen({ isOpen: false, data: undefined });
    };

    const handleCreateAnnotation = async (name: string, description: string) => {
        if (studyset && params.studysetId) {
            createAnnotation({
                source: 'neurosynth',
                sourceId: undefined,
                annotation: {
                    name,
                    description,
                    note_keys: {},
                    studyset: params.studysetId,
                },
            });
        }
    };

    return (
        <StateHandlerComponent
            isLoading={getStudysetIsLoading}
            isError={getStudysetIsError}
            errorMessage="There was an error getting the studyset"
        >
            <Box
                data-tour="StudysetPage-2"
                sx={{ display: 'flex', marginBottom: '1rem', width: '100%' }}
            >
                <Box sx={{ flexGrow: 1 }}>
                    <TextEdit
                        isLoading={updateStudysetNameIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        onSave={handleUpdateField}
                        sx={{ fontSize: '1.5rem' }}
                        label="name"
                        textToEdit={studyset?.name || ''}
                    >
                        <Box sx={StudysetPageStyles.displayedText}>
                            <Typography
                                sx={[
                                    StudysetPageStyles.displayedText,
                                    !studyset?.name ? StudysetPageStyles.noData : {},
                                ]}
                                variant="h5"
                            >
                                {studyset?.name || 'No name'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <TextEdit
                        isLoading={updateStudysetPublicationIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        sx={{ fontSize: '1.25rem' }}
                        onSave={handleUpdateField}
                        label="publication"
                        textToEdit={studyset?.publication || ''}
                    >
                        <Box sx={StudysetPageStyles.displayedText}>
                            <Typography
                                variant="h6"
                                sx={[
                                    StudysetPageStyles.displayedText,
                                    !studyset?.publication ? StudysetPageStyles.noData : {},
                                ]}
                            >
                                {studyset?.publication || 'No publication'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <TextEdit
                        isLoading={updateStudysetDoiIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        sx={{ fontSize: '1.25rem' }}
                        label="doi"
                        onSave={handleUpdateField}
                        textToEdit={studyset?.doi || ''}
                    >
                        <Box sx={StudysetPageStyles.displayedText}>
                            <Typography
                                variant="h6"
                                sx={[
                                    StudysetPageStyles.displayedText,
                                    !studyset?.doi ? StudysetPageStyles.noData : {},
                                ]}
                            >
                                {studyset?.doi || 'No DOI'}
                            </Typography>
                        </Box>
                    </TextEdit>
                    <TextEdit
                        isLoading={updateStudysetDescriptionIsLoading}
                        editIconIsVisible={thisUserOwnsthisStudyset}
                        sx={{ fontSize: '1.25rem' }}
                        onSave={handleUpdateField}
                        label="description"
                        textToEdit={studyset?.description || ''}
                        multiline
                    >
                        <Box
                            sx={{
                                ...StudysetPageStyles.displayedText,
                                ...(!studyset?.description ? StudysetPageStyles.noData : {}),
                            }}
                        >
                            <TextExpansion
                                textSx={{ fontSize: '1.25rem', whiteSpace: 'break-spaces' }}
                                text={studyset?.description || 'No description'}
                            />
                        </Box>
                    </TextEdit>
                </Box>
                <Box>
                    <IconButton onClick={() => startTour()} color="primary">
                        <HelpIcon />
                    </IconButton>
                </Box>
            </Box>

            <Box data-tour="StudysetPage-4">
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
                            sx={{
                                marginBottom: '1rem',
                                fontWeight: 'bold',
                                margin: 'auto 0',
                            }}
                        >
                            Annotations for this studyset
                        </Typography>
                        <Button
                            data-tour="StudysetPage-5"
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
                    {/* <AnnotationsTable
                        studysetId={params.studysetId}
                        annotations={annotations || []}
                    /> */}
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: getAnnotationsIsLoading,
                            tableHeaderBackgroundColor: '#b4656f',
                        }}
                        headerCells={[
                            {
                                text: 'Name',
                                key: 'name',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'Description',
                                key: 'description',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'Owner',
                                key: 'owner',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                        ]}
                        rows={(annotations || []).map((annotation, index) => (
                            <TableRow
                                key={annotation?.id || index}
                                onClick={() => history.push(`/annotations/${annotation?.id}`)}
                                sx={NeurosynthTableStyles.tableRow}
                            >
                                <TableCell>
                                    {annotation?.name || (
                                        <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {annotation?.description || (
                                        <Box sx={{ color: 'warning.dark' }}>No description</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {(annotation?.user === user?.sub ? 'Me' : annotation?.user) ||
                                        'Neurosynth-Compose'}
                                </TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </Box>

            <Box data-tour="StudysetPage-3">
                <Typography variant="h6" sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Studies in this studyset
                </Typography>
                <NeurosynthTable
                    tableConfig={{
                        isLoading:
                            getStudysetIsLoading ||
                            deleteStudyFromStudysetIsLoading ||
                            isFetching > 0,
                        loaderColor: 'secondary',
                        noDataDisplay: (
                            <Typography sx={{ padding: '1rem' }} color="warning.dark">
                                There are no studies in this studyset yet. Start by{' '}
                                <Link color="primary" exact component={NavLink} to="/studies">
                                    adding studies to this studyset
                                </Link>
                            </Typography>
                        ),
                    }}
                    headerCells={[
                        {
                            text: 'Title',
                            key: 'title',
                            styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                        },
                        {
                            text: 'Authors',
                            key: 'authors',
                            styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                        },
                        {
                            text: 'Journal',
                            key: 'journal',
                            styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                        },
                        {
                            text: '',
                            key: 'deleteStudyFromStudyset',
                            styles: {
                                display:
                                    isAuthenticated && thisUserOwnsthisStudyset
                                        ? 'table-cell'
                                        : 'none',
                            },
                        },
                    ]}
                    rows={((studyset?.studies || []) as StudyReturn[]).map((study, index) => (
                        <TableRow
                            sx={NeurosynthTableStyles.tableRow}
                            key={study?.id || index}
                            onClick={() => history.push(`/studies/${study.id}`)}
                        >
                            <TableCell>
                                {study?.name || <Box sx={{ color: 'warning.dark' }}>No name</Box>}
                            </TableCell>
                            <TableCell>
                                {study?.authors || (
                                    <Box sx={{ color: 'warning.dark' }}>No author(s)</Box>
                                )}
                            </TableCell>
                            <TableCell>
                                {study?.publication || (
                                    <Box sx={{ color: 'warning.dark' }}>No Journal</Box>
                                )}
                            </TableCell>
                            <TableCell
                                sx={{
                                    display:
                                        isAuthenticated && thisUserOwnsthisStudyset
                                            ? 'table-cell'
                                            : 'none',
                                }}
                                data-tour={index === 0 ? 'UserStudiesPage-3' : null}
                            >
                                <IconButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setDeleteStudyFromStudysetConfirmationIsOpen({
                                            isOpen: true,
                                            data: { studyId: study.id },
                                        });
                                    }}
                                >
                                    <RemoveCircleIcon color="error" />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                />
                <ConfirmationDialog
                    isOpen={deleteStudyFromStudysetConfirmationIsOpen.isOpen}
                    dialogTitle="Are you sure you want to remove this study from the studyset?"
                    confirmText="Yes"
                    data={deleteStudyFromStudysetConfirmationIsOpen.data}
                    rejectText="No"
                    onCloseDialog={handleCloseDeleteStudyFromStudysetDialog}
                />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <ConfirmationDialog
                    dialogTitle="Are you sure you want to delete the studyset?"
                    dialogMessage="You will not be able to undo this action"
                    confirmText="Yes"
                    rejectText="No"
                    isOpen={deleteStudysetConfirmationIsOpen}
                    onCloseDialog={handleCloseDeleteStudysetDialog}
                />
                <Button
                    data-tour="StudysetPage-6"
                    onClick={() => setDeleteStudysetConfirmationIsOpen(true)}
                    variant="contained"
                    sx={{ width: '200px' }}
                    color="error"
                    disabled={!isAuthenticated || !thisUserOwnsthisStudyset}
                >
                    Delete studyset
                </Button>
            </Box>
        </StateHandlerComponent>
    );
};

export default StudysetsPage;
