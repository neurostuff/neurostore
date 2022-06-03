import { Style } from '../../..';

const NavbarToolbarStyles: Style = {
    link: {
        textDecoration: 'none',
        height: '100%',
        display: 'flex',
        color: 'primary.contrastText',
        alignItems: 'center',
        padding: '0 8px',
    },
    navLinksContainer: {
        height: '100%',
        display: 'flex',
    },
    button: {
        margin: '0',
        padding: '0',
        '& span': {
            height: '100%',
        },
        '&:hover': {
            backgroundColor: '#00689e !important',
        },
    },
};

export default NavbarToolbarStyles;
