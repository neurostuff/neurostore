import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { IStoreAnalysis } from 'pages/Studies/StudyStore';
import React from 'react';

const EditAnalysesListItem: React.FC<{
    analysis: AnalysisReturn | IStoreAnalysis;
    selected: boolean;
    index: number;
    onSelectAnalysis: (analysisId: string, index: number) => void;
}> = React.memo((props) => {
    const { analysis, selected, onSelectAnalysis } = props;

    const handleSelectAnalysis = () => {
        if (!analysis.id) return;
        onSelectAnalysis(analysis.id, props.index);
    };

    const coordinatesExistOutsideTheBrain = true;
    const hasPoints = (analysis?.points?.length || 0) > 0;

    const showWarningIcon = !hasPoints || coordinatesExistOutsideTheBrain;

    return (
        <ListItem disablePadding divider>
            <ListItemButton onClick={handleSelectAnalysis} selected={selected}>
                <ListItemText
                    sx={{ wordBreak: 'break-all' }}
                    primary={analysis?.name || ''}
                    secondary={analysis?.description || ''}
                />
                {showWarningIcon && (
                    <Tooltip title="This analysis has a warning" placement="top">
                        <ListItemIcon sx={{ minWidth: 0 }}>
                            <ErrorOutlineIcon color="warning" />
                        </ListItemIcon>
                    </Tooltip>
                )}
            </ListItemButton>
        </ListItem>
    );
});

export default EditAnalysesListItem;
