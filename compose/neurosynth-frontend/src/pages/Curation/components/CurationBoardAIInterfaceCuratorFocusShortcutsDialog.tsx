import { useAuth0 } from '@auth0/auth0-react';
import { KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight, KeyboardArrowUp } from '@mui/icons-material';
import { Button, Checkbox, Chip, FormControlLabel, Stack, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import { useUserCanEdit } from 'hooks';
import { ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectUser } from 'stores/projects/ProjectStore';

export const getCurationFocusModeSeenStorageKey = (userId: string, projectId: string) =>
    `${userId}-${projectId}-seen-curation-focus-mode`;

const KeyboardKey = ({ children }: { children: ReactNode }) => (
    <Chip component="kbd" variant="outlined" label={children} sx={{ minWidth: 40, borderRadius: '4px' }} />
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
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const storageKey = projectId
        ? getCurationFocusModeSeenStorageKey(user?.sub ?? 'non-authenticated-user', projectId)
        : undefined;
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
                        {canEdit && (
                            <>
                                <ShortcutRow label="Include or promote">A</ShortcutRow>
                                <ShortcutRow label="Exclude">S</ShortcutRow>
                                <ShortcutRow label="Demote">D</ShortcutRow>
                            </>
                        )}
                        <ShortcutRow label="Expand or collapse details">E</ShortcutRow>
                    </Stack>
                    <Stack spacing={1} flex={1}>
                        <Typography variant="subtitle2">Navigate</Typography>
                        <ShortcutRow label="Previous study">
                            <KeyboardArrowLeft fontSize="small" />
                        </ShortcutRow>
                        <ShortcutRow label="Next study">
                            <KeyboardArrowRight fontSize="small" />
                        </ShortcutRow>
                        <ShortcutRow label="Scroll up">
                            <KeyboardArrowUp fontSize="small" />
                        </ShortcutRow>
                        <ShortcutRow label="Scroll down">
                            <KeyboardArrowDown fontSize="small" />
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
