import { Add } from '@mui/icons-material';
import { Box, Button, Divider, Typography } from '@mui/material';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import { useAddOrUpdateAnalysis, useNumStudyAnalyses } from 'pages/Studies/StudyStore';
import { useState } from 'react';
import EditAnalysesList from './EditAnalysesList/EditAnalysesList';
import EditAnalysis from './EditAnalysis/EditAnalysis';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';

const EditAnalyses: React.FC = (props) => {
    const numAnalyses = useNumStudyAnalyses();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>();
    const [createNewAnalysisDialogIsOpen, setCreateNewAnalysisDialogIsOpen] = useState(false);

    const handleCreateNewAnalysis = (name: string, description: string) => {
        addOrUpdateAnalysis({
            name,
            description,
            isNew: true,
            conditions: [],
        });
    };

    const handleSelectAnalysis = (analysisId: string) => {
        setSelectedAnalysisId(analysisId);
    };

    const handleOnDeleteAnalysis = () => {
        setSelectedAnalysisId(undefined);
    };

    return (
        <NeurosynthAccordion
            defaultExpanded
            elevation={0}
            expandIconColor="secondary.main"
            sx={{
                border: '1px solid',
                borderTop: 'none',
                borderColor: 'secondary.main',
                borderRadius: '0 !important',
            }}
            accordionSummarySx={{
                ':hover': {
                    backgroundColor: '#f2f2f2',
                },
            }}
            TitleElement={
                <Typography sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                    Analyses
                </Typography>
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
                        variant="outlined"
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
};

export default EditAnalyses;
