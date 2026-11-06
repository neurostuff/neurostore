import { Tooltip, type TooltipProps } from '@mui/material';
import type { ReactElement } from 'react';

/**
 * A control's hover hint, as a tooltip that describes the control, never names it. A MUI tooltip (`Hint`) is for
 * controls mounted once; a native `title` is for controls mounted at each focus, where a tooltip costs, and for
 * plain text.
 */
export function Hint({
    title,
    placement,
    children,
}: {
    title: string;
    placement?: TooltipProps['placement'];
    children: ReactElement;
}) {
    return (
        <Tooltip title={title} placement={placement} describeChild>
            {children}
        </Tooltip>
    );
}
