import { Style } from '../../..';

const NavbarToolbarStyles: Style = {
    link: {
        textDecoration: 'none',
        height: '100%',
        display: 'flex',
        color: 'primary.contrastText',
        alignItems: 'center',
        padding: '0 8px',
        whiteSpace: 'nowrap',
    },
    logoText: {
        fontSize: {
            md: '1rem',
            lg: '1.25rem',
        },
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
    buttonOverride: {
        width: '100%',
    },
    innerButtonOverride: {
        marginRight: 'auto',
        padding: '8px 20px',
        color: 'black',
        justifyContent: 'start',
    },
    list: {
        width: '240px',
    },
    listItem: {
        padding: 0,
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
        flexGrow: {
            xs: 1,
            md: 0,
        },
        justifyContent: {
            xs: 'center',
            md: 'start',
        },
    },
};

export default NavbarToolbarStyles;
