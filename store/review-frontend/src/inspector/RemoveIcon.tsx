import CancelIcon from '@mui/icons-material/Cancel';
import type { SvgIconProps } from '@mui/material';

/** A chip's remove control: MUI passes it the chip's onDelete, and Backspace or Delete on the chip does the same. */
export function RemoveIcon({ label, ...props }: SvgIconProps & { label: string }) {
    return <CancelIcon role="button" aria-label={label} aria-hidden={false} {...props} />;
}
