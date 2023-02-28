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
        flex: '1 1 0px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
};

export default CurationStubStudyStyles;
