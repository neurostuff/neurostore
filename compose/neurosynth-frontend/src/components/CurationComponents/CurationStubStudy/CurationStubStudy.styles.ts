import { Style } from 'index';

const CurationStubStudyStyles: Style = {
    stubStudyContainer: {
        padding: '10px',
        marginBottom: '10px',
    },
    exclusionContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.25rem',
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
        maxWidth: '180px',
    },
};

export default CurationStubStudyStyles;
