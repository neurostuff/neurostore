import { Style } from 'index';

const NavToolbarStyles: Style = {
    menuItemColor: {
        color: 'primary.contrastText',
        '&:hover': { backgroundColor: '#00689f' },
    },
    menuItemPadding: {
        paddingLeft: {
            md: '10px',
            lg: '15px',
        },
        paddingRight: {
            md: '10px',
            lg: '15px',
        },
    },
    menuItem: {
        fontSize: '1rem',
    },
};

export default NavToolbarStyles;
