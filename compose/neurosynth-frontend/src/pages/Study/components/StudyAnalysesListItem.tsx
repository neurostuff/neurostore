import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { AnalysisReturn } from 'neurostore-typescript-sdk';
import useDisplayWarnings from 'pages/Study/hooks/useDisplayWarnings';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';
import React, { useMemo } from 'react';

const StudyAnalysesListItem: React.FC<{
    analysis: AnalysisReturn | IStoreAnalysis;
    selected: boolean;
    onSelectAnalysis: (analysisId: string) => void;
}> = React.memo((props) => {
    const { analysis, selected, onSelectAnalysis } = props;
    const { hasDuplicateName, hasNoName, hasNoPoints, hasNonMNICoordinates } = useDisplayWarnings(analysis.id);

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));

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
                    primaryTypographyProps={{
                        variant: mdDown ? 'caption' : 'body1',
                    }}
                    primary={analysis?.name || 'No name'}
                    secondary={mdDown ? undefined : analysis?.description || 'No description'}
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

export default StudyAnalysesListItem;
