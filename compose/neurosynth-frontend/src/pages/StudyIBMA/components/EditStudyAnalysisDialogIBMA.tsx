import { Box, Button, TextField } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import React, { useEffect, useState } from 'react';
import { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import LoadingButton from 'components/Buttons/LoadingButton';

export type EditStudyAnalysisSavePayload = {
    analysisId: string;
    name: string;
    description: string;
};

const EditStudyAnalysisDialogIBMA: React.FC<{
    analysis: AnalysisBoardRow | null;
    onClose: () => void;
    isLoading: boolean;
    onEditAnalysis: ((payload: EditStudyAnalysisSavePayload) => void | Promise<void>) | undefined;
}> = ({ analysis, onClose, isLoading, onEditAnalysis }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (analysis) {
            setName(analysis.name ?? '');
            setDescription(analysis.description ?? '');
        } else {
            setName('');
            setDescription('');
        }
    }, [analysis]);

    const handleSave = async () => {
        if (!onEditAnalysis) return;
        if (!analysis?.id) return;
        try {
            await onEditAnalysis({
                analysisId: analysis.id,
                name,
                description,
            });
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <BaseDialog
            isOpen={Boolean(analysis)}
            dialogTitle="Edit analysis"
            onCloseDialog={onClose}
            fullWidth
            maxWidth="sm"
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField label="Name" size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField
                    label="Description"
                    size="small"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={onClose} variant="text">
                        Cancel
                    </Button>
                    <LoadingButton
                        isLoading={isLoading}
                        loaderColor="secondary"
                        sx={{ width: '80px' }}
                        onClick={handleSave}
                        variant="contained"
                        color="primary"
                        disableElevation
                        text="Save"
                    />
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default EditStudyAnalysisDialogIBMA;
