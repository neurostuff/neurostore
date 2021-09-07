import { makeStyles } from '@material-ui/core';

const SearchBarStyles = makeStyles({
    textfield: {
        width: '100%',
        padding: '10px 15px',
    },
    paper: {
        display: 'flex',
        margin: '3% 0 4% 0',
    },
    divider: {
        height: '35px',
        margin: 'auto auto',
    },
    icon: {
        width: '50px',
    },
});

export default SearchBarStyles;
