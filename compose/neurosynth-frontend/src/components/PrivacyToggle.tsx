import { Lock, Public } from '@mui/icons-material';
import { ToggleButtonGroup, ToggleButton, Box, Tooltip, CircularProgress } from '@mui/material';

const privacyToggleButtonSx = {
    borderRadius: '6px',
    px: 1,
    py: 0,
    height: '24px',
    fontSize: '0.75rem',
    lineHeight: 1,
};

const privacyToggleIconSx = {
    marginLeft: '4px',
    fontSize: '16px',
};

const PrivacyToggle = (props: {
    isPublic: boolean;
    canEdit: boolean;
    onChange: (isPublic: boolean) => void;
    tooltipTitle?: string;
    isLoading?: boolean;
}) => {
    const { isPublic, canEdit, onChange, tooltipTitle, isLoading = false } = props;

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '24px' }}>
                <CircularProgress size={18} aria-label="Updating privacy" />
            </Box>
        );
    }

    if (!canEdit) {
        return (
            <Box>
                <ToggleButton selected value="PUBLIC" disabled color="primary" sx={privacyToggleButtonSx}>
                    {isPublic ? (
                        <>
                            Public <Public sx={privacyToggleIconSx} />
                        </>
                    ) : (
                        <>
                            Private <Lock sx={privacyToggleIconSx} />
                        </>
                    )}
                </ToggleButton>
            </Box>
        );
    }

    const toggleButtonGroup = (
        <ToggleButtonGroup
            exclusive
            onChange={(_event, newVal) => {
                if (newVal === null) return;
                const nextIsPublic = newVal === 'PUBLIC';
                if (nextIsPublic === isPublic) return;
                onChange(nextIsPublic);
            }}
            color="primary"
            value={isPublic ? 'PUBLIC' : 'PRIVATE'}
            size="small"
        >
            <ToggleButton value="PUBLIC" sx={privacyToggleButtonSx}>
                Public <Public sx={privacyToggleIconSx} />
            </ToggleButton>
            <ToggleButton value="PRIVATE" sx={privacyToggleButtonSx}>
                Private <Lock sx={privacyToggleIconSx} />
            </ToggleButton>
        </ToggleButtonGroup>
    );

    return <Box>{tooltipTitle ? <Tooltip title={tooltipTitle}>{toggleButtonGroup}</Tooltip> : toggleButtonGroup}</Box>;
};

export default PrivacyToggle;
