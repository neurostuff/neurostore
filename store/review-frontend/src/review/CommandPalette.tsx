import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    ListItemButton,
    ListItemText,
    ListSubheader,
    TextField,
} from '@mui/material';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useReviewStores, useSession, useShown, useView } from '../store/context';
import { buildPaletteIndex, PALETTE_KINDS, searchPalette, type PaletteEntry } from './search';
import { useStartFocus } from './startFocus';

function PaletteBody() {
    const stores = useReviewStores();
    const search = useStartFocus<HTMLInputElement>();
    const index = useShown((shown) => shown);
    const text = useSession((s) => s.bundle.text);
    const palette = useMemo(() => buildPaletteIndex(index, text), [index, text]);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const groups = useMemo(() => searchPalette(palette, query), [palette, query]);
    const sections = useMemo(() => {
        let first = 0;
        return groups.map((group) => {
            const start = first;
            first += group.entries.length;
            return { ...group, first: start };
        });
    }, [groups]);
    const results = useMemo(() => groups.flatMap((group) => group.entries), [groups]);

    const choose = (entry: PaletteEntry) => {
        const view = stores.view.getState();
        view.togglePalette(false);
        entry.run(view);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const last = Math.max(results.length - 1, 0);
            setActive((at) => Math.min(Math.max(at + (event.key === 'ArrowDown' ? 1 : -1), 0), last));
        } else if (event.key === 'Enter' && results[active]) {
            event.preventDefault();
            choose(results[active]);
        }
    };

    return (
        <DialogContent>
            <TextField
                inputRef={search}
                fullWidth
                size="small"
                placeholder="entities, slots, values and paper text"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                }}
                onKeyDown={onKeyDown}
                inputProps={{ 'aria-label': 'search' }}
            />
            <Box role="listbox" aria-label="results">
                {sections.map((section) => (
                    <Box key={section.kind} role="group" aria-label={PALETTE_KINDS[section.kind]}>
                        <ListSubheader component="div">{PALETTE_KINDS[section.kind]}</ListSubheader>
                        {section.entries.map((entry, i) => {
                            const position = section.first + i;
                            return (
                                <ListItemButton
                                    key={entry.id}
                                    role="option"
                                    aria-selected={position === active}
                                    selected={position === active}
                                    onClick={() => choose(entry)}
                                >
                                    <ListItemText primary={entry.label} secondary={entry.detail} />
                                </ListItemButton>
                            );
                        })}
                    </Box>
                ))}
            </Box>
        </DialogContent>
    );
}

export function CommandPalette() {
    const open = useView((s) => s.paletteOpen);
    const togglePalette = useView((s) => s.togglePalette);
    return (
        <Dialog
            open={open}
            onClose={() => togglePalette(false)}
            fullWidth
            maxWidth="sm"
            aria-labelledby="command-palette-title"
        >
            <DialogTitle id="command-palette-title">Command palette</DialogTitle>
            <PaletteBody />
        </Dialog>
    );
}
