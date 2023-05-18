import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { isCoordinateMNI } from 'components/DisplayStudy/DisplayAnalyses/DisplayAnalysisWarnings/DisplayAnalysisWarnings';
import { AnalysisReturn, PointReturn } from 'neurostore-typescript-sdk';
import { IStoreAnalysis, IStorePoint } from 'pages/Studies/StudyStore';
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

    const coordinatesAreMNI = (
        (props.analysis.points || []) as Array<IStorePoint> | Array<PointReturn>
    ).every((x) => {
        const coordinates = x.coordinates || [0, 0, 0];
        return isCoordinateMNI(coordinates[0], coordinates[1], coordinates[2]);
    });
    const hasPoints = (analysis?.points?.length || 0) > 0;
    const showWarningIcon = !hasPoints || !coordinatesAreMNI;

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
