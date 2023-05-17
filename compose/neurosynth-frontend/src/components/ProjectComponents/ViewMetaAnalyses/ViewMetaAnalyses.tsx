import { Add } from '@mui/icons-material';
import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import CreateMetaAnalysisSpecificationDialogBase from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase';
import { useGetMetaAnalyses } from 'hooks';
import { useState } from 'react';
import { useHistory, useParams, useRouteMatch } from 'react-router-dom';

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
                <Box sx={{ marginRight: '1%' }}>
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
                {(data || []).map((metaAnalysis, index) => {
                    const date = new Date(metaAnalysis.created_at || '');
                    return (
                        <Card
                            key={metaAnalysis.id || index}
                            sx={{
                                flex: '0 1 23%',
                                margin: '10px 1%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                            }}
                        >
                            <CardContent>
                                <Box>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography
                                            sx={{ color: 'secondary.main' }}
                                            variant="body2"
                                        >
                                            EDITABLE
                                        </Typography>
                                        <Typography variant="body2">
                                            {`${date.toLocaleDateString()} ${date.toLocaleTimeString()}`}
                                        </Typography>
                                    </Box>
                                    <Typography variant="h6">{metaAnalysis.name || ''}</Typography>
                                    <Typography>{metaAnalysis.description || ''}</Typography>
                                </Box>
                            </CardContent>
                            <CardActions>
                                <Button
                                    sx={{ width: '100%' }}
                                    onClick={() => handleUpdate(metaAnalysis.id)}
                                >
                                    view
                                </Button>
                            </CardActions>
                        </Card>
                    );
                })}
            </Box>
        </Box>
    );
};

export default ViewMetaAnalyses;
