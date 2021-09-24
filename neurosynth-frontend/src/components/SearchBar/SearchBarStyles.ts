import makeStyles from '@mui/styles/makeStyles';

const SearchBarStyles = makeStyles({
    textfield: {
        flexGrow: 1,
        padding: '5px 15px',
    },
    w_100: {
        width: '100%',
    },
    divider: {
        height: '35px',
        margin: 'auto auto',
    },
    iconContainer: {
        width: '50px',
        height: '56px',
        borderTopLeftRadius: '0 !important',
        borderBottomLeftRadius: '0 !important',
        '&:hover': {
            backgroundColor: '#00689e !important',
            transition: '0.5s',
        },
    },
    icon: {
        color: 'white',
    },
    searchContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        margin: '1% 0',
    },
    paper: {
        flexGrow: 1,
        borderRadius: '0 !important',
        borderLeft: 'none !important',
        borderRight: 'none !important',
        justifyContent: 'center',
        display: 'flex',
    },
    select: {
        borderBottomRightRadius: '0 !important',
        borderTopRightRadius: '0 !important',
    },
});

export default SearchBarStyles;
