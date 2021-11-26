import { Style } from '../..';

const TextExpansionStyles: Style = {
    limitToOneLine: {
        overflow: 'hidden',
        textOverflow: 'ellipses',
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        lineClamp: 1,
    },
};

export default TextExpansionStyles;
