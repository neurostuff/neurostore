import { useAuth0 } from '@auth0/auth0-react';
import {
    Button,
    Tooltip,
    Typography,
    Tab,
    Tabs,
    Box,
    Divider,
    IconButton,
    TableRow,
    TableCell,
    Paper,
} from '@mui/material';
import React, { useState, useEffect, SyntheticEvent } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import DisplayAnalysis from 'components/DisplayAnalysis/DisplayAnalysis';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import StudyPageStyles from './StudyPage.styles';
import HelpIcon from '@mui/icons-material/Help';
import { useCreateStudy, useGetStudyById, useGetTour } from 'hooks';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable, { getValue } from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { getType } from 'components/EditMetadata';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { sortMetadataArrayFn } from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';

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
    const {
        projectId,
        studysetId,
        studyId,
    }: { projectId: string; studysetId: string; studyId: string } = useParams();

    const { isLoading: createStudyIsLoading, mutate: createStudy } = useCreateStudy();
    const {
        isLoading: getStudyIsLoading,
        isError: getStudyIsError,
        data,
    } = useGetStudyById(studyId);

    useEffect(() => {
        if (data) {
            setSelectedAnalysis({
                analysisIndex: 0,
                analysis: (data.analyses as AnalysisReturn[])[0],
            });
        }
    }, [data]);

    const handleCloneStudy = async () => {
        createStudy(studyId, {
            onSuccess: (res) => {
                const createdStudyId = res.data.id as string;
                history.push(`/studies/${createdStudyId}`);
            },
        });
    };

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/studies/${studyId}/edit`);
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
    const isViewingStudyFromProject =
        studysetId !== undefined && projectId !== undefined && studysetId !== undefined;
    const showCloneMessage = isViewingStudyFromProject && !thisUserOwnsThisStudy;

    return (
        <StateHandlerComponent isLoading={getStudyIsLoading} isError={getStudyIsError}>
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
                        <Button size="large" color="primary" variant="contained">
                            clone and edit
                        </Button>
                    </Box>
                </Box>
            )}
            {/* <Box
                data-tour="StudyPage-8"
                sx={[StudyPageStyles.actionButtonContainer, StudyPageStyles.spaceBelow]}
            >
                <Tooltip
                    placement="top"
                    title={
                        !isAuthenticated ? 'log in to clone study' : 'clone a study to edit details'
                    }
                >
                    <Box sx={{ display: 'inline' }}>
                        <LoadingButton
                            onClick={() =>
                                allowEdits ? setDialogIsOpen(true) : handleCloneStudy()
                            }
                            disabled={!isAuthenticated}
                            variant={allowEdits ? 'text' : 'outlined'}
                            color="primary"
                            isLoading={createStudyIsLoading}
                            text="Clone Study"
                            sx={StudyPageStyles.actionButton}
                        />
                    </Box>
                </Tooltip>
                <ConfirmationDialog
                    isOpen={dialogIsOpen}
                    confirmText="Yes"
                    rejectText="No"
                    onCloseDialog={(confirm) => {
                        if (confirm) handleCloneStudy();
                        setDialogIsOpen(false);
                    }}
                    dialogTitle="Are you sure you want to clone this study?"
                    dialogMessage="This study is a clone of an existing study."
                />
                <Tooltip
                    placement="top"
                    title={allowEdits ? '' : 'you can only edit studies you have cloned'}
                >
                    <Box sx={{ display: 'inline' }}>
                        <Button
                            disabled={!allowEdits}
                            onClick={handleEditStudy}
                            variant="outlined"
                            color="secondary"
                            sx={StudyPageStyles.actionButton}
                        >
                            Edit Study
                        </Button>
                    </Box>
                </Tooltip>
                <Tooltip placement="top" title="click to add this study to one of your studysets">
                    <Box sx={{ display: 'inline' }}>
                        <StudysetsPopupMenu
                            disabled={!isAuthenticated}
                            study={data as StudyReturn}
                        />
                    </Box>
                </Tooltip>

                <Box sx={{ marginLeft: 'auto' }}>
                    <IconButton onClick={() => startTour()} color="primary">
                        <HelpIcon />
                    </IconButton>
                </Box>
            </Box> */}
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
                            <DisplayAnalysis {...selectedAnalysis.analysis} />
                        </Box>
                    </Box>
                )}
            </Box>
        </StateHandlerComponent>
    );
};

export default StudyPage;
