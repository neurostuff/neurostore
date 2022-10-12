import { Style } from '../..';

const NavbarStyles: Style = {
    toolbar: {
        // we must set height due to a bug where the child cannot inherit the min-height property of the parent:
        // https://stackoverflow.com/questions/8468066/child-inside-parent-with-min-height-100-not-inheriting-height
        height: '70px',
        justifyContent: 'space-between',
        width: {
            xs: '90%',
            md: '80%',
        },
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
};

export default NavbarStyles;
