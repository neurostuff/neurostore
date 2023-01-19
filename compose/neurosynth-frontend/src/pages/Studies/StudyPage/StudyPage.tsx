import { useAuth0 } from '@auth0/auth0-react';
import {
    Button,
    Tooltip,
    Typography,
    Tab,
    Tabs,
    Box,
    Divider,
    TableRow,
    TableCell,
    Fab,
    Breadcrumbs,
    Link,
} from '@mui/material';
import React, { useState, useEffect, SyntheticEvent } from 'react';
import { NavLink, useHistory, useParams } from 'react-router-dom';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import DisplayAnalysis from 'components/DisplayAnalysis/DisplayAnalysis';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import StudyPageStyles from './StudyPage.styles';
import HelpIcon from '@mui/icons-material/Help';
import {
    useCreateStudy,
    useGetAnnotationById,
    useGetStudyById,
    useGetStudysetById,
    useGetTour,
    useUpdateStudyset,
} from 'hooks';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import EditIcon from '@mui/icons-material/Edit';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { getType } from 'components/EditMetadata';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { sortMetadataArrayFn } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import useGetProjectById from 'hooks/requests/useGetProjectById';

const StudyPage: React.FC = (props) => {
    const { startTour } = useGetTour('StudyPage');
    const [dialogIsOpen, setDialogIsOpen] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState<{
        analysisIndex: number;
        analysis: AnalysisReturn | undefined;
    }>({
        analysisIndex: 0,
        analysis: undefined,
    });

    const [allowEdits, setAllowEdits] = useState(false);
    const history = useHistory();
    const { isAuthenticated, user } = useAuth0();
    const { projectId, studyId }: { projectId: string; studyId: string } = useParams();
    const { data: project } = useGetProjectById(projectId);
    const { data: annotation } = useGetAnnotationById(
        project?.provenance?.extractionMetadata?.annotationId
    );

    const { isLoading: createStudyIsLoading, mutateAsync: createStudy } = useCreateStudy();
    const {
        isLoading: getStudyIsLoading,
        isError: getStudyIsError,
        data,
    } = useGetStudyById(studyId);
    const { data: studyset } = useGetStudysetById(
        project?.provenance?.extractionMetadata?.studysetId
    );
    const { mutateAsync: updateStudyset } = useUpdateStudyset();

    useEffect(() => {
        if (data) {
            setSelectedAnalysis({
                analysisIndex: 0,
                analysis: (data.analyses as AnalysisReturn[])[0],
            });
        }
    }, [data]);

    const handleCloneStudy = async () => {
        if (studyset?.studies && project?.provenance?.extractionMetadata?.studysetId) {
            try {
                const createdStudy = await createStudy(studyId, {
                    onSuccess: (res) => {
                        const createdStudyId = res.data.id as string;
                        history.push(`/studies/${createdStudyId}`);
                    },
                });

                if (!createdStudy.data?.id)
                    throw new Error('did not find id for newly created study');

                const allStudies = (studyset?.studies as StudyReturn[]).map((x) => x.id || '');
                const thisStudyIndex = allStudies.findIndex((x) => x === data?.id || '');
                if (thisStudyIndex < 0) throw new Error('could not find study');

                allStudies[thisStudyIndex] = createdStudy.data.id;

                await updateStudyset({
                    studysetId: project.provenance.extractionMetadata.studysetId,
                    studyset: {
                        studies: allStudies,
                    },
                });

                history.push(
                    `/projects/${projectId}/extraction/studies/${createdStudy.data.id}/edit`
                );
            } catch (e) {
                // handle
            }
        }
    };

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/projects/${projectId}/extraction/studies/${studyId}/edit`);
    };

    const handleSelectAnalysis = (event: SyntheticEvent, newVal: number) => {
        setSelectedAnalysis({
            analysisIndex: newVal,
            analysis: (data?.analyses as AnalysisReturn[])[newVal],
        });
    };

    useEffect(() => {
        const userIDAndStudyIDExist = !!user?.sub && !!data?.user;
        const thisUserOwnsThisStudy = (data?.user || null) === (user?.sub || undefined);
        const allowEdit = isAuthenticated && userIDAndStudyIDExist && thisUserOwnsThisStudy;
        setAllowEdits(allowEdit);
    }, [isAuthenticated, user?.sub, data?.user, history]);

    const thisUserOwnsThisStudy = (data?.user || null) === (user?.sub || undefined);

    const isViewingStudyFromProject = projectId !== undefined;
    const showCloneMessage = isViewingStudyFromProject && !thisUserOwnsThisStudy;

    return (
        <StateHandlerComponent isLoading={getStudyIsLoading} isError={getStudyIsError}>
            {isViewingStudyFromProject && (
                <Box
                    data-tour="StudyPage-8"
                    sx={[StudyPageStyles.actionButtonContainer, StudyPageStyles.spaceBelow]}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                            <Breadcrumbs>
                                <Link
                                    component={NavLink}
                                    to="/projects"
                                    sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                                    underline="hover"
                                >
                                    Projects
                                </Link>
                                <Link
                                    component={NavLink}
                                    to={`/projects/${projectId}`}
                                    sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                                    underline="hover"
                                >
                                    {project?.name || ''}
                                </Link>
                                <Link
                                    component={NavLink}
                                    to={`/projects/${projectId}/extraction`}
                                    sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                                    underline="hover"
                                >
                                    Extraction
                                </Link>
                                <Typography color="secondary" sx={{ fontSize: '1.5rem' }}>
                                    {data?.name || ''}
                                </Typography>
                            </Breadcrumbs>
                        </Box>
                        <Tooltip
                            placement="top"
                            title={allowEdits ? '' : 'you can only edit studies you have cloned'}
                        >
                            <Box>
                                <Fab
                                    size="medium"
                                    disabled={!allowEdits}
                                    onClick={handleEditStudy}
                                    color="primary"
                                    aria-label="add"
                                >
                                    <EditIcon />
                                </Fab>
                            </Box>
                        </Tooltip>
                    </Box>
                </Box>
            )}
            {showCloneMessage && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        backgroundColor: 'secondary.main',
                        position: 'sticky',
                        top: '1.5rem',
                        color: 'white',
                        padding: '1rem',
                        zIndex: 10,
                        marginBottom: '1rem',
                    }}
                >
                    <Box>
                        <Typography variant="h6">
                            This study is owned by <b>neurosynth</b> and is <b>read-only</b>
                        </Typography>
                        <Typography>
                            Would you like to make your own clone to edit the study?
                        </Typography>
                        <Typography>
                            Once you clone, your studyset will contain the new study instead of the
                            current one owned by <b>neurosynth</b>
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                            onClick={handleCloneStudy}
                            size="large"
                            color="primary"
                            variant="contained"
                        >
                            clone and edit
                        </Button>
                    </Box>
                </Box>
            )}

            <Box data-tour="StudyPage-1">
                <Typography sx={StudyPageStyles.spaceBelow} variant="h6">
                    <b>{data?.name}</b>
                </Typography>
                <Typography sx={StudyPageStyles.spaceBelow} variant="h6">
                    {data?.authors}
                </Typography>
                <Box sx={StudyPageStyles.spaceBelow}>
                    <Typography variant="h6">{data?.publication}</Typography>
                    {data?.doi && <Typography variant="h6">DOI: {data?.doi}</Typography>}
                </Box>
                <TextExpansion
                    text={data?.description || ''}
                    sx={{ ...StudyPageStyles.spaceBelow, whiteSpace: 'pre-wrap' }}
                />
            </Box>
            <Box data-tour="StudyPage-2" sx={{ margin: '15px 0' }}>
                <NeurosynthAccordion
                    accordionSummarySx={StudyPageStyles.accordionSummary}
                    elevation={2}
                    TitleElement={
                        <Typography variant="h6">
                            <b>Metadata</b>
                        </Typography>
                    }
                >
                    <Box sx={StudyPageStyles.metadataContainer}>
                        <NeurosynthTable
                            tableConfig={{
                                tableHeaderBackgroundColor: 'white',
                                tableElevation: 0,
                            }}
                            headerCells={[
                                { text: 'Name', key: 'name', styles: { fontWeight: 'bold' } },
                                { text: 'Value', key: 'value', styles: { fontWeight: 'bold' } },
                            ]}
                            rows={Object.entries(data?.metadata || {})
                                .sort((a, b) => sortMetadataArrayFn(a[0], b[0]))
                                .map(([key, value]) => (
                                    <TableRow key={key}>
                                        <TableCell>{key}</TableCell>
                                        <TableCell
                                            sx={{ color: NeurosynthTableStyles[getType(value)] }}
                                        >
                                            {getValue(value)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        />
                    </Box>
                </NeurosynthAccordion>
            </Box>

            <Box>
                <Typography
                    data-tour="StudyPage-3"
                    variant="h6"
                    sx={[
                        {
                            marginLeft: '15px',
                            fontWeight: 'bold',
                        },
                        StudyPageStyles.spaceBelow,
                    ]}
                >
                    Analyses
                </Typography>
                <Divider />
                {data?.analyses?.length === 0 ? (
                    <Box sx={{ color: 'warning.dark', margin: '15px 0 0 15px' }}>No analyses</Box>
                ) : (
                    /** * The following CSS is applied to make sure that the tab height grows based on
                    the height * of the analysis. * The tab height should expand and match the height if the
                    analysis accordions are expanded */
                    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                        <Box sx={StudyPageStyles.matchingSibling}>
                            {/* apply flex basis 0 to analyses tabs to make sure it matches sibling */}
                            <Tabs
                                data-tour="StudyPage-7"
                                sx={StudyPageStyles.analysesTabs}
                                scrollButtons
                                value={selectedAnalysis.analysisIndex}
                                TabScrollButtonProps={{
                                    sx: {
                                        color: 'primary.main',
                                    },
                                }}
                                onChange={handleSelectAnalysis}
                                orientation="vertical"
                                variant="scrollable"
                            >
                                {/* manually override analysis type as we know study will be nested and analysis will not be a string */}
                                {(data?.analyses as AnalysisReturn[])?.map((analysis) => (
                                    <Tab
                                        sx={StudyPageStyles.analysisTab}
                                        key={analysis.id}
                                        label={analysis.name}
                                    />
                                ))}
                            </Tabs>
                        </Box>
                        <Box sx={StudyPageStyles.heightDefiningSibling}>
                            <DisplayAnalysis
                                {...selectedAnalysis.analysis}
                                annotation={annotation}
                            />
                        </Box>
                    </Box>
                )}
            </Box>
        </StateHandlerComponent>
    );
};

export default StudyPage;
