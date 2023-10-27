import { Add } from '@mui/icons-material';
import { Box, Button, Divider, Typography } from '@mui/material';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import { useAddOrUpdateAnalysis, useNumStudyAnalyses, useStudyId } from 'pages/Studies/StudyStore';
import { useCallback, useState } from 'react';
import EditAnalysesList from './EditAnalysesList/EditAnalysesList';
import EditAnalysis from './EditAnalysis/EditAnalysis';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';
import { useCreateAnnotationNote } from 'stores/AnnotationStore.actions';
import React from 'react';

const EditAnalyses: React.FC = React.memo((props) => {
    const numAnalyses = useNumStudyAnalyses();
    const studyId = useStudyId();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>();
    const [createNewAnalysisDialogIsOpen, setCreateNewAnalysisDialogIsOpen] = useState(false);

    const handleCreateNewAnalysis = (name: string, description: string) => {
        if (!studyId) return;

        const createdAnalysis = addOrUpdateAnalysis({
            name,
            description,
            isNew: true,
            conditions: [],
        });

        if (!createdAnalysis.id) return;

        createAnnotationNote(createdAnalysis.id, studyId, name);
    };

    const handleSelectAnalysis = useCallback((analysisId: string) => {
        setSelectedAnalysisId(analysisId);
    }, []);

    const handleOnDeleteAnalysis = () => {
        setSelectedAnalysisId(undefined);
    };

    return (
        <NeurosynthAccordion
            elevation={0}
            defaultExpanded
            expandIconColor="secondary.main"
            sx={EditStudyComponentsStyles.accordion}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>Analyses</Typography>
            }
        >
            <Box sx={{ width: '100%', margin: '0.5rem 0' }}>
                <Box
                    sx={{
                        marginBottom: '1rem',
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    {numAnalyses === 0 && (
                        <Typography sx={{ color: 'warning.dark' }}>
                            There are no analyses for this study.
                        </Typography>
                    )}
                    <CreateDetailsDialog
                        titleText="Create new analysis"
                        onCreate={handleCreateNewAnalysis}
                        onCloseDialog={() => setCreateNewAnalysisDialogIsOpen(false)}
                        isOpen={createNewAnalysisDialogIsOpen}
                    />
                    <Button
                        onClick={() => setCreateNewAnalysisDialogIsOpen(true)}
                        sx={{
                            width: '150px',
                            marginLeft: 'auto',
                        }}
                        variant="contained"
                        disableElevation
                        startIcon={<Add />}
                    >
                        analysis
                    </Button>
                </Box>
                {numAnalyses > 0 && (
                    <>
                        <Divider />
                        <Box sx={{ display: 'flex' }}>
                            <EditAnalysesList
                                selectedAnalysisId={selectedAnalysisId}
                                onSelectAnalysis={handleSelectAnalysis}
                            />
                            <Box
                                sx={{
                                    padding: '1rem 0 1rem 1rem',
                                    width: 'calc(100% - 250px - 1rem)',
                                }}
                            >
                                <EditAnalysis
                                    onDeleteAnalysis={handleOnDeleteAnalysis}
                                    analysisId={selectedAnalysisId}
                                />
                            </Box>
                        </Box>
                    </>
                )}
            </Box>
        </NeurosynthAccordion>
    );
});

export default EditAnalyses;
