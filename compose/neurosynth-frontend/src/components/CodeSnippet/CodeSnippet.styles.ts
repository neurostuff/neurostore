import { Style } from '../..';

const CodeSnippetStyles: Style = {
    codeBlockHeader: {
        border: '2px solid',
        borderColor: '#3e3e3e',
        backgroundColor: '#3e3e3e',
        color: 'white',
        borderBottom: 'none',
        padding: '4px 10px',
        borderTopLeftRadius: '3px',
        borderTopRightRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '30px',
    },
    codeBlock: {
        backgroundColor: '#585858',
        color: 'white',
        padding: '0.75rem',
        fontFamily: 'monospace',
        borderBottomLeftRadius: '3px',
        borderBottomRightRadius: '3px',
        minHeight: '1rem',
    },
};

export default CodeSnippetStyles;

// code: {
//     fontFamily: 'monospace',
//     backgroundColor: 'lightgray',
//     padding: '0.75rem',
//     borderRadius: '5px',
// },
