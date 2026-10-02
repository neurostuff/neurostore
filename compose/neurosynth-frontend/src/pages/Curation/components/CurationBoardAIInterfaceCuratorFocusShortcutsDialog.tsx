import { useAuth0 } from '@auth0/auth0-react';
import { KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight, KeyboardArrowUp } from '@mui/icons-material';
import { Box, Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import { ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export const getCurationFocusModeSeenStorageKey = (userId: string, projectId: string) =>
    `${userId}-${projectId}-seen-curation-focus-mode`;

const KeyboardKey = ({ children }: { children: ReactNode }) => (
    <Box
        component="kbd"
        sx={{
            border: '1px solid',
            borderBottomWidth: 3,
            borderColor: 'divider',
            borderRadius: '6px',
            minWidth: 36,
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.50',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: '0.875rem',
            lineHeight: 1,
        }}
    >
        {children}
    </Box>
);

const ShortcutRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <Stack direction="row" spacing={1.5} alignItems="center">
        <KeyboardKey>{children}</KeyboardKey>
        <Typography variant="body2">{label}</Typography>
    </Stack>
);

const CurationBoardAIInterfaceCuratorFocusShortcutsDialog = () => {
    const { user } = useAuth0();
    const { projectId } = useParams<{ projectId: string }>();
    const storageKey = user?.sub && projectId ? getCurationFocusModeSeenStorageKey(user.sub, projectId) : undefined;
    const [isOpen, setIsOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (!storageKey) return;
        setIsOpen(localStorage.getItem(storageKey) !== 'true');
    }, [storageKey]);

    const handleClose = () => {
        if (dontShowAgain && storageKey) localStorage.setItem(storageKey, 'true');
        setIsOpen(false);
    };

    return (
        <BaseDialog
            isOpen={isOpen}
            dialogTitle="Focus mode shortcuts"
            onCloseDialog={handleClose}
            fullWidth
            maxWidth="sm"
        >
            <Stack spacing={2.5}>
                <Typography variant="body2" color="text.secondary">
                    Use the keyboard to move through studies and review them.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                    <Stack spacing={1} flex={1}>
                        <Typography variant="subtitle2">Review</Typography>
                        <ShortcutRow label="Include or promote">A</ShortcutRow>
                        <ShortcutRow label="Exclude">S</ShortcutRow>
                        <ShortcutRow label="Demote">D</ShortcutRow>
                        <ShortcutRow label="Expand or collapse details">E</ShortcutRow>
                    </Stack>
                    <Stack spacing={1} flex={1}>
                        <Typography variant="subtitle2">Navigate</Typography>
                        <ShortcutRow label="Previous study">
                            <KeyboardArrowUp fontSize="small" />
                        </ShortcutRow>
                        <ShortcutRow label="Next study">
                            <KeyboardArrowDown fontSize="small" />
                        </ShortcutRow>
                        <ShortcutRow label="Scroll up">
                            <KeyboardArrowLeft fontSize="small" />
                        </ShortcutRow>
                        <ShortcutRow label="Scroll down">
                            <KeyboardArrowRight fontSize="small" />
                        </ShortcutRow>
                    </Stack>
                </Stack>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={dontShowAgain}
                            onChange={(event) => setDontShowAgain(event.target.checked)}
                        />
                    }
                    label="Don't show this again"
                />
                <Button variant="contained" disableElevation onClick={handleClose}>
                    Understood
                </Button>
            </Stack>
        </BaseDialog>
    );
};

export default CurationBoardAIInterfaceCuratorFocusShortcutsDialog;
