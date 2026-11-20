import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { Box } from '@mui/material';

/** The mark on an item with notes; the notes on hover. */
export function NoteMark({ notes }: { notes: string }) {
    return (
        <Box
            component="span"
            role="img"
            aria-label={`noted: ${notes}`}
            title={notes}
            sx={{ display: 'inline-flex', alignItems: 'center', color: 'secondary.main' }}
        >
            <StickyNote2OutlinedIcon sx={{ fontSize: 14 }} />
        </Box>
    );
}
