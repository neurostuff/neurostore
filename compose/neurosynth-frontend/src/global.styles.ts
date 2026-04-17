import { Style } from 'index';

const GlobalStyles: Style = {
    colorPulseAnimation: {
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
            '0%': {
                backgroundColor: 'success.light',
                color: 'white',
            },
            '50%': {
                backgroundColor: 'success.dark',
                color: 'white',
            },
            '100%': {
                backgroundColor: 'success.light',
                color: 'white',
            },
        },
    },
};

export default GlobalStyles;
