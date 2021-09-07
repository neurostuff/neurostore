import { makeStyles } from '@material-ui/core';

const DisplayStudiesTableStyles = makeStyles((theme) => ({
    name: {
        width: '30%',
    },
    tableCellTextContainer: {
        maxHeight: '100px !important',
    },
    noContent: {
        color: theme.palette.warning.dark,
    },
    tableRow: {
        '&:hover': {
            backgroundColor: theme.palette.grey[200],
            cursor: 'pointer',
            transition: '0.25s',
        },
    },
    badge_neurosynth: {
        padding: '5px',
        borderRadius: '8px',
    },
    badge_user: {
        padding: '5px',
        borderRadius: '8px',
    },
}));

export default DisplayStudiesTableStyles;
