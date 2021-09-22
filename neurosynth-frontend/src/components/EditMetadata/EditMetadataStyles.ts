import makeStyles from '@mui/styles/makeStyles';

const EditMetadataStyles = makeStyles((theme) => ({
    table: {
        display: 'table',
        height: '100%',
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '15px 0px',
    },
    hr: {
        margin: '0px 0px 25px 0px',
    },
    noContent: {
        color: theme.palette.warning.dark,
    },
}));

export default EditMetadataStyles;
