import { Style } from 'index';

const CurationImportBaseStyles: Style = {
    fixedContainer: {
        position: 'fixed',
        bottom: 0,
        width: '100%',
        left: 0,
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 1,
    },
    fixedButtonsContainer: {
        width: '80%',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px',
    },
    nextButton: {
        width: '220px',
    },
};

export default CurationImportBaseStyles;
