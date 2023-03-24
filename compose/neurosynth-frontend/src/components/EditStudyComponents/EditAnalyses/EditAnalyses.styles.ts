import { Style } from '../../..';

const EditAnalysesStyles: Style = {
    matchingSibling: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px',
    },
    heightDefiningSibling: {
        width: '100%',
        height: '100%',
    },
    analysesTabs: {
        borderRight: 1,
        color: 'lightgray',
        width: {
            xs: 90,
            md: 150,
        },
        // flex grow shrink basis
        flex: '1 0 0',
    },
    analysisContainer: {
        paddingLeft: {
            xs: '10px',
            md: '20px',
        },
        paddingTop: {
            xs: '6px',
            md: '12px',
        },
        width: '100%',
    },
    tab: {
        fontWeight: 'bold',
        fontSize: {
            xs: '0.8rem',
            md: 'initial',
        },
        '&:hover': {
            color: 'secondary.main',
        },
    },
    accordionSummary: {
        ':hover': { backgroundColor: 'primary.dark' },
        backgroundColor: 'primary.main',
        color: 'white',
    },
    accordionExpandIcon: {
        color: 'white',
    },
};

export default EditAnalysesStyles;
