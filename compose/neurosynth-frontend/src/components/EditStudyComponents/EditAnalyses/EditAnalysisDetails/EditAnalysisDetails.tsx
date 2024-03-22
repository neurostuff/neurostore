import { Box, TextField, Typography } from '@mui/material';
import {
    useAddOrUpdateAnalysis,
    useStudyAnalysisDescription,
    useStudyAnalysisName,
} from 'pages/Studies/StudyStore';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';
import { useEffect } from 'react';
import { useUpdateAnnotationNoteName } from 'stores/AnnotationStore.actions';

const EditAnalysisDetails: React.FC<{ analysisId?: string; disabled: boolean }> = (props) => {
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const name = useStudyAnalysisName(props.analysisId);
    const description = useStudyAnalysisDescription(props.analysisId);
    const updateAnnotationNoteName = useUpdateAnnotationNoteName();

    useEffect(() => {
        if (!props.analysisId) return;
        let debounce: NodeJS.Timeout;
        debounce = setTimeout(() => {
            updateAnnotationNoteName({
                analysis: props.analysisId,
                analysis_name: name,
            });
        }, 500);

        return () => {
            clearTimeout(debounce);
        };
    }, [name, props.analysisId, updateAnnotationNoteName]);

    const handleUpdateAnalysisDetails = (
        field: keyof IStoreAnalysis,
        analysisId: string,
        value: string
    ) => {
        if (!analysisId) return;
        addOrUpdateAnalysis({
            id: analysisId,
            [field]: value,
        });
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                Analysis Details
            </Typography>
            <TextField
                disabled={props.disabled}
                label="name"
                size="small"
                sx={{ width: '100%', marginBottom: '1rem' }}
                value={name || ''}
                onChange={(event) => {
                    handleUpdateAnalysisDetails('name', props.analysisId || '', event.target.value);
                }}
            />
            <TextField
                disabled={props.disabled}
                onChange={(event) => {
                    handleUpdateAnalysisDetails(
                        'description',
                        props.analysisId || '',
                        event.target.value
                    );
                }}
                label="description"
                size="small"
                sx={{ width: '100%' }}
                value={description || ''}
            />
        </Box>
    );
};

export default EditAnalysisDetails;
