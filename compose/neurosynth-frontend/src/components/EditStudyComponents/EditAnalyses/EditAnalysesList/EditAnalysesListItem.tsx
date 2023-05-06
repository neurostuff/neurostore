import { ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { IStorePoint } from 'pages/Studies/StudyStore';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import React from 'react';
import { PointReturn } from 'neurostore-typescript-sdk';

const EditAnalysesListItem: React.FC<{
    analysisId?: string;
    name?: string | null;
    points?: IStorePoint[] | (string | PointReturn)[];
    description?: string | null;
    selected: boolean;
    index: number;
    onSelectAnalysis: (analysisId: string, index: number) => void;
}> = React.memo((props) => {
    const { name, description, selected, analysisId, points, onSelectAnalysis } = props;

    const handleSelectAnalysis = () => {
        if (!analysisId) return;
        onSelectAnalysis(analysisId, props.index);
    };

    const showWarningIcon = (points?.length || 0) === 0;

    return (
        <ListItem disablePadding divider>
            <ListItemButton onClick={handleSelectAnalysis} selected={selected}>
                <ListItemText
                    sx={{ wordBreak: 'break-all' }}
                    primary={name || ''}
                    secondary={description || ''}
                />
                {showWarningIcon && (
                    <Tooltip title="There is a potential issue" placement="top">
                        <ListItemIcon>
                            <ErrorOutlineIcon color="warning" />
                        </ListItemIcon>
                    </Tooltip>
                )}
            </ListItemButton>
        </ListItem>
    );
});

export default EditAnalysesListItem;
