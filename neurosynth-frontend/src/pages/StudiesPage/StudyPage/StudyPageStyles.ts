import makeStyles from '@mui/styles/makeStyles';

const StudyPageStyles = makeStyles((theme) => ({
    buttonContainer: {
        '& button': {
            marginRight: '15px',
        },
        marginBottom: '15px',
    },
    muted: {
        color: theme.palette.muted.main,
    },
    metadataContainer: {},
    noContent: {
        color: theme.palette.warning.dark,
    },
}));

export default StudyPageStyles;
