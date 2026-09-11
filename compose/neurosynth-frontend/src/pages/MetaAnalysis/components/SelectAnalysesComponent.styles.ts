import { Style } from 'index';

const SelectAnalysesComponentStyles: Style = {
    tableContainer: {
        maxHeight: '60vh',
    },
    filterInput: {
        width: '100%',
        '& .MuiInputBase-input': {
            fontSize: '13px',
            padding: '6px 10px',
        },
    },
    tableCell: {
        padding: '10px',
    },
    headerCell: {
        verticalAlign: 'bottom',
        backgroundColor: 'background.paper',
    },
    studyCell: {
        maxWidth: '300px',
        verticalAlign: 'top',
    },
    stickyStudyName: {
        position: 'sticky',
        top: 0,
        backgroundColor: 'background.paper',
    },
    selected: {
        backgroundColor: '#b7ffb7',
    },
    'not-selected': {
        backgroundColor: '#ffb7b7',
    },
};

export default SelectAnalysesComponentStyles;
