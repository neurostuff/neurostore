import { Dialog, DialogContent, DialogTitle, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { useView } from '../store/context';
import { keyLabel, SHORTCUTS } from './shortcuts';

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
                                <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                    {keyLabel(shortcut.keys[0])}
                                </TableCell>
                                <TableCell>{shortcut.label}</TableCell>
                                <TableCell>{shortcut.scope ?? 'anywhere'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    );
}
