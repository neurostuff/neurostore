import { Style } from '../../../..';

const EditAnalysisStyles: Style = {
    editTabs: {
        borderBottom: 1,
        marginBottom: '15px',
        color: 'lightgray',
    },
    tab: {
        '&:hover': {
            color: 'secondary.main',
        },
    },
    analysisButton: {
        padding: '8px',
        width: '200px',
    },
    unsavedChanges: {
        backgroundColor: '#ffd892',
    },
};

export default EditAnalysisStyles;
