import { Style } from '../../..';

const EditStudyDetailsStyles: Style = {
    textfield: {
        marginBottom: '15px !important',
        width: '100%',
    },
    unsavedChanges: {
        boxShadow: '0px 0px 1px 2px #ef8a24',
    },
    accordionSummary: {
        '.MuiAccordionSummary-content': { margin: '0px' },
    },
    accordionTitleContainer: {
        display: 'flex',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    button: {
        padding: '8px',
        width: '200px',
    },
};

export default EditStudyDetailsStyles;
