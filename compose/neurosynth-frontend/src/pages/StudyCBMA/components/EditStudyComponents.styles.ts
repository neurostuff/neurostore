import { Style } from 'index';

const EditStudyComponentsStyles: Style = {
    accordion: {
        border: '2px solid',
        borderTop: 'none',
        borderColor: 'secondary.main',
        borderRadius: '0 !important',
        margin: '0 !important',
    },
    accordionSummary: {
        minHeight: '64px !important',
        '&.Mui-expanded': {
            minHeight: '64px !important',
        },
        ':hover': {
            backgroundColor: '#f2f2f2',
        },
        '& .MuiAccordionSummary-content': {
            margin: '4px 0',
            '&.Mui-expanded': {
                margin: '4px 0',
            },
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
