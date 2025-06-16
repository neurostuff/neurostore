import { Popper, Grow, Paper, ClickAwayListener, PopperPlacementType } from '@mui/material';

export interface INeurosynthPopper {
    open: boolean;
    anchorElement: HTMLElement | null;
    placement?: PopperPlacementType;
    disablePortal?: boolean;
    style?: React.CSSProperties;
    onClickAway: (event: MouseEvent | TouchEvent) => void;
}

const NeurosynthPopper: React.FC<INeurosynthPopper> = (props) => {
    const {
        open,
        anchorElement,
        disablePortal = true,
        placement = 'bottom-start',
        onClickAway,
        style,
        children,
    } = props;

    return (
        <Popper
            className="tour-highlighted-popper"
            style={{ zIndex: 9999, ...style }}
            anchorEl={anchorElement}
            open={open}
            disablePortal={disablePortal}
            transition
            placement={placement}
        >
            {({ TransitionProps, placement }) => (
                <Grow
                    {...TransitionProps}
                    style={{
                        transformOrigin: placement === 'bottom-start' ? 'left-top' : 'left-bottom',
                    }}
                >
                    <Paper>
                        <ClickAwayListener onClickAway={onClickAway}>
                            <div>{children}</div>
                        </ClickAwayListener>
                    </Paper>
                </Grow>
            )}
        </Popper>
    );
};

export default NeurosynthPopper;
