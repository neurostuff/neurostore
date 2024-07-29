import { Style } from 'index';

const GlobalStyles: Style = {
    colorPulseAnimation: {
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
            '0%': {
                backgroundColor: 'success.light',
            },
            '50%': {
                backgroundColor: 'white',
            },
            '100%': {
                backgroundColor: 'success.light',
            },
        },
    },
};

export default GlobalStyles;
