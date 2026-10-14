import { Dialog, DialogContent, DialogTitle, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { useReviewStore } from '../store/context';
import { SHORTCUTS } from './shortcuts';

const keyLabel = (key: string) => (key.length === 1 && key !== key.toLowerCase() ? `Shift+${key}` : key.toUpperCase());

export function ShortcutHelp() {
    const open = useReviewStore((s) => s.helpOpen);
    const toggleHelp = useReviewStore((s) => s.toggleHelp);
    return (
        <Dialog open={open} onClose={() => toggleHelp(false)} aria-labelledby="shortcut-help-title">
            <DialogTitle id="shortcut-help-title">Keyboard shortcuts</DialogTitle>
            <DialogContent>
                <Table size="small">
                    <TableBody>
                        {SHORTCUTS.map((shortcut) => (
                            <TableRow key={shortcut.label}>
                                <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                    {keyLabel(shortcut.keys[0])}
                                </TableCell>
                                <TableCell>{shortcut.label}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    );
}
