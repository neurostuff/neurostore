import { Style } from 'index';

const EditStudyComponentsStyles: Style = {
    accordion: {
        border: '1px solid',
        borderTop: 'none',
        borderColor: 'secondary.main',
        borderRadius: '0 !important',
    },
    accordionSummary: {
        ':hover': {
            backgroundColor: '#f2f2f2',
        },
    },
    accordionTitle: {
        fontWeight: 'bold',
        marginRight: '10px',
        color: 'secondary.main',
    },
    accordionContentContainer: {
        margin: '1rem 0 0.5rem 0',
    },
};

export default EditStudyComponentsStyles;
