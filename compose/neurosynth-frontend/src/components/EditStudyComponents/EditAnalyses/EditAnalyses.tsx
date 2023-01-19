import { Typography, Box, Tabs, Tab, Divider } from '@mui/material';
import React, { useState, SyntheticEvent, useEffect } from 'react';
import CreateDetailsDialog from '../../Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import EditAnalysesStyles from './EditAnalyses.styles';
import EditAnalysis from './EditAnalysis/EditAnalysis';
import AddIcon from '@mui/icons-material/Add';
import { useCreateAnalysis, useGetAnnotationById, useUpdateAnnotationById } from 'hooks';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { AnalysisReturn, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useParams } from 'react-router-dom';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { getStartValFromType } from 'components/EditMetadata/EditMetadataRow/AddMetadataRow';

const EditAnalyses: React.FC<{ analyses: AnalysisReturn[] | undefined; studyId: string }> =
    React.memo((props) => {
        const [analyses, setAnalyses] = useState<AnalysisReturn[]>(props.analyses || []);
        const [selectedAnalysis, setSelectedAnalysis] = useState(0);
        const [createDetailsDialogIsOpen, setCreateDetailsDialogIsOpen] = useState(false);
        const { isLoading, mutateAsync: createAnalysis } = useCreateAnalysis();
        const { projectId }: { projectId: string } = useParams();
        const { data: project } = useGetProjectById(projectId);
        const { data: annotation } = useGetAnnotationById(
            project?.provenance?.extractionMetadata?.annotationId
        );
        const { mutateAsync: updateAnnotation } = useUpdateAnnotationById(
            project?.provenance?.extractionMetadata?.annotationId
        );

        // we need to cache the analyses into an intermediate state in order to make sure that we do a check first
        // so that our tab is not selecting an analysis that was just deleted
        useEffect(() => {
            if (!props.analyses || props.analyses.length === 0) {
                setAnalyses([]);
            } else {
                if (props.analyses.length === selectedAnalysis) {
                    // if we have deleted the last analysis
                    setSelectedAnalysis(props.analyses.length - 1);
                }
                setAnalyses(props.analyses);
            }
        }, [props.analyses, selectedAnalysis]);

        const handleTabChange = (_event: SyntheticEvent, newVal: number) => {
            setSelectedAnalysis(newVal);
        };

        const handleCreateAnalysis = async (name: string, description: string) => {
            if (project?.provenance?.extractionMetadata?.annotationId && projectId && annotation) {
                // TODO: the backend should update this
                try {
                    const createdAnalysis = await createAnalysis({
                        name,
                        description,
                        study: props.studyId,
                    });

                    if (!createdAnalysis.data?.id)
                        throw new Error('could not get id of created analysis');

                    const updatedNotes = [
                        ...((annotation?.notes as NoteCollectionReturn[]) || []),
                    ].map((note) => ({
                        note: note.note,
                        analysis: note.analysis,
                        study: note.study,
                    }));

                    // create a new note that is instantiated from note keys for this new analysis
                    const newNote = Object.entries(annotation?.note_keys || {}).reduce(
                        (acc, [string, value]) => {
                            const temp = { ...acc } as {
                                [key: string]: string | boolean | number | null;
                            };
                            temp[string] = getStartValFromType(value);
                            return temp;
                        },
                        {}
                    );

                    updatedNotes.push({
                        note: newNote,
                        analysis: createdAnalysis.data?.id,
                        study: props.studyId,
                    });

                    await updateAnnotation({
                        argAnnotationId: project.provenance.extractionMetadata.annotationId,
                        annotation: {
                            notes: updatedNotes,
                        },
                    });
                } catch (e) {
                    // handle error
                }
            }
        };

        const hasAnalyses = !!analyses && analyses.length > 0;

        return (
            <>
                <CreateDetailsDialog
                    isOpen={createDetailsDialogIsOpen}
                    titleText="Create new analysis"
                    onCloseDialog={() => setCreateDetailsDialogIsOpen(false)}
                    onCreate={handleCreateAnalysis}
                />
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginBottom: '15px',
                    }}
                >
                    <Typography variant="h6">
                        <b>Edit Analyses</b>
                    </Typography>
                    <LoadingButton
                        isLoading={isLoading}
                        loaderColor="secondary"
                        color="primary"
                        sx={{ width: '200px' }}
                        onClick={() => setCreateDetailsDialogIsOpen(true)}
                        variant="contained"
                        startIcon={<AddIcon />}
                        text="new analysis"
                    />
                </Box>

                {hasAnalyses ? (
                    <>
                        <Divider />
                        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                            <Box sx={EditAnalysesStyles.matchingSibling}>
                                <Tabs
                                    scrollButtons
                                    sx={EditAnalysesStyles.analysesTabs}
                                    value={selectedAnalysis}
                                    TabScrollButtonProps={{
                                        sx: {
                                            color: 'primary.main',
                                        },
                                    }}
                                    onChange={handleTabChange}
                                    orientation="vertical"
                                    variant="scrollable"
                                >
                                    {(analyses as AnalysisReturn[]).map((analysis, index) => (
                                        <Tab
                                            sx={EditAnalysesStyles.tab}
                                            key={analysis.id}
                                            value={index}
                                            label={analysis.name}
                                        />
                                    ))}
                                </Tabs>
                            </Box>
                            <Box
                                sx={[
                                    EditAnalysesStyles.analysisContainer,
                                    EditAnalysesStyles.heightDefiningSibling,
                                ]}
                            >
                                <EditAnalysis analysis={analyses[selectedAnalysis]} />
                            </Box>
                        </Box>
                    </>
                ) : (
                    <Box component="span" sx={{ color: 'warning.dark' }}>
                        No analyses for this study
                    </Box>
                )}
            </>
        );
    });

export default EditAnalyses;
