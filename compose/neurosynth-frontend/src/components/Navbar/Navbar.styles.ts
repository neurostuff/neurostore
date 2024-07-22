import { Style } from 'index';

const NavbarStyles: Style = {
    toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        width: {
            xs: '90%',
            md: '80%',
        },
        margin: '0 auto',
    },
    mdDown: {
        display: {
            xs: 'block',
            md: 'none',
        },
        marginLeft: {
            xs: '40px',
            md: '0px',
        },
    },
    mdUp: {
        display: {
            xs: 'none',
            md: 'block',
        },
    },
    logoContainer: {
        textDecoration: 'none !important',
        display: 'flex',
        color: 'white',
        alignItems: 'center',
        '&:hover': {
            '& img': {
                opacity: '0.9',
            },
            color: '#ef8a24',
        },
    },
    logo: {
        width: '45px',
        height: '45px',
        marginRight: '0.75rem',
        cursor: 'pointer',
    },
    logoText: {
        fontSize: {
            xs: '1rem',
            lg: '1.5rem',
        },
    },
};

export default NavbarStyles;
