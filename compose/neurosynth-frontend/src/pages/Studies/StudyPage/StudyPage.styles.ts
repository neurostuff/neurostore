import { Style } from '../../..';

const StudyPageStyles: Style = {
    buttonContainer: {
        '& button': {
            marginRight: '15px',
        },
        display: 'flex',
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
        minHeight: '200px',
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
        wordBreak: 'break-word',
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
    metadataContainer: {
        maxHeight: {
            xs: '200px',
            md: '400px',
        },
        overflow: 'auto',
        overflowX: 'hidden',
    },
    accordionSummary: {
        '.MuiAccordionSummary-content': { margin: '0px' },
    },
};

export default StudyPageStyles;
