import { Popper, Grow, Paper, ClickAwayListener } from '@mui/material';

export interface INeurosynthPopper {
    open: boolean;
    anchorElement: HTMLButtonElement | null;
    onClickAway: (event: MouseEvent | TouchEvent) => void;
}

const NeurosynthPopper: React.FC<INeurosynthPopper> = (props) => {
    return (
        <Popper
            style={{ zIndex: 1 }}
            anchorEl={props.anchorElement}
            open={props.open}
            disablePortal
            transition
            placement="bottom-start"
        >
            {({ TransitionProps, placement }) => (
                <Grow
                    {...TransitionProps}
                    style={{
                        transformOrigin: placement === 'bottom-start' ? 'left-top' : 'left-bottom',
                    }}
                >
                    <Paper>
                        <ClickAwayListener onClickAway={props.onClickAway}>
                            <div>{props.children}</div>
                        </ClickAwayListener>
                    </Paper>
                </Grow>
            )}
        </Popper>
    );
};

export default NeurosynthPopper;
