import { Dialog, DialogContent, DialogTitle, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { useView } from '../store/context';
import { DEFAULT_SHARE, MIN_SHARE, SHIFT_STEP, STEP } from './paneShare';
import { keyLabel, SHORTCUTS } from './shortcuts';

const KEY_CELL = { fontFamily: 'monospace', whiteSpace: 'nowrap' };

const DIVIDER_KEYS = [
    [
        '← →',
        `move the divider between the text and the inspector ${STEP}%; drag it, or double-click it to go back to ${DEFAULT_SHARE}/${100 - DEFAULT_SHARE}`,
    ],
    ['Shift+← →', `move the divider ${SHIFT_STEP}%`],
    ['Home End', `move the divider to the narrowest text pane (${MIN_SHARE}%) or the narrowest inspector`],
];

export function ShortcutHelp() {
    const open = useView((s) => s.helpOpen);
    const toggleHelp = useView((s) => s.toggleHelp);
    return (
        <Dialog open={open} onClose={() => toggleHelp(false)} aria-labelledby="shortcut-help-title">
            <DialogTitle id="shortcut-help-title">Keyboard shortcuts</DialogTitle>
            <DialogContent>
                <Table size="small">
                    <TableBody>
                        {SHORTCUTS.map((shortcut) => (
                            <TableRow key={`${shortcut.scope}:${shortcut.label}`}>
                                <TableCell sx={KEY_CELL}>{keyLabel(shortcut.keys[0])}</TableCell>
                                <TableCell>{shortcut.label}</TableCell>
                                <TableCell>{shortcut.scope ?? 'anywhere'}</TableCell>
                            </TableRow>
                        ))}
                        {DIVIDER_KEYS.map(([keys, label]) => (
                            <TableRow key={keys}>
                                <TableCell sx={KEY_CELL}>{keys}</TableCell>
                                <TableCell>{label}</TableCell>
                                <TableCell>the pane divider</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    );
}
