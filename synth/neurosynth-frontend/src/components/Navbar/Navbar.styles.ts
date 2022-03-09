import { Style } from '../..';

const NavbarStyles: Style = {
    toolbar: {
        // "height: 1px" is a workaround due to a bug where the child cannot inherit the min-height property of the parent:
        // https://stackoverflow.com/questions/8468066/child-inside-parent-with-min-height-100-not-inheriting-height
        height: '1px',
        justifyContent: 'space-between',
        width: '80%',
        margin: '0 auto',
    },
    mdDown: {
        display: {
            xs: 'flex',
            md: 'none',
        },
    },
    mdUp: {
        display: {
            xs: 'none',
            md: 'flex',
        },
    },
    neurosynthLink: {
        textDecoration: 'none',
        color: 'white',
        textTransform: 'lowercase',
        '&:hover': {
            color: '#ef8a24',
        },
    },
};

export default NavbarStyles;
