import { Style } from '../../../..';

const SimpleSearchStyles: Style = {
    textfield: {
        flexGrow: 1,
        padding: '5px 15px',
    },
    searchContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
    },
    paper: {
        flexGrow: 1,
        borderTopLeftRadius: '4px',
        borderBottomLeftRadius: '4px',
        padding: '4px',
        justifyContent: 'center',
        display: 'flex',
    },
    select: {
        borderBottomRightRadius: '0 !important',
        borderTopRightRadius: '0 !important',
    },
};

export default SimpleSearchStyles;
