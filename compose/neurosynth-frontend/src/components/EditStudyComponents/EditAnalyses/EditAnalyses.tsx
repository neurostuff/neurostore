import { Add } from '@mui/icons-material';
import { Box, Button, Divider, Typography } from '@mui/material';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { useAddOrUpdateAnalysis, useStudyAnalyses, useStudyId } from 'pages/Studies/StudyStore';
import React, { useCallback, useEffect, useState } from 'react';
import { useCreateAnnotationNote } from 'stores/AnnotationStore.actions';
import EditAnalysesList from './EditAnalysesList/EditAnalysesList';
import EditAnalysis from './EditAnalysis/EditAnalysis';

const EditAnalyses: React.FC = React.memo((props) => {
    const analyses = useStudyAnalyses();
    const studyId = useStudyId();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>();

    const handleCreateNewAnalysis = () => {
        if (!studyId) return;

        const createdAnalysis = addOrUpdateAnalysis({
            name: '',
            description: '',
            isNew: true,
            conditions: [],
        });

        if (!createdAnalysis.id) return;

        createAnnotationNote(createdAnalysis.id, studyId, '');
        setSelectedAnalysisId(createdAnalysis.id);
    };

    const handleSelectAnalysis = useCallback((analysisId: string) => {
        setSelectedAnalysisId(analysisId);
    }, []);

    const handleAfterAnalysisDeleted = () => {
        if (analyses.length <= 1) {
            setSelectedAnalysisId(undefined);
            return;
        }
        const analysisIndex = analyses.findIndex((analysis) => analysis.id === selectedAnalysisId);

        if (analysisIndex === 0) {
            setSelectedAnalysisId(analyses[1].id);
            return;
        }
        setSelectedAnalysisId(analyses[analysisIndex - 1].id);
    };

    useEffect(() => {
        if (!selectedAnalysisId && analyses.length > 0) {
            // select the first analysis on first render
            setSelectedAnalysisId(analyses[0].id);
        }
    }, [analyses, selectedAnalysisId]);

    return (
        <NeurosynthAccordion
            elevation={0}
            defaultExpanded
            expandIconColor="secondary.main"
            sx={[EditStudyComponentsStyles.accordion]}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>Analyses</Typography>
            }
        >
            <Box sx={{ width: '100%', margin: '0.5rem 0' }}>
                <Box sx={{ marginBottom: '1rem' }}>
                    {analyses.length === 0 && (
                        <Typography sx={{ color: 'warning.dark' }} gutterBottom>
                            There are no analyses for this study.
                        </Typography>
                    )}
                    <Button
                        onClick={handleCreateNewAnalysis}
                        sx={{ width: '150px' }}
                        variant="contained"
                        disableElevation
                        startIcon={<Add />}
                    >
                        analysis
                    </Button>
                </Box>
                {analyses.length > 0 && (
                    <>
                        <Divider />
                        <Box sx={{ display: 'flex' }}>
                            <EditAnalysesList
                                analyses={analyses}
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
                                    onDeleteAnalysis={handleAfterAnalysisDeleted}
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
