import { Popper, Grow, Paper, ClickAwayListener, PopperPlacementType } from '@mui/material';

export interface INeurosynthPopper {
    open: boolean;
    anchorElement: HTMLElement | null;
    placement?: PopperPlacementType;
    onClickAway: (event: MouseEvent | TouchEvent) => void;
}

const NeurosynthPopper: React.FC<INeurosynthPopper> = (props) => {
    const { open, anchorElement, placement = 'bottom-start', onClickAway, children } = props;

    return (
        <Popper
            className="tour-highlighted-popper"
            style={{ zIndex: 1 }}
            anchorEl={anchorElement}
            open={open}
            disablePortal
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
