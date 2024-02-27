import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import useDisplayWarnings from 'components/DisplayStudy/DisplayAnalyses/DisplayAnalysisWarnings/useDisplayWarnings';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';
import React, { useMemo } from 'react';

const EditAnalysesListItem: React.FC<{
    analysis: AnalysisReturn | IStoreAnalysis;
    selected: boolean;
    onSelectAnalysis: (analysisId: string) => void;
}> = React.memo((props) => {
    const { analysis, selected, onSelectAnalysis } = props;
    const { hasDuplicateName, hasNoName, hasNoPoints, hasNonMNICoordinates } = useDisplayWarnings(
        analysis.id
    );

    const handleSelectAnalysis = () => {
        if (!analysis.id) return;
        onSelectAnalysis(analysis.id);
    };

    const showWarningIcon = useMemo(() => {
        return hasDuplicateName || hasNoName || hasNoPoints || hasNonMNICoordinates;
    }, [hasDuplicateName, hasNoName, hasNoPoints, hasNonMNICoordinates]);

    return (
        <ListItem disablePadding divider>
            <ListItemButton
                autoFocus={selected}
                sx={{ minHeight: '49px' }}
                onClick={handleSelectAnalysis}
                selected={selected}
            >
                <ListItemText
                    sx={{ wordBreak: 'break-word', color: analysis?.name ? '' : 'warning.dark' }}
                    secondaryTypographyProps={{
                        color: analysis?.description ? '' : 'warning.dark',
                    }}
                    primary={analysis?.name || 'No name'}
                    secondary={analysis?.description || 'No description'}
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
