import { Style } from '../..';

const NavbarStyles: Style = {
    toolbar: {
        // we must set height due to a bug where the child cannot inherit the min-height property of the parent:
        // https://stackoverflow.com/questions/8468066/child-inside-parent-with-min-height-100-not-inheriting-height
        height: '70px',
        justifyContent: 'space-between',
        width: '80%',
        margin: '0 auto',
    },
    mdDown: {
        display: {
            xs: 'flex',
            lg: 'none',
        },
    },
    mdUp: {
        display: {
            xs: 'none',
            lg: 'flex',
        },
    },
    neurosynthLink: {
        textDecoration: 'none',
        color: 'white',
        textTransform: 'lowercase',
        '&:hover': {
            '& img': {
                opacity: '0.8',
            },
            color: '#ef8a24',
        },
    },
};

export default NavbarStyles;
