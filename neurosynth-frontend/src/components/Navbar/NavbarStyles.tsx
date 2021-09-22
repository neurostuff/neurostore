import makeStyles from '@mui/styles/makeStyles';

const NavbarStyles = makeStyles((theme) => {
    return {
        toolbar: {
            // "height: 1px" is a workaround due to a bug where the child cannot inherit the min-height property of the parent:
            // https://stackoverflow.com/questions/8468066/child-inside-parent-with-min-height-100-not-inheriting-height
            height: '1px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '80%',
            margin: '0 auto',
        },
    };
});

export default NavbarStyles;
