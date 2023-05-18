import { Style } from 'index';

const CurationStubStudyStyles: Style = {
    stubStudyContainer: {
        userSelect: 'none',
        cursor: 'pointer',
        ':hover': {
            backgroundColor: '#f5f5f5',
        },
    },
    exclusionContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tag: {
        marginRight: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
};

export default CurationStubStudyStyles;
