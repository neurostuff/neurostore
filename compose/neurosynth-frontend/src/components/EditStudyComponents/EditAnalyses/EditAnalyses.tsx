import { Add, ExpandMore } from '@mui/icons-material';
import {
    Accordion,
    AccordionActions,
    AccordionSummary,
    Box,
    Button,
    Divider,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    TextField,
    Typography,
} from '@mui/material';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import { useAddOrUpdateAnalysis, useStudyAnalyses } from 'pages/Studies/StudyStore';
import { useState } from 'react';
import EditAnalysisConditions from './EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';

const EditAnalyses: React.FC = (props) => {
    const analyses = useStudyAnalyses();
    const createNewAnalysis = useAddOrUpdateAnalysis();
    const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);
    const [createNewAnnotationDialogIsOpen, setCreateNewAnnotationDialogIsOpen] = useState(false);

    const currentlySelectAnalysis = analyses[selectedAnalysisIndex];

    const handleCreateNewAnalysis = (name: string, description: string) => {
        createNewAnalysis({
            name,
            description,
            isNew: true,
            conditions: [],
        });
    };

    return (
        <Box>
            <Accordion elevation={0} defaultExpanded>
                <AccordionSummary
                    sx={{ ':hover': { backgroundColor: '#f7f7f7' } }}
                    expandIcon={<ExpandMore />}
                >
                    <Typography sx={{ fontWeight: 'bold' }}>Study Analyses</Typography>
                </AccordionSummary>
                <AccordionActions>
                    <Box sx={{ width: '100%', padding: '0 1rem' }}>
                        <Box
                            sx={{
                                marginBottom: '1rem',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <CreateDetailsDialog
                                titleText="Create new annotation"
                                onCreate={handleCreateNewAnalysis}
                                onCloseDialog={() => setCreateNewAnnotationDialogIsOpen(false)}
                                isOpen={createNewAnnotationDialogIsOpen}
                            />
                            <Button
                                onClick={() => setCreateNewAnnotationDialogIsOpen(true)}
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

                        <Divider />
                        {analyses.length === 0 ? (
                            <Typography sx={{ color: 'warning.dark', marginTop: '1rem' }}>
                                No Analyses for this study
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', minHeight: '80vh', maxHeight: '80vh' }}>
                                <Box
                                    sx={{
                                        borderLeft: '1px solid lightgray',
                                        borderRight: '1px solid lightgray',
                                    }}
                                >
                                    <List
                                        sx={{
                                            minHeight: '80vh',
                                            overflowY: 'auto',
                                            width: '250px',
                                        }}
                                        disablePadding
                                    >
                                        {analyses.map((analysis, index) => (
                                            <ListItem key={analysis.id} disablePadding divider>
                                                <ListItemButton
                                                    onClick={() => setSelectedAnalysisIndex(index)}
                                                    selected={index === selectedAnalysisIndex}
                                                >
                                                    <ListItemText
                                                        primary={analysis.name}
                                                        secondary={analysis.description}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                                <Box sx={{ padding: '1rem', width: '100%' }}>
                                    <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                                        Analysis Details
                                    </Typography>
                                    <TextField
                                        label="analysis name"
                                        size="small"
                                        sx={{ width: '100%', marginBottom: '1rem' }}
                                        value={currentlySelectAnalysis.name}
                                    />
                                    <TextField
                                        label="analysis description"
                                        size="small"
                                        sx={{ width: '100%' }}
                                        value={currentlySelectAnalysis.description}
                                    />
                                    <Box sx={{ marginTop: '2rem' }}>
                                        <Typography
                                            sx={{ marginBottom: '1rem', fontWeight: 'bold' }}
                                        >
                                            Analysis Coordinates
                                        </Typography>
                                        <EditAnalysisPoints />
                                    </Box>
                                    <Box sx={{ marginTop: '2rem' }}>
                                        <Typography
                                            sx={{ marginBottom: '1rem', fontWeight: 'bold' }}
                                        >
                                            Analysis Conditions
                                        </Typography>
                                        <EditAnalysisConditions {...currentlySelectAnalysis} />
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </Box>
                </AccordionActions>
            </Accordion>
        </Box>
    );
};

export default EditAnalyses;
