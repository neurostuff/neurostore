import { Style } from '../..';

const DisplayAnalysisStyles: Style = {
    spaceBelow: {
        marginBottom: '8px',
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
        display: 'flex',
        flexDirection: {
            xs: 'column-reverse',
            sm: 'row',
        },
    },
    visualizer: {
        width: '100%',
        height: 'auto',
        padding: '0 2px', // papaya gives an 8px border already so we pad it to match
    },
    visualizerContainer: {
        width: '100%',
        position: {
            xs: 'initial',
            md: 'sticky',
        },
        top: {
            xs: '0px',
            md: '5px',
        },
    },
    section: {
        width: {
            xs: '100%',
            md: '50%',
        },
    },
    leftSection: {
        paddingRight: {
            xs: '0px',
            md: '10px',
        },
        // when there is no visualizer, the left section will take up the entire page
        flexGrow: 1,
    },
    rightSection: {
        marginBottom: {
            xs: '10%',
            md: '0',
        },
    },
    removeTablePadding: {
        '& th': {
            padding: {
                xs: 0,
                md: '6px 16px',
            },
        },
        '& td': {
            padding: {
                xs: 0,
                md: '6px 16px',
            },
        },
    },
};

export default DisplayAnalysisStyles;
