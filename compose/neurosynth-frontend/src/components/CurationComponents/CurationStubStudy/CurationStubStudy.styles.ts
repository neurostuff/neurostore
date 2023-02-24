import { Style } from 'index';

const CurationStubStudyStyles: Style = {
    stubStudyContainer: {
        display: 'flex',
        padding: '10px',
        marginBottom: '10px',
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
    limitText: {
        overflow: 'hidden',
        textOverflow: 'ellipses',
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        lineClamp: 1,
        cursor: 'pointer',
    },
    tag: {
        marginRight: '4px',
        marginTop: '4px',
        fontSize: '',
        maxWidth: '80px',
    },
};

export default CurationStubStudyStyles;
