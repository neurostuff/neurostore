import { ListItem, ListItemButton, ListItemText } from '@mui/material';
import React from 'react';

const EditAnalysesListItem: React.FC<{
    analysisId?: string;
    name?: string | null;
    description?: string | null;
    selected: boolean;
    index: number;
    onSelectAnalysis: (analysisId: string, index: number) => void;
}> = React.memo((props) => {
    const { name, description, selected, analysisId, onSelectAnalysis } = props;

    const handleSelectAnalysis = () => {
        if (!analysisId) return;
        onSelectAnalysis(analysisId, props.index);
    };

    return (
        <ListItem disablePadding divider>
            <ListItemButton onClick={handleSelectAnalysis} selected={selected}>
                <ListItemText
                    sx={{ wordBreak: 'break-all' }}
                    primary={name || ''}
                    secondary={description || ''}
                />
            </ListItemButton>
        </ListItem>
    );
});

export default EditAnalysesListItem;
