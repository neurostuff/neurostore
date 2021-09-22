import makeStyles from '@mui/styles/makeStyles';

const NavbarToolbarStyles = makeStyles((theme) => {
    return {
        link: {
            textDecoration: 'none',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            color: theme.palette.primary.contrastText,
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
        },
        active: {
            color: theme.palette.secondary.main,
        },
    };
});

export default NavbarToolbarStyles;
