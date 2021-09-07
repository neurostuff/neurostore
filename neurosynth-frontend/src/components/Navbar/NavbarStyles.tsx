import { makeStyles } from '@material-ui/core';

const NavbarStyles = makeStyles((theme) => {
    return {
        link: {
            textDecoration: 'none',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            color: theme.palette.primary.contrastText,
        },
        toolbar: {
            // "height: 1px" is a workaround due to a bug where the child cannot inherit the min-height property of the parent:
            // https://stackoverflow.com/questions/8468066/child-inside-parent-with-min-height-100-not-inheriting-height
            height: '1px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '80%',
            margin: '0 auto',
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

export default NavbarStyles;
