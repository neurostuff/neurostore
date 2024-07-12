import { Style } from '../..';

const SearchBarStyles: Style = {
    textfield: {
        flexGrow: 1,
        padding: '5px 15px',
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
    paper: {
        flexGrow: 1,
        borderTopLeftRadius: '4px',
        borderBottomLeftRadius: '4px',
        padding: '4px',
        justifyContent: 'center',
        display: 'flex',
        borderTopRightRadius: '0px !important',
        borderBottomRightRadius: '0px !important',
        borderRight: '0px',
    },
    searchContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
    },
};

export default SearchBarStyles;
