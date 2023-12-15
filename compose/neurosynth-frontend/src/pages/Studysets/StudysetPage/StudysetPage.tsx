import HelpIcon from '@mui/icons-material/Help';
import { Box, IconButton, TableCell, TableRow, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import {
    useCreateAnnotation,
    useGetAnnotationsByStudysetId,
    useGetStudysetById,
    useUpdateStudyset,
} from 'hooks';
import useGetTour from 'hooks/useGetTour';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useState } from 'react';
import { useIsFetching } from 'react-query';
import { useHistory, useParams } from 'react-router';
import StudysetPageStyles from './StudysetPage.styles';

const StudysetsPage: React.FC = (props) => {
    const { startTour } = useGetTour('StudysetPage');
    const history = useHistory();

    const [
        deleteStudyFromStudysetConfirmationIsOpen,
        setDeleteStudyFromStudysetConfirmationIsOpen,
    ] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: undefined });
    const [createDetailsIsOpen, setCreateDetailsIsOpen] = useState(false);

    const params: { studysetId: string } = useParams();

    // const { mutate: updateStudysetName, isLoading: updateStudysetNameIsLoading } =
    //     useUpdateStudyset();
    // const { mutate: updateStudysetDescription, isLoading: updateStudysetDescriptionIsLoading } =
    //     useUpdateStudyset();
    // const { mutate: updateStudysetPublication, isLoading: updateStudysetPublicationIsLoading } =
    //     useUpdateStudyset();
    // const { mutate: updateStudysetDoi, isLoading: updateStudysetDoiIsLoading } =
    //     useUpdateStudyset();
    const { mutate: deleteStudyFromStudyset, isLoading: deleteStudyFromStudysetIsLoading } =
        useUpdateStudyset();
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(params.studysetId, true);
    const isFetching = useIsFetching(['studysets', params.studysetId]);
    const { data: annotations, isLoading: getAnnotationsIsLoading } = useGetAnnotationsByStudysetId(
        params?.studysetId
    );
    const { mutate: createAnnotation } = useCreateAnnotation();

    // const handleUpdateField = (updatedText: string, label: string) => {
    //     const updateStudysetObj = {
    //         studysetId: params.studysetId,
    //         studyset: {
    //             [label]: updatedText,
    //         },
    //     };
    //     /**
    //      * in order to make sure that each field visually loads independently, we need to split the studyset update
    //      * into separate useQuery instances (otherwise to name will show the loading icon for all fields)
    //      */
    //     switch (label) {
    //         case 'name':
    //             updateStudysetName(updateStudysetObj);
    //             break;
    //         case 'description':
    //             updateStudysetDescription(updateStudysetObj);
    //             break;
    //         case 'doi':
    //             updateStudysetDoi(updateStudysetObj);
    //             break;
    //         case 'publication':
    //             updateStudysetPublication(updateStudysetObj);
    //             break;
    //         default:
    //             break;
    //     }
    // };

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
                    <Box sx={StudysetPageStyles.displayedText}>
                        <Typography
                            gutterBottom
                            sx={[
                                StudysetPageStyles.displayedText,
                                !studyset?.name ? StudysetPageStyles.noData : {},
                            ]}
                            variant="h5"
                        >
                            {studyset?.name || 'No name'}
                        </Typography>
                    </Box>
                    <Box sx={StudysetPageStyles.displayedText}>
                        <Typography
                            sx={{ color: studyset?.description ? 'inherit' : 'primary.main' }}
                        >
                            {studyset?.description || 'No description'}
                        </Typography>
                    </Box>
                    <Box sx={StudysetPageStyles.displayedText}>
                        <Typography sx={{ color: 'muted.main' }}>
                            Studyset Owner: {studyset?.username || 'No username'}
                        </Typography>
                    </Box>
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
                            Annotation for this studyset
                        </Typography>
                        <CreateDetailsDialog
                            titleText="Create new Annotation"
                            isOpen={createDetailsIsOpen}
                            onCreate={handleCreateAnnotation}
                            onCloseDialog={() => setCreateDetailsIsOpen(false)}
                        />
                    </Box>
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
                                There are no studies in this studyset yet.
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
        </StateHandlerComponent>
    );
};

export default StudysetsPage;
