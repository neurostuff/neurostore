import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { useGetMetaAnalyses } from 'hooks';
import { useHistory, useParams, useRouteMatch } from 'react-router-dom';
import { Add } from '@mui/icons-material';
import { useState } from 'react';
import CreateMetaAnalysisSpecificationDialogBase from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase';

const ViewMetaAnalyses: React.FC = () => {
    const path = useRouteMatch();
    const history = useHistory();
    const { projectId }: { projectId: string } = useParams();
    const { data } = useGetMetaAnalyses(projectId);
    const [createMetaAnalysisDialogIsOpen, setCreateMetaAnalysisDialogIsOpen] = useState(false);
    const handleUpdate = (id?: string) => {
        if (!id) return;
        history.push(`${path.url}/${id}`);
    };

    return (
        <Box>
            <CreateMetaAnalysisSpecificationDialogBase
                isOpen={createMetaAnalysisDialogIsOpen}
                onCloseDialog={() => setCreateMetaAnalysisDialogIsOpen(false)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                    {(data || []).length === 0 && (
                        <Typography color="warning.dark">
                            No Meta-Analyses for this project. Create one using the button on the
                            right.
                        </Typography>
                    )}
                </Box>
                <Box>
                    <Button
                        onClick={() => setCreateMetaAnalysisDialogIsOpen(true)}
                        sx={{ marginBottom: '1rem' }}
                        variant="contained"
                        startIcon={<Add />}
                    >
                        Meta-Analysis Specification
                    </Button>
                </Box>
            </Box>
            <Box sx={{ padding: '0.5rem 0', display: 'flex', flexWrap: 'wrap' }}>
                {(data || []).map((metaAnalysis, index) => (
                    <Card
                        key={metaAnalysis.id || index}
                        sx={{
                            flex: '0 0 400px',
                            margin: '0 15px 15px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                        }}
                    >
                        <CardContent>
                            <Box>
                                <Typography variant="h6">{metaAnalysis.name || ''}</Typography>
                                <Typography>{metaAnalysis.description || ''}</Typography>
                            </Box>
                        </CardContent>
                        <CardActions>
                            <Button onClick={() => handleUpdate(metaAnalysis.id)}>view</Button>
                        </CardActions>
                    </Card>
                ))}
            </Box>
        </Box>
    );
};

export default ViewMetaAnalyses;
