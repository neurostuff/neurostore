import { Style } from '../../..';

const StudyPageStyles: Style = {
    buttonContainer: {
        '& button': {
            marginRight: '15px',
        },
        display: {
            xs: 'flex',
            md: 'block',
        },
        justifyContent: {
            xs: 'center',
            md: 'initial',
        },
    },
    muted: {
        color: 'muted.main',
    },
    spaceBelow: {
        marginBottom: '8px !important',
    },
    error: {
        color: 'error.main',
        fontWeight: 'bold',
    },
    matchingSibling: {
        display: 'flex',
        flexDirection: 'column',
    },
    heightDefiningSibling: {
        width: '100%',
        height: '100%',
    },
    analysesTabs: {
        borderRight: 1,
        color: 'lightgray',
        maxWidth: {
            xs: 90,
            md: 150,
        },
        // flex grow shrink basis
        flex: '1 0 0',
    },
    analysisTab: {
        fontWeight: 'bold',
        fontSize: {
            xs: '0.8rem',
            md: 'initial',
        },
        '&:hover': {
            color: 'secondary.main',
        },
    },
    tab: {
        '&:hover': {
            color: 'secondary.main',
        },
        fontSize: {
            xs: '0.8rem',
            md: '1.25rem',
        },
    },
};

export default StudyPageStyles;
