import makeStyles from '@mui/styles/makeStyles';

const DisplayStudiesTableStyles = makeStyles((theme) => ({
    root: {
        margin: '2% 0',
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
