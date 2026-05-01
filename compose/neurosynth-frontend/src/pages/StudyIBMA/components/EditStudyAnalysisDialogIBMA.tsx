import { Box, Button, TextField } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import React, { useEffect, useState } from 'react';
import { useAddOrUpdateAnalysis } from 'stores/study/StudyStore';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';

const EditStudyAnalysisDialogIBMA: React.FC<{
    analysis: IStoreAnalysis | null;
    onClose: () => void;
}> = ({ analysis, onClose }) => {
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
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

    const handleSave = () => {
        if (!analysis?.id) return;
        addOrUpdateAnalysis({
            id: analysis.id,
            name,
            description,
        });
        onClose();
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
                    <Button onClick={handleSave} variant="contained" disableElevation>
                        Save
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default EditStudyAnalysisDialogIBMA;
