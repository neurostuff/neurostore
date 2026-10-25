import { KeyboardArrowDown, KeyboardArrowLeft, KeyboardArrowRight, KeyboardArrowUp } from '@mui/icons-material';
import { Button, Chip, Stack, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import { ReactNode } from 'react';

const KeyboardKey = ({ children }: { children: ReactNode }) => (
    <Chip component="kbd" variant="outlined" label={children} sx={{ minWidth: 40, borderRadius: '4px' }} />
);

const ShortcutRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <Stack direction="row" spacing={1.5} alignItems="center">
        {children}
        <Typography variant="body2">{label}</Typography>
    </Stack>
);

const CrosshairControlsDialog = ({ isOpen, onCloseDialog }: { isOpen: boolean; onCloseDialog: () => void }) => (
    <BaseDialog isOpen={isOpen} dialogTitle="Crosshair controls" onCloseDialog={onCloseDialog} fullWidth maxWidth="sm">
        <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
                Arrow keys move the crosshair. Hold Shift to step through slices.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Stack spacing={1} flex={1}>
                    <Typography variant="subtitle2">In plane</Typography>
                    <ShortcutRow label="Move left (sagittal plane)">
                        <KeyboardKey>
                            <KeyboardArrowLeft fontSize="small" />
                        </KeyboardKey>
                    </ShortcutRow>
                    <ShortcutRow label="Move right (sagittal plane)">
                        <KeyboardKey>
                            <KeyboardArrowRight fontSize="small" />
                        </KeyboardKey>
                    </ShortcutRow>
                    <ShortcutRow label="Move up (coronal plane)">
                        <KeyboardKey>
                            <KeyboardArrowUp fontSize="small" />
                        </KeyboardKey>
                    </ShortcutRow>
                    <ShortcutRow label="Move down (coronal plane)">
                        <KeyboardKey>
                            <KeyboardArrowDown fontSize="small" />
                        </KeyboardKey>
                    </ShortcutRow>
                </Stack>
                <Stack spacing={1} flex={1}>
                    <Typography variant="subtitle2">Through slices</Typography>
                    <ShortcutRow label="Higher slice (axial plane)">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <KeyboardKey>Shift</KeyboardKey>
                            <KeyboardKey>
                                <KeyboardArrowUp fontSize="small" />
                            </KeyboardKey>
                        </Stack>
                    </ShortcutRow>
                    <ShortcutRow label="Lower slice (axial plane)">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <KeyboardKey>Shift</KeyboardKey>
                            <KeyboardKey>
                                <KeyboardArrowDown fontSize="small" />
                            </KeyboardKey>
                        </Stack>
                    </ShortcutRow>
                </Stack>
            </Stack>
            <Button variant="contained" disableElevation onClick={onCloseDialog}>
                Understood
            </Button>
        </Stack>
    </BaseDialog>
);

export default CrosshairControlsDialog;
